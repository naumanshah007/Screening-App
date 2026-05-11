#!/usr/bin/env python3

from __future__ import annotations

import csv
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "docs" / "requirements-discovery-pack"
OUTPUT_PATH = PACK_DIR / "requirements-discovery-pack.pdf"

CSV_FILES = [
    ("1. Current Understanding", PACK_DIR / "01-current-understanding.csv"),
    ("2. Clinical Validation", PACK_DIR / "02-clinical-validation.csv"),
    ("3. Workflow And Operations", PACK_DIR / "03-workflow-and-operations.csv"),
    (
        "4. Technical, Integration, AI, And Hosting",
        PACK_DIR / "04-technical-integration-ai-hosting.csv",
    ),
    ("5. Decisions And Owners", PACK_DIR / "05-decisions-and-owners.csv"),
]


def load_csv_rows(path: Path) -> list[list[str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        return [row for row in reader]


def build_table(title: str, path: Path, styles: dict[str, ParagraphStyle]):
    rows = load_csv_rows(path)
    if not rows:
        return []

    header = rows[0]
    body = rows[1:]

    paragraph_rows = [
        [Paragraph(cell or "", styles["table_header"]) for cell in header]
    ]
    paragraph_rows.extend(
        [
            [Paragraph((cell or "").replace("\n", "<br/>"), styles["table_cell"]) for cell in row]
            for row in body
        ]
    )

    available_width = landscape(A3)[0] - (20 * mm) - (20 * mm)
    column_width = available_width / max(len(header), 1)
    col_widths = [column_width] * len(header)

    table = LongTable(
        paragraph_rows,
        colWidths=col_widths,
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

    return [
        Paragraph(title, styles["section_title"]),
        Spacer(1, 4 * mm),
        Paragraph(str(path.name), styles["meta"]),
        Spacer(1, 4 * mm),
        table,
    ]


def main():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="title_large",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="subtitle_center",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="section_title",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="body_small",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="meta",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#64748b"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="table_header",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=colors.white,
        )
    )
    styles.add(
        ParagraphStyle(
            name="table_cell",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=6.4,
            leading=8,
            textColor=colors.HexColor("#0f172a"),
        )
    )

    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=landscape(A3),
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=16 * mm,
        bottomMargin=14 * mm,
        title="Women’s Health Requirements Discovery Pack",
        author="Nauman",
    )

    story = [
        Spacer(1, 10 * mm),
        Paragraph("Women’s Health Requirements Discovery Pack", styles["title_large"]),
        Paragraph(
            "Colposcopy and Gynaecology Referral Grading",
            styles["subtitle_center"],
        ),
        Paragraph(
            f"Prepared from the email provided by Dr Jasveen Kaur and the three attached reference files. Generated on {date.today().isoformat()}.",
            styles["subtitle_center"],
        ),
        Spacer(1, 8 * mm),
        Paragraph("Purpose", styles["section_title"]),
        Paragraph(
            "This handout is intended for a requirement-gathering session. It is prefilled with current understanding so the clinical, operational, and technical stakeholders can confirm, correct, or extend the assumptions.",
            styles["body_small"],
        ),
        Spacer(1, 3 * mm),
        Paragraph("How To Use", styles["section_title"]),
        Paragraph(
            "1. Review the assumptions in order. 2. Mark each item as confirmed, changed, unknown, or out of scope. 3. Record the owner for each unresolved area. 4. Use the final decisions sheet to identify who will validate colposcopy, gynaecology, workflow, and technical integration questions.",
            styles["body_small"],
        ),
        Spacer(1, 3 * mm),
        Paragraph("Included Sections", styles["section_title"]),
        Paragraph(
            "1. Current understanding  •  2. Clinical validation  •  3. Workflow and operations  •  4. Technical, integration, AI, and hosting  •  5. Decisions and owners",
            styles["body_small"],
        ),
    ]

    for index, (title, path) in enumerate(CSV_FILES):
        story.append(PageBreak())
        story.extend(build_table(title, path, styles))

    doc.build(story)
    print(f"Generated {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
