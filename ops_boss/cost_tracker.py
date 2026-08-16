"""Per-API-call cost tracking for validating Ops Boss pricing tiers against
real usage.

Pricing is USD per million tokens, first-party Claude API list rates.
Cache-write is billed at ~1.25x base input (5-minute TTL, the default);
cache-read is billed at ~0.1x base input.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path

# $/MTok: (input, output)
MODEL_PRICING = {
    "claude-opus-5": (5.00, 25.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
}

CACHE_WRITE_MULTIPLIER = 1.25  # 5-minute TTL
CACHE_READ_MULTIPLIER = 0.10


def _rate_for(model: str) -> tuple[float, float]:
    if model in MODEL_PRICING:
        return MODEL_PRICING[model]
    # Unknown/newer model id — fall back to Opus-5-tier pricing rather than
    # silently reporting $0, and say so in the record.
    return MODEL_PRICING["claude-opus-5"]


@dataclass
class CallRecord:
    label: str
    model: str
    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: int
    cache_read_input_tokens: int
    cost_usd: float
    timestamp: str
    pricing_is_estimated: bool


@dataclass
class CostTracker:
    calls: list[CallRecord] = field(default_factory=list)

    def record(self, label: str, model: str, usage) -> CallRecord:
        """Record one API call's usage. `usage` is the SDK response.usage object
        (or anything with the same attribute names)."""
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0

        in_rate, out_rate = _rate_for(model)
        cost = (
            input_tokens * in_rate
            + output_tokens * out_rate
            + cache_creation * in_rate * CACHE_WRITE_MULTIPLIER
            + cache_read * in_rate * CACHE_READ_MULTIPLIER
        ) / 1_000_000

        record = CallRecord(
            label=label,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_creation_input_tokens=cache_creation,
            cache_read_input_tokens=cache_read,
            cost_usd=round(cost, 6),
            timestamp=datetime.now(timezone.utc).isoformat(),
            pricing_is_estimated=model not in MODEL_PRICING,
        )
        self.calls.append(record)
        return record

    @property
    def total_cost_usd(self) -> float:
        return round(sum(c.cost_usd for c in self.calls), 6)

    @property
    def total_input_tokens(self) -> int:
        return sum(c.input_tokens for c in self.calls)

    @property
    def total_output_tokens(self) -> int:
        return sum(c.output_tokens for c in self.calls)

    def summary_lines(self) -> list[str]:
        lines = ["API COST TRACKING", "-" * 60]
        for c in self.calls:
            est = " (pricing estimated)" if c.pricing_is_estimated else ""
            lines.append(
                f"[{c.label}] model={c.model}{est}\n"
                f"  input={c.input_tokens:,} output={c.output_tokens:,} "
                f"cache_write={c.cache_creation_input_tokens:,} cache_read={c.cache_read_input_tokens:,}\n"
                f"  cost=${c.cost_usd:.4f}"
            )
        lines.append("-" * 60)
        lines.append(
            f"TOTAL: {len(self.calls)} call(s), "
            f"{self.total_input_tokens:,} input tok, {self.total_output_tokens:,} output tok, "
            f"${self.total_cost_usd:.4f}"
        )
        return lines

    def print_summary(self) -> None:
        print("\n".join(self.summary_lines()))

    def to_dict(self) -> dict:
        return {
            "calls": [asdict(c) for c in self.calls],
            "total_cost_usd": self.total_cost_usd,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
        }

    def save(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.to_dict(), indent=2))
