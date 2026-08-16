"""CLI: run a Tier 2 deep audit end-to-end against a directory of business data.

Usage:
    python -m ops_boss.run_audit --input-dir sample_data/l_and_h_poultry \\
        --business-name "L&H Poultry" --output-dir out/

Requires ANTHROPIC_API_KEY (or another credential the Anthropic SDK can
resolve — see `ant auth status` if using the Anthropic CLI) in the
environment.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .audit_agent import DEFAULT_MODEL, run_audit
from .cost_tracker import CostTracker
from .dashboard import render_markdown, render_terminal
from .ingest import build_context_blob, load_business_inputs, summarize_inputs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run an Ops Boss Tier 2 deep audit.")
    parser.add_argument("--input-dir", required=True, help="Directory of raw business data files.")
    parser.add_argument("--business-name", required=True, help="Client business name.")
    parser.add_argument("--output-dir", default="out", help="Where to write report artifacts.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Claude model ID to use.")
    args = parser.parse_args(argv)

    print(f"Loading business data from {args.input_dir} ...")
    docs = load_business_inputs(args.input_dir)
    print(summarize_inputs(docs))
    context_blob = build_context_blob(docs)
    print(f"\nContext blob: {len(context_blob):,} characters")

    tracker = CostTracker()
    print(f"\nRunning Tier 2 deep audit with model={args.model} ...")
    try:
        report = run_audit(
            business_name=args.business_name,
            context_blob=context_blob,
            model=args.model,
            cost_tracker=tracker,
        )
    finally:
        # Always show cost, even on failure — that's the point of tracking it.
        print()
        tracker.print_summary()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    (output_dir / "audit_report.json").write_text(json.dumps(report, indent=2))
    (output_dir / "audit_dashboard.md").write_text(render_markdown(report))
    tracker.save(output_dir / "cost_log.json")

    print("\n" + render_terminal(report))
    print(f"\nWrote: {output_dir}/audit_report.json")
    print(f"Wrote: {output_dir}/audit_dashboard.md")
    print(f"Wrote: {output_dir}/cost_log.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
