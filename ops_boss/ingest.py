"""Ingestion for messy, unstructured business input.

Handles a directory of files in whatever shape a small business actually
hands over: CSV/TSV exports, plain-text or Markdown notes, and PDFs. No
assumption of clean or consistent formatting — files are read as-is and
handed to the model with light structural labeling; the model does the
actual parsing/interpretation.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".tsv", ".json", ".log"}
PDF_EXTENSIONS = {".pdf"}

CATEGORY_KEYWORDS = {
    "financial": ["expense", "invoice", "p&l", "profit", "loss", "revenue", "bank", "ledger"],
    "subscriptions": ["subscription", "recurring", "saas", "software"],
    "staffing": ["staff", "payroll", "roster", "org_chart", "org-chart", "employee", "headcount"],
    "process": ["sop", "workflow", "process", "procedure", "playbook"],
}


@dataclass
class InputDocument:
    filename: str
    category_guess: str
    text: str
    error: str | None = None


def _guess_category(filename: str) -> str:
    name = filename.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return category
    return "uncategorized"


def _extract_pdf_text(path: Path) -> tuple[str, str | None]:
    try:
        from pypdf import PdfReader
    except ImportError:
        return "", (
            "PDF extraction skipped — 'pypdf' is not installed. "
            "Install with `pip install pypdf` to include this file."
        )
    try:
        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages), None
    except Exception as exc:  # malformed/encrypted PDFs, etc.
        return "", f"PDF extraction failed: {exc}"


def load_business_inputs(input_dir: str | Path) -> list[InputDocument]:
    input_dir = Path(input_dir)
    if not input_dir.is_dir():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    docs: list[InputDocument] = []
    for path in sorted(input_dir.rglob("*")):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        rel_name = str(path.relative_to(input_dir))

        if ext in TEXT_EXTENSIONS:
            try:
                text = path.read_text(errors="replace")
            except Exception as exc:
                docs.append(InputDocument(rel_name, "uncategorized", "", f"Failed to read: {exc}"))
                continue
            docs.append(InputDocument(rel_name, _guess_category(rel_name), text))
        elif ext in PDF_EXTENSIONS:
            text, error = _extract_pdf_text(path)
            docs.append(InputDocument(rel_name, _guess_category(rel_name), text, error))
        else:
            docs.append(
                InputDocument(rel_name, "uncategorized", "", f"Unsupported file type: {ext}")
            )
    return docs


def build_context_blob(docs: list[InputDocument]) -> str:
    """Concatenate all successfully-read documents into one labeled blob for
    the model's context. Files that failed to parse are still listed (with
    their error) so the model can flag them as a data gap."""
    sections = []
    for doc in docs:
        header = f"=== FILE: {doc.filename} (category guess: {doc.category_guess}) ==="
        if doc.error and not doc.text:
            sections.append(f"{header}\n[COULD NOT READ: {doc.error}]")
        else:
            body = doc.text.strip() or "[empty file]"
            sections.append(f"{header}\n{body}")
    return "\n\n".join(sections)


def summarize_inputs(docs: list[InputDocument]) -> str:
    lines = [f"Loaded {len(docs)} file(s):"]
    for doc in docs:
        status = "OK" if not doc.error else f"ISSUE: {doc.error}"
        chars = len(doc.text)
        lines.append(f"  - {doc.filename} [{doc.category_guess}] {chars:,} chars — {status}")
    return "\n".join(lines)
