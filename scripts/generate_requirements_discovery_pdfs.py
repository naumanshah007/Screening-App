#!/usr/bin/env python3

from __future__ import annotations

import csv
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A3, A4, landscape
from reportlab.lib.styles import ParagraphStyle, StyleSheet1, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle


ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "docs" / "requirements-discovery-pack"

FILE_CONFIGS = [
    {
        "title": "Current Understanding",
        "input": PACK_DIR / "01-current-understanding.csv",
        "output": PACK_DIR / "01-current-understanding.pdf",
        "pagesize": landscape(A3),
        "body_size": 7.0,
        "header_size": 8.0,
        "description": "Please review each line and confirm, correct, or add anything that is missing.",
    },
    {
        "title": "Clinical Validation",
        "input": PACK_DIR / "02-clinical-validation.csv",
        "output": PACK_DIR / "02-clinical-validation.pdf",
        "pagesize": landscape(A3),
        "body_size": 6.8,
        "header_size": 7.8,
        "description": "Please mark whether you agree with each interpretation of the attached guideline and amend anything that does not match local practice.",
    },
    {
        "title": "Workflow And Operations",
        "input": PACK_DIR / "03-workflow-and-operations.csv",
        "output": PACK_DIR / "03-workflow-and-operations.pdf",
        "pagesize": landscape(A4),
        "body_size": 8.0,
        "header_size": 9.0,
        "description": "Please confirm how the service should work in practice, especially where the process differs from the written guideline.",
    },
    {
        "title": "Technical, Integration, AI, And Hosting",
        "input": PACK_DIR / "04-technical-integration-ai-hosting.csv",
        "output": PACK_DIR / "04-technical-integration-ai-hosting.pdf",
        "pagesize": landscape(A3),
        "body_size": 6.8,
        "header_size": 7.8,
        "description": "Please confirm what is already known and fill in any technical, integration, or governance decisions that are still outstanding.",
    },
    {
        "title": "Decisions And Owners",
        "input": PACK_DIR / "05-decisions-and-owners.csv",
        "output": PACK_DIR / "05-decisions-and-owners.pdf",
        "pagesize": landscape(A4),
        "body_size": 8.2,
        "header_size": 9.2,
        "description": "Please use this sheet to record the remaining decisions and who will own each one.",
    },
    {
        "title": "Colposcopy Detailed Rule Review",
        "input": PACK_DIR / "06-colposcopy-detailed-rule-review.csv",
        "output": PACK_DIR / "06-colposcopy-detailed-rule-review.pdf",
        "pagesize": landscape(A3),
        "body_size": 6.5,
        "header_size": 7.6,
        "description": "These are working notes for the colposcopy booking rules. Please mark anything that differs from local practice.",
    },
    {
        "title": "Gynaecology Detailed Rule Review",
        "input": PACK_DIR / "07-gynaecology-detailed-rule-review.csv",
        "output": PACK_DIR / "07-gynaecology-detailed-rule-review.pdf",
        "pagesize": landscape(A3),
        "body_size": 6.5,
        "header_size": 7.6,
        "description": "These are working notes for the gynaecology grading rules. Please mark anything that differs from local practice.",
    },
]


def load_csv_rows(path: Path) -> list[list[str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.reader(handle))


def create_styles(body_size: float, header_size: float) -> StyleSheet1:
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="doc_title",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="doc_subtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="doc_description",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#334155"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="table_header_custom",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=header_size,
            leading=header_size + 2,
            textColor=colors.white,
        )
    )
    styles.add(
        ParagraphStyle(
            name="table_cell_custom",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=body_size,
            leading=body_size + 1.6,
            textColor=colors.HexColor("#0f172a"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="doc_meta",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#64748b"),
        )
    )
    return styles


def estimate_col_widths(rows: list[list[str]], available_width: float) -> list[float]:
    header = rows[0]
    sample_rows = rows[1:16]
    weights: list[float] = []

    for index, heading in enumerate(header):
        max_len = len(heading) * 1.25
        for row in sample_rows:
            if index < len(row):
                max_len = max(max_len, min(len(row[index]), 80))

        weight = max(10.0, min(max_len, 34.0))
        weights.append(weight)

    total_weight = sum(weights) or 1.0
    widths = [(weight / total_weight) * available_width for weight in weights]

    min_width = available_width / len(header) * 0.55
    widths = [max(width, min_width) for width in widths]

    current_total = sum(widths)
    if current_total > 0:
        scale = available_width / current_total
        widths = [width * scale for width in widths]

    return widths


def build_table(rows: list[list[str]], styles: StyleSheet1, available_width: float) -> LongTable:
    paragraph_rows: list[list[Paragraph]] = []
    for row_index, row in enumerate(rows):
        style_name = "table_header_custom" if row_index == 0 else "table_cell_custom"
        paragraph_rows.append(
            [
                Paragraph((cell or "").replace("\n", "<br/>"), styles[style_name])
                for cell in row
            ]
        )

    table = LongTable(
        paragraph_rows,
        colWidths=estimate_col_widths(rows, available_width),
        repeatRows=1,
        splitByRow=1,
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def render_pdf(config: dict[str, object]) -> None:
    input_path = config["input"]
    output_path = config["output"]
    pagesize = config["pagesize"]
    title = config["title"]
    description = config["description"]
    body_size = config["body_size"]
    header_size = config["header_size"]

    rows = load_csv_rows(input_path)
    styles = create_styles(body_size=body_size, header_size=header_size)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=pagesize,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=12 * mm,
        title=f"Women’s Health Requirements Discovery Pack — {title}",
        author="Nauman",
    )

    available_width = pagesize[0] - doc.leftMargin - doc.rightMargin

    story = [
        Paragraph("Women’s Health Requirements Discovery Pack", styles["doc_title"]),
        Paragraph(title, styles["doc_subtitle"]),
        Paragraph(description, styles["doc_description"]),
        Spacer(1, 4 * mm),
        Paragraph("Prepared for requirement discussion.", styles["doc_meta"]),
        Spacer(1, 5 * mm),
        build_table(rows, styles, available_width),
    ]

    doc.build(story)
    print(f"Generated {output_path}")


def main() -> None:
    for config in FILE_CONFIGS:
        render_pdf(config)


if __name__ == "__main__":
    main()
