"""Render an audit report dict (schema.py) into human-readable dashboard
output — a terminal summary and a Markdown report."""

from __future__ import annotations

from datetime import date

SEVERITY_TAG = {
    "critical": "[CRITICAL]",
    "high": "[HIGH]",
    "medium": "[MED]",
    "low": "[LOW]",
}


def _bar(score: int, width: int = 20) -> str:
    filled = round(width * max(0, min(100, score)) / 100)
    return "#" * filled + "-" * (width - filled)


def render_terminal(report: dict) -> str:
    lines = []
    lines.append("=" * 64)
    lines.append(f" OPS BOSS — TIER 2 DEEP AUDIT — {report['business_name']}")
    lines.append("=" * 64)
    lines.append("")
    lines.append(f"OVERALL HEALTH SCORE: {report['overall_health_score']}/100")
    lines.append(f"  {_bar(report['overall_health_score'])}")
    lines.append("")
    lines.append(report["overall_summary"])
    lines.append("")
    lines.append("-" * 64)
    lines.append("CATEGORY SCORES")
    lines.append("-" * 64)
    for c in report["category_scores"]:
        lines.append(f"{c['category']:<35} {c['score']:>3}/100  {_bar(c['score'], 15)}")
        lines.append(f"    {c['summary']}")
    lines.append("")
    lines.append("-" * 64)
    lines.append("TOP FINDINGS")
    lines.append("-" * 64)
    for f in sorted(report["top_findings"], key=lambda x: x["rank"]):
        tag = SEVERITY_TAG.get(f["severity"], f["severity"].upper())
        lines.append(f"#{f['rank']} {tag} {f['title']}  ({f['category']})")
        lines.append(f"    {f['description']}")
        lines.append(f"    Why this matters: {f['why_it_matters']}")
        lines.append(f"    Est. annual impact: {f['estimated_annual_impact']}")
        lines.append("")
    lines.append("-" * 64)
    lines.append("RECOMMENDATIONS (prioritized)")
    lines.append("-" * 64)
    priority_order = {"high": 0, "medium": 1, "low": 2}
    for r in sorted(report["recommendations"], key=lambda x: priority_order.get(x["priority"], 9)):
        linked = ", ".join(f"#{n}" for n in r["linked_finding_ranks"]) or "—"
        lines.append(
            f"[{r['priority'].upper()} priority / {r['effort']} effort] {r['title']} "
            f"(addresses finding {linked})"
        )
        lines.append(f"    {r['description']}")
        lines.append(f"    Expected impact: {r['expected_impact']}")
        lines.append("")
    if report.get("data_gaps"):
        lines.append("-" * 64)
        lines.append("DATA GAPS (limited confidence where noted above)")
        lines.append("-" * 64)
        for gap in report["data_gaps"]:
            lines.append(f"  - {gap}")
        lines.append("")
    lines.append("=" * 64)
    return "\n".join(lines)


def render_markdown(report: dict) -> str:
    lines = []
    lines.append(f"# Ops Boss — Tier 2 Deep Audit: {report['business_name']}")
    lines.append(f"*Generated {date.today().isoformat()}*")
    lines.append("")
    lines.append(f"## Overall Health Score: {report['overall_health_score']}/100")
    lines.append("")
    lines.append(report["overall_summary"])
    lines.append("")
    lines.append("## Category Scores")
    lines.append("")
    lines.append("| Category | Score | Summary |")
    lines.append("|---|---|---|")
    for c in report["category_scores"]:
        summary = c["summary"].replace("|", "\\|")
        lines.append(f"| {c['category']} | {c['score']}/100 | {summary} |")
    lines.append("")
    lines.append("## Top Findings")
    lines.append("")
    for f in sorted(report["top_findings"], key=lambda x: x["rank"]):
        lines.append(f"### {f['rank']}. {f['title']} — *{f['severity'].upper()}* ({f['category']})")
        lines.append("")
        lines.append(f"**What we found:** {f['description']}")
        lines.append("")
        lines.append(f"**Why this matters:** {f['why_it_matters']}")
        lines.append("")
        lines.append(f"**Estimated annual impact:** {f['estimated_annual_impact']}")
        lines.append("")
    lines.append("## Recommendations")
    lines.append("")
    priority_order = {"high": 0, "medium": 1, "low": 2}
    for r in sorted(report["recommendations"], key=lambda x: priority_order.get(x["priority"], 9)):
        linked = ", ".join(f"#{n}" for n in r["linked_finding_ranks"]) or "—"
        lines.append(f"### {r['title']}")
        lines.append(
            f"**Priority:** {r['priority'].capitalize()} &nbsp;|&nbsp; "
            f"**Effort:** {r['effort'].capitalize()} &nbsp;|&nbsp; "
            f"**Addresses finding:** {linked}"
        )
        lines.append("")
        lines.append(r["description"])
        lines.append("")
        lines.append(f"*Expected impact: {r['expected_impact']}*")
        lines.append("")
    if report.get("data_gaps"):
        lines.append("## Data Gaps")
        lines.append("")
        lines.append(
            "These limited our confidence in parts of the analysis above — "
            "closing them would sharpen a future audit:"
        )
        lines.append("")
        for gap in report["data_gaps"]:
            lines.append(f"- {gap}")
        lines.append("")
    return "\n".join(lines)
