r"""Extract delivery-order (DO) numbers from PDFs under D:\.

Install:
    py -m pip install pymupdf

Run:
    py extract_do_numbers.py
    py extract_do_numbers.py --root D:\ --pattern "DO\\s*(?:NO|NUMBER)\\s*[:#-]?\\s*([A-Z0-9-]+)"

The default patterns cover common labelled DO fields and the NIP identifier
format observed in this workspace. Use --pattern when the document format is
known and a stricter pattern is required.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Missing dependency. Install it with: py -m pip install pymupdf", file=sys.stderr)
    raise SystemExit(2)


# Group 1 is always the value returned by the extractor.
DEFAULT_PATTERNS = (
    re.compile(r"\b(?:D[AE]LIVERY|D[A-Z]TORY|DO)\s+ORDER\s*(?:NO\.?|NUMBER|#)\s*[:\-]?\s*(\d{7,8})\b", re.I),
    re.compile(r"\bDO\s*[:\-]\s*(81(?:[\s._-]*\d){6})\b", re.I),
    # Fallback for scanned layouts where the DO label is not recognized.
    re.compile(r"(?<![\dA-Z])81(?:[\s._-]*\d){6}(?![\dA-Z])", re.I),
)


def extract_do_numbers(text: str, patterns: tuple[re.Pattern[str], ...]) -> list[str]:
    """Return unique DO values in first-seen order."""
    values: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        for match in pattern.finditer(text):
            value = re.sub(r"[\s._-]", "", match.group(1) or match.group(0)).upper()
            value = value.translate(str.maketrans({"O": "0", "Q": "0", "I": "1", "L": "1", "|": "1", "S": "5", "B": "8"}))
            if pattern is patterns[0]:
                value = ("8" + value) if len(value) == 7 else ("8" + value[1:] if len(value) == 8 else value)
            if not re.fullmatch(r"81\d{6}", value):
                continue
            key = value.upper()
            if key not in seen:
                seen.add(key)
                values.append(value)
    return values


def scan_pdf(path: Path, patterns: tuple[re.Pattern[str], ...]) -> list[dict[str, object]]:
    """Extract text page-by-page and return DO matches with page locations."""
    matches: list[dict[str, object]] = []
    with fitz.open(path) as document:
        for page_number, page in enumerate(document, start=1):
            text = page.get_text("text")
            for value in extract_do_numbers(text, patterns):
                matches.append({"file": str(path), "page": page_number, "do_number": value})
    return matches


def main() -> int:
    parser = argparse.ArgumentParser(description="Find DO numbers in PDF files.")
    parser.add_argument("--root", type=Path, default=Path("D:/"), help="Directory to scan recursively (default: D:\\).")
    parser.add_argument("--pattern", help="Custom regex; capture the DO number in group 1.")
    parser.add_argument("--csv", type=Path, help="Optional CSV output path.")
    args = parser.parse_args()

    if not args.root.exists():
        parser.error(f"Directory does not exist: {args.root}")

    patterns = (re.compile(args.pattern, re.I),) if args.pattern else DEFAULT_PATTERNS
    pdfs = sorted(path for path in args.root.rglob("*.pdf") if path.is_file())
    rows: list[dict[str, object]] = []
    failures: list[tuple[Path, str]] = []

    for pdf in pdfs:
        try:
            rows.extend(scan_pdf(pdf, patterns))
        except Exception as error:  # Keep one damaged/password-protected PDF from stopping the scan.
            failures.append((pdf, str(error)))

    if rows:
        print("file\tpage\tdo_number")
        for row in rows:
            print(f"{row['file']}\t{row['page']}\t{row['do_number']}")
    else:
        print("No DO numbers found. Scanned PDFs may be image-only and require OCR.")

    scanned_with_matches = {str(row["file"]) for row in rows}
    print(f"\nScanned: {len(pdfs)} PDF(s); matches: {len(rows)}; unmatched: {len(pdfs) - len(scanned_with_matches)}")
    for path, error in failures:
        print(f"ERROR\t{path}\t{error}", file=sys.stderr)

    if args.csv:
        with args.csv.open("w", newline="", encoding="utf-8-sig") as output:
            writer = csv.DictWriter(output, fieldnames=("file", "page", "do_number"))
            writer.writeheader()
            writer.writerows(rows)
        print(f"CSV written to {args.csv}")
    return 1 if failures and not rows else 0


if __name__ == "__main__":
    raise SystemExit(main())
