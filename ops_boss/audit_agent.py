"""The Ops Boss audit agent — Tier 2 (deep audit) logic.

Single API call: takes the full ingested business-data blob, analyzes it
against a fixed 5-category rubric, and returns a structured audit report
(schema.py) via Claude's structured outputs. Tier 1 will later reuse this
same call with a reduced category/finding count — no tier-switching here.
"""

from __future__ import annotations

import json
import os

import anthropic

from .cost_tracker import CostTracker
from .schema import AUDIT_JSON_SCHEMA, CATEGORIES

DEFAULT_MODEL = os.environ.get("OPS_BOSS_MODEL", "claude-opus-5")

SYSTEM_PROMPT = f"""You are the audit engine behind Ops Boss, a paid audit-as-a-service \
product for small businesses. A client has paid for a Tier 2 Deep Audit: full \
financial and operational analysis, all categories, detailed and prioritized \
recommendations.

You will receive a bundle of the client's raw financial and operational \
records — expenses, invoices, subscriptions, SOPs, staffing structure, and \
similar. Assume it is messy: inconsistent formatting, partial data, no \
guaranteed structure. Extract what you can, and explicitly call out what you \
can't in `data_gaps` rather than inventing numbers.

Score and report against exactly these five categories, in this order:
1. Cost Efficiency — spending patterns relative to revenue/output, waste, \
overpayment, pricing discipline.
2. Process Maturity — whether key workflows are documented, repeatable, and \
not solely dependent on one person's memory.
3. Staffing Utilization — labor allocation vs. workload, overtime patterns, \
role clarity, over/under-staffing signals.
4. Financial Controls & Cash Flow — invoicing discipline, AR/AP hygiene, \
financial visibility, reconciliation practices.
5. Vendor & Subscription Management — recurring-cost hygiene, duplicate or \
unused subscriptions, contract/renewal risk.

Scoring guide for every 0-100 score (category and overall alike):
- 90-100: best-in-class for a business this size; no material gaps found.
- 70-89: solid fundamentals, a few fixable gaps.
- 50-69: meaningful gaps that are costing money or creating risk.
- 30-49: significant, systemic issues in this area.
- 0-29: severe — actively threatening the business.
The overall_health_score is not a simple average — weight it down further if \
any finding is `critical` severity, since a single critical issue can matter \
more than five minor ones.

Ground every finding and every dollar estimate in the specific data provided \
— quote or reference the actual numbers you saw. Never fabricate a precise \
figure from data that isn't there; use `estimated_annual_impact: "Not \
quantifiable from available data"` when appropriate, or give a defensible \
range with the reasoning behind it. Findings without a because behind them \
are not sellable — a client is paying to find out something they didn't \
already know, backed by their own numbers.

Every recommendation must tie back to at least one finding by rank and be a \
concrete next action a small business owner could actually take this month \
— not generic advice like "improve cost tracking." Prioritize by \
impact-to-effort ratio, not just raw dollar size.

If the input data is too thin to support a claim, say so in `data_gaps` \
instead of padding the findings list with speculation."""


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


def run_audit(
    business_name: str,
    context_blob: str,
    *,
    model: str = DEFAULT_MODEL,
    cost_tracker: CostTracker | None = None,
    max_tokens: int = 20000,
    effort: str = "high",
) -> dict:
    """Run the Tier 2 deep audit as a single Claude API call and return the
    parsed, schema-validated audit report as a dict."""
    tracker = cost_tracker if cost_tracker is not None else CostTracker()
    client = _client()

    user_message = (
        f"Client business name: {business_name}\n\n"
        f"Raw business data follows, one section per source file:\n\n"
        f"{context_blob}"
    )

    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        thinking={"type": "adaptive"},
        output_config={
            "effort": effort,
            "format": {"type": "json_schema", "schema": AUDIT_JSON_SCHEMA},
        },
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        response = stream.get_final_message()

    tracker.record(label="tier2_deep_audit", model=model, usage=response.usage)

    if response.stop_reason == "refusal":
        raise RuntimeError(
            f"Model declined the request (stop_reason=refusal, "
            f"category={getattr(response.stop_details, 'category', None)})."
        )
    if response.stop_reason == "max_tokens":
        raise RuntimeError(
            "Response was truncated at max_tokens before completing the audit. "
            "Re-run with a higher max_tokens value."
        )

    text_blocks = [b.text for b in response.content if b.type == "text"]
    if not text_blocks:
        raise RuntimeError(f"No text content in response (stop_reason={response.stop_reason}).")

    report = json.loads(text_blocks[0])

    # Structured outputs guarantees schema conformance server-side; this is a
    # cheap belt-and-suspenders check on the one thing schema validation
    # can't express (an exact match of the fixed category set/order).
    got_categories = [c["category"] for c in report["category_scores"]]
    if got_categories != CATEGORIES:
        raise RuntimeError(
            f"Category scores did not match the expected fixed set/order. "
            f"Expected {CATEGORIES}, got {got_categories}."
        )

    return report
