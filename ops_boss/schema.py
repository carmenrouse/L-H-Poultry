"""Output contract for the Tier 2 (deep audit) report.

Tier 1 (basic) will later reuse this same schema with fewer categories/
findings/recommendations required — nothing here is tier-specific.
"""

from __future__ import annotations

CATEGORIES = [
    "Cost Efficiency",
    "Process Maturity",
    "Staffing Utilization",
    "Financial Controls & Cash Flow",
    "Vendor & Subscription Management",
]

SEVERITIES = ["critical", "high", "medium", "low"]
PRIORITIES = ["high", "medium", "low"]
EFFORTS = ["low", "medium", "high"]

_CATEGORY_SCORE = {
    "type": "object",
    "properties": {
        "category": {"type": "string", "enum": CATEGORIES},
        "score": {
            "type": "integer",
            "description": "0-100. 100 = best-in-class for a small business of this size.",
        },
        "summary": {
            "type": "string",
            "description": "2-3 sentences on what's driving this score.",
        },
    },
    "required": ["category", "score", "summary"],
    "additionalProperties": False,
}

_FINDING = {
    "type": "object",
    "properties": {
        "rank": {"type": "integer", "description": "1 = highest impact."},
        "title": {"type": "string", "description": "Short, specific headline (<=12 words)."},
        "category": {"type": "string", "enum": CATEGORIES},
        "severity": {"type": "string", "enum": SEVERITIES},
        "description": {
            "type": "string",
            "description": "What was found, grounded in specific numbers/facts from the input data.",
        },
        "why_it_matters": {
            "type": "string",
            "description": "1-2 sentences on business consequence if left unaddressed.",
        },
        "estimated_annual_impact": {
            "type": "string",
            "description": "Dollar range or qualitative impact estimate, e.g. '$2,400-$3,600/yr' or 'Not quantifiable from available data'.",
        },
    },
    "required": [
        "rank",
        "title",
        "category",
        "severity",
        "description",
        "why_it_matters",
        "estimated_annual_impact",
    ],
    "additionalProperties": False,
}

_RECOMMENDATION = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Short, actionable headline (<=12 words)."},
        "linked_finding_ranks": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "Which finding rank(s) this recommendation addresses.",
        },
        "priority": {"type": "string", "enum": PRIORITIES},
        "effort": {"type": "string", "enum": EFFORTS},
        "expected_impact": {
            "type": "string",
            "description": "Concrete expected outcome, quantified where possible.",
        },
        "description": {
            "type": "string",
            "description": "Specific next action(s) — not generic advice.",
        },
    },
    "required": [
        "title",
        "linked_finding_ranks",
        "priority",
        "effort",
        "expected_impact",
        "description",
    ],
    "additionalProperties": False,
}

AUDIT_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "business_name": {"type": "string"},
        "overall_health_score": {
            "type": "integer",
            "description": "0-100 single top-line metric, weighted average of category scores adjusted for critical findings.",
        },
        "overall_summary": {
            "type": "string",
            "description": "2-4 sentence executive summary of the business's operational health.",
        },
        "category_scores": {
            "type": "array",
            "items": _CATEGORY_SCORE,
            "minItems": 5,
            "maxItems": 5,
            "description": "Exactly one entry per category, in the fixed category order.",
        },
        "top_findings": {
            "type": "array",
            "items": _FINDING,
            "minItems": 5,
            "maxItems": 8,
            "description": "Ranked highest-impact issues found, rank 1 first.",
        },
        "recommendations": {
            "type": "array",
            "items": _RECOMMENDATION,
            "minItems": 5,
            "maxItems": 10,
            "description": "Prioritized by impact/effort, each tied to at least one finding.",
        },
        "data_gaps": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Specific missing/ambiguous data that limited analysis confidence — empty array if none.",
        },
    },
    "required": [
        "business_name",
        "overall_health_score",
        "overall_summary",
        "category_scores",
        "top_findings",
        "recommendations",
        "data_gaps",
    ],
    "additionalProperties": False,
}
