#!/usr/bin/env python3
"""Generate the Integration Roadmap & Sample Data Requirements PDF."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import os

OUTPUT = os.path.join(os.path.dirname(__file__), "Privexa-Integration-Roadmap.pdf")

BLUE = HexColor("#1a56db")
DARK = HexColor("#1f2937")
GREY = HexColor("#6b7280")
LIGHT_BG = HexColor("#f3f4f6")
WHITE = HexColor("#ffffff")
BORDER = HexColor("#d1d5db")

styles = getSampleStyleSheet()

sTitle = ParagraphStyle("DocTitle", parent=styles["Title"], fontSize=22, leading=28,
                        textColor=DARK, spaceAfter=4)
sSubtitle = ParagraphStyle("DocSubtitle", parent=styles["Normal"], fontSize=11,
                           leading=14, textColor=GREY, spaceAfter=20)
sH1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=16, leading=20,
                      textColor=BLUE, spaceBefore=24, spaceAfter=10)
sH2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, leading=16,
                      textColor=DARK, spaceBefore=16, spaceAfter=8)
sBody = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14,
                        textColor=DARK, spaceAfter=6)
sBullet = ParagraphStyle("Bullet", parent=sBody, leftIndent=16, bulletIndent=6,
                          spaceBefore=2, spaceAfter=2)
sSmall = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9, leading=12,
                         textColor=GREY)
sTableHead = ParagraphStyle("TH", parent=styles["Normal"], fontSize=9, leading=12,
                             textColor=WHITE, fontName="Helvetica-Bold")
sTableCell = ParagraphStyle("TC", parent=styles["Normal"], fontSize=9, leading=12,
                             textColor=DARK)

def heading(text):
    return Paragraph(text, sH1)

def subheading(text):
    return Paragraph(text, sH2)

def body(text):
    return Paragraph(text, sBody)

def bullet(text):
    return Paragraph(f"•  {text}", sBullet)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=12, spaceBefore=12)

def make_table(headers, rows, col_widths=None):
    data = [[Paragraph(h, sTableHead) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), sTableCell) for c in row])
    w = col_widths or [None] * len(headers)
    t = Table(data, colWidths=w, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BACKGROUND", (0, 1), (-1, -1), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
    ]))
    return t

story = []

# ── Title page ────────────────────────────────────────────────────────────────
story.append(Spacer(1, 40))
story.append(Paragraph("Cervical Screening Solution", sTitle))
story.append(Paragraph("Integration Roadmap &amp; Sample Data Requirements", ParagraphStyle(
    "Sub2", parent=sTitle, fontSize=15, leading=20, textColor=GREY)))
story.append(Spacer(1, 12))
story.append(Paragraph("Privexa  |  Confidential  |  May 2026", sSubtitle))
story.append(hr())

story.append(body(
    "This document outlines the integration requirements, sample data specifications, "
    "and phased roadmap for moving the cervical screening decision-support solution from "
    "its current manual-input prototype to a fully automated, dashboard-driven platform."
))
story.append(Spacer(1, 8))
story.append(body(
    "The goal is to validate the automated end-to-end workflow using a de-identified "
    "Excel-based sample dataset before committing to full HL7/FHIR integration development."
))

# ── Section 1: Current State vs Target State ──────────────────────────────────
story.append(heading("1. Current State vs Target State"))

story.append(subheading("Current State (Manual Input)"))
story.append(body(
    "The decision engine and clinical pathway logic are fully built and functional, "
    "covering 10 NCSP 2023 pathway figures. Currently, a user manually enters patient "
    "information and steps through screening questions one at a time to reach a pathway recommendation."
))

story.append(subheading("Target State (Automated Pipeline)"))
story.append(body(
    "In the final product, patient data flows in automatically from connected systems. "
    "The decision engine runs all rules in a single pass with no manual steps. "
    "Coordinators see a dashboard showing the recommendation, priority, and required "
    "actions for each patient. Only exception cases require human review."
))

story.append(Spacer(1, 8))
story.append(make_table(
    ["Phase", "Input", "Processing", "Output"],
    [
        ["Current (Manual)", "User enters patient data\nand answers questions", "Step-by-step wizard", "Single patient\nrecommendation"],
        ["POC (Excel)", "De-identified Excel\nworkbook uploaded", "Decision engine runs\nautomatically per row", "Dashboard with results\nfor all patients"],
        ["Production (HL7/FHIR)", "HL7v2 lab feed +\nFHIR/NCSR data", "Same decision engine,\nsame logic", "Same dashboard +\nalerts and audit trail"],
    ],
    col_widths=[80, 130, 130, 130],
))

# ── Section 2: POC Strategy ──────────────────────────────────────────────────
story.append(heading("2. Proof-of-Concept Strategy"))
story.append(body(
    "Before full HL7/FHIR integration, we propose using a de-identified Excel-based "
    "sample dataset that represents the same fields expected from live feeds. "
    "This Excel workbook acts as a temporary integration substitute, allowing us to "
    "validate the automated decision workflow and dashboard before live integration work begins."
))
story.append(Spacer(1, 4))
story.append(body("The approach reduces risk by proving the full automated workflow before waiting for complex hospital/lab integration access."))
story.append(Spacer(1, 4))

story.append(subheading("Phased Roadmap"))
story.append(Spacer(1, 4))
phases = [
    ["1. Manual Demo", "Complete", "Current state — step-by-step wizard with manual data entry"],
    ["2. Excel-based POC", "Next", "Ingest sample Excel, run engine automatically, display dashboard"],
    ["3. Dashboard Validation", "Planned", "Compare engine output against expected clinical recommendations"],
    ["4. HL7/FHIR Integration", "Planned", "Replace Excel input with live lab and registry feeds"],
    ["5. Production Workflow", "Planned", "Full automated pipeline with monitoring and audit"],
]
story.append(make_table(["Phase", "Status", "Description"], phases, col_widths=[110, 60, 300]))

# ── Section 3: Sample Data Requirements ───────────────────────────────────────
story.append(PageBreak())
story.append(heading("3. Sample Data Requirements"))
story.append(body(
    "We are requesting a de-identified or fictional sample dataset in Excel format. "
    "The workbook should contain the tabs described below. These fields map directly "
    "to the inputs consumed by the decision engine."
))

# Tab 1
story.append(subheading("Tab 1 — Patient Details"))
story.append(body("Basic patient-level demographic and eligibility data."))
story.append(make_table(
    ["Field", "Example Value", "Notes"],
    [
        ["Patient ID (dummy NHI)", "ABC1234", "Fictional identifier"],
        ["Date of Birth", "1985-02-10", "Used for age-based eligibility"],
        ["Gender / Sex", "Female", "Sex relevant to cervical screening"],
        ["Ethnicity (primary)", "21 (Māori)", "NZ Level 2 ethnicity code"],
        ["Enrolment Status", "Active", "Active / Inactive"],
        ["Immunocompromised", "No", "Yes / No — affects recall intervals"],
        ["Pregnant", "No", "Yes / No — triggers pregnancy pathway"],
        ["Hysterectomy Status", "None", "None / Total / Subtotal"],
        ["Hysterectomy Indication", "—", "Benign / HSIL-CIN2-3 / AIS (if applicable)"],
    ],
    col_widths=[130, 100, 240],
))

# Tab 2
story.append(subheading("Tab 2 — Current HPV / Cytology Result"))
story.append(body("Represents the latest lab result data (equivalent to HL7v2 OBX/ORU messages)."))
story.append(make_table(
    ["Field", "Example Value", "Allowed Values"],
    [
        ["Sample Date", "2026-05-01", "ISO date"],
        ["Sample Type", "LBC", "LBC / SWAB"],
        ["HPV Result", "HPV Other", "Not Detected / HPV 16-18 / HPV Other"],
        ["Cytology Result", "LSIL", "Negative / ASC-US / LSIL / ASC-H / HSIL / SCC / AIS / AG1–AG5 / AC1–AC4"],
        ["Result Status", "Final", "Final / Preliminary"],
        ["Lab Source", "Lab A", "Identifier for the originating laboratory"],
    ],
    col_widths=[110, 100, 260],
))

# Tab 3
story.append(subheading("Tab 3 — Screening &amp; Clinical History"))
story.append(body("History fields that influence pathway branching decisions."))
story.append(make_table(
    ["Field", "Example Value", "Allowed Values"],
    [
        ["First HPV Transition?", "Yes", "Yes / No — first HPV test after cytology-era screening"],
        ["Prior Screening History", "Negative or normal", "Negative-or-normal / Low-grade-returned / High-grade-TOC-complete / High-grade-TOC-incomplete / Previous AIS / Previous atypical glandular / No known history"],
        ["Previous Colposcopy", "Normal", "Normal / Abnormal / None"],
        ["Previous Treatment", "No", "Yes / No"],
        ["Test of Cure Status", "N/A", "Complete / Incomplete / N/A"],
        ["Last Screening Date", "2025-09-10", "ISO date"],
        ["Repeat Context", "Primary HPV", "Primary HPV / Post-normal-colposcopy-low-grade / Post-normal-colposcopy-high-grade / Test of Cure"],
        ["Repeat Stage", "Baseline", "Baseline / First repeat / Second repeat"],
        ["Abnormal Vaginal Bleeding", "No", "Yes / No"],
        ["Abnormal Cervix on Exam", "—", "Yes / No (if bleeding pathway)"],
    ],
    col_widths=[130, 100, 240],
))

# Tab 4
story.append(PageBreak())
story.append(subheading("Tab 4 — Colposcopy Findings (if applicable)"))
story.append(body("Required only for cases that have attended colposcopy."))
story.append(make_table(
    ["Field", "Example Value", "Allowed Values"],
    [
        ["TZ Type", "Type 1", "Type 1 / Type 2 / Type 3"],
        ["Colposcopic Impression", "LSIL", "Normal / LSIL / HSIL / AIS / Invasion / Unsatisfactory"],
        ["Visible Lesion", "Yes", "Yes / No"],
        ["Biopsy Taken", "Yes", "Yes / No"],
        ["Histology Result", "CIN1", "Normal / CIN1 / CIN2 / CIN3 / AIS / SCC / Adenocarcinoma / Unsatisfactory"],
        ["MDM Outcome", "—", "Excision / Ablation / Surveillance / Referral / Downgraded (if applicable)"],
    ],
    col_widths=[130, 100, 240],
))

# Tab 5
story.append(subheading("Tab 5 — Expected Recommendation (Validation)"))
story.append(body(
    "This tab is critical for validating the decision engine. Each row should include "
    "the clinically expected recommendation so we can compare engine output against clinical judgement."
))
story.append(make_table(
    ["Field", "Example Value", "Notes"],
    [
        ["Patient ID", "ABC1234", "Links to patient in Tab 1"],
        ["Expected Pathway", "Repeat HPV in 12 months", "The clinically correct recommendation"],
        ["Expected Priority", "Routine", "Routine / Urgent / P1 / P2 / P3"],
        ["Reviewer Notes", "Standard HPV Other + negative cytology case", "Any clinical context or reasoning"],
    ],
    col_widths=[120, 140, 210],
))

# ── Section 4: Sample Case Mix ────────────────────────────────────────────────
story.append(heading("4. Recommended Sample Case Mix"))
story.append(body(
    "We recommend at least 30–50 sample cases covering a range of scenarios "
    "to thoroughly validate the decision engine across all major pathways."
))
story.append(Spacer(1, 4))
story.append(make_table(
    ["Category", "Suggested Count", "Examples"],
    [
        ["Normal / routine cases", "10–15", "HPV negative, routine recall"],
        ["HPV Other + cytology variants", "8–10", "HPV Other with negative, LSIL, HSIL cytology"],
        ["HPV 16/18 cases", "3–5", "Direct colposcopy referral cases"],
        ["High-grade / urgent cases", "3–5", "HSIL, AIS, SCC, invasion suspected"],
        ["Post-treatment / Test of Cure", "3–5", "First and second follow-up co-tests"],
        ["Post-hysterectomy", "2–3", "Total and subtotal, various indications"],
        ["Pregnancy pathway", "2–3", "High-grade cytology during pregnancy"],
        ["Abnormal bleeding", "2–3", "With and without cancer symptoms"],
        ["Glandular abnormalities", "2–3", "AG1–AG5, AC categories"],
        ["Immunocompromised", "2–3", "Modified recall intervals"],
        ["Edge / complex cases", "3–5", "Transition pathway, unknown history, swab return visit"],
    ],
    col_widths=[140, 80, 250],
))

# ── Section 5: Integration Requirements ──────────────────────────────────────
story.append(PageBreak())
story.append(heading("5. Integration Requirements (Future Phases)"))

story.append(subheading("HL7v2 Lab Ingest (OBX/ORU)"))
story.append(body("Auto-ingest cytology and HPV results from laboratory feeds."))
story.append(bullet("HL7 version and message types (ORU^R01, OBX segments)"))
story.append(bullet("Transport method (MLLP, SFTP, API)"))
story.append(bullet("Lab feed source (Labnet, individual DHB labs)"))
story.append(bullet("Test/sandbox environment access"))
story.append(bullet("Expected daily message volume"))

story.append(subheading("FHIR R4 Export"))
story.append(body("Interoperability with DHB and hospital systems."))
story.append(bullet("FHIR resources: Observation, DiagnosticReport, ServiceRequest"))
story.append(bullet("FHIR sandbox endpoint and credentials"))
story.append(bullet("Authentication model (OAuth2, API keys, client certificates)"))

story.append(subheading("NCSR (National Cervical Screening Register)"))
story.append(body("Query screening history and submit results."))
story.append(bullet("Sandbox access and credentials"))
story.append(bullet("MoU (Memorandum of Understanding) requirements"))
story.append(bullet("Pull (query history) and push (submit results) capabilities"))

story.append(subheading("NHI / HPI Validation"))
story.append(body("Patient and provider identity validation."))
story.append(bullet("NHI lookup API access for patient validation"))
story.append(bullet("HPI facility/provider lookup"))

# ── Section 6: What We Need ──────────────────────────────────────────────────
story.append(heading("6. What We Need from Integration Partners"))
story.append(make_table(
    ["Item", "Purpose", "Timeline"],
    [
        ["De-identified Excel sample dataset\n(30–50 cases, structure per Section 3)", "Build and validate automated\nworkflow + dashboard", "Immediate —\nnext 2 weeks"],
        ["Data dictionary", "Map field meanings and\nallowed values", "With sample dataset"],
        ["HL7v2 sandbox + sample messages", "Build and test lab ingest parser", "Phase 4"],
        ["FHIR R4 sandbox endpoint + credentials", "Build export / interop layer", "Phase 4"],
        ["NCSR sandbox access + MoU", "Query and push screening data", "Phase 4"],
        ["NHI / HPI API access", "Patient and provider validation", "Phase 4"],
        ["Technical contact for testing", "Troubleshooting during\nintegration development", "Ongoing"],
    ],
    col_widths=[160, 160, 90],
))

# ── Section 7: Questions to Resolve ──────────────────────────────────────────
story.append(heading("7. Questions to Resolve"))
story.append(body("The following questions should be addressed in the integration planning meeting:"))
story.append(Spacer(1, 4))

questions = [
    "What HL7 version do the labs use? (v2.3, v2.4, v2.5?)",
    "Which HL7 message types are sent — ORU^R01 for results? OBX segments for HPV/cytology?",
    "Is there a Labnet feed available, or do individual DHB labs send separately?",
    "What transport method is used — MLLP, SFTP, or API?",
    "Is FHIR R4 in use? Which resources — Observation, DiagnosticReport, ServiceRequest?",
    "Is there a FHIR sandbox endpoint available for development?",
    "What authentication model is required — OAuth2, API keys, or client certificates?",
    "What is the process for NCSR sandbox access and credentials?",
    "Is a Memorandum of Understanding (MoU) required before integration?",
    "Can we both query screening history (pull) and submit results (push) to NCSR?",
    "Can we get NHI lookup access for patient validation?",
    "What are the data residency requirements? (NZ-hosted only?)",
    "Are specific security certifications required? (HISO, ISO 27001?)",
    "Who signs off on integration go-live?",
    "What is the realistic timeline for providing sandbox access?",
]
for i, q in enumerate(questions, 1):
    story.append(bullet(f"{q}"))

# ── Section 8: Cost Estimate ──────────────────────────────────────────────────
story.append(PageBreak())
story.append(heading("8. Integration Cost Estimate"))
story.append(body(
    "The following estimates cover the HL7/FHIR integration layer development "
    "(Phase 4 onward). The POC phase using Excel-based data is included in the "
    "current development scope."
))
story.append(Spacer(1, 4))
story.append(make_table(
    ["", "Option A — Lean", "Option B — Standard", "Option C — Accelerated"],
    [
        ["Timeline", "12 weeks (1 dev)", "10 weeks (2 devs)", "8 weeks (2–3 devs)"],
        ["Dev Hours", "~400 hrs", "~500 hrs", "~600 hrs"],
        ["Dev Cost", "$100K", "$125K", "$150K"],
        ["Overheads (20%)", "$20K", "$25K", "$30K"],
        ["Profit (25%)", "$30K", "$37.5K", "$45K"],
        ["Total", "$150K", "$187.5K", "$225K"],
    ],
    col_widths=[100, 120, 120, 130],
))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "Note: Estimates are indicative and subject to refinement based on integration "
    "complexity, sandbox availability, and partner coordination timelines.",
    sSmall,
))

# ── Footer ────────────────────────────────────────────────────────────────────
story.append(Spacer(1, 30))
story.append(hr())
story.append(Paragraph(
    "Privexa  ·  Confidential  ·  May 2026  ·  info@privexa.co",
    ParagraphStyle("Footer", parent=sSmall, alignment=TA_CENTER),
))

# ── Build ─────────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=20 * mm,
    rightMargin=20 * mm,
    topMargin=20 * mm,
    bottomMargin=20 * mm,
    title="Privexa - Integration Roadmap",
    author="Privexa",
)
doc.build(story)
print(f"PDF generated: {OUTPUT}")
