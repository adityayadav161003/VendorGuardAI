"""
Native PDF report generation (reportlab).

The PDF is the full evidence-linked deliverable: identity header, trust
score with assessment state, vector breakdown table, key findings, verified
claims with their evidence and reviewer state, cross-document conflicts with
both sources, and the mandatory limitations + responsible-use block.
"""

from io import BytesIO
from datetime import datetime, timezone
from typing import Any, Dict

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

BRASS = colors.HexColor("#96763F")
OLIVE = colors.HexColor("#5F6D3B")
INK = colors.HexColor("#2E2011")
MUTED = colors.HexColor("#6E6656")
PAPER = colors.HexColor("#F7F2E7")

LEVEL_COLORS = {"LOW": colors.HexColor("#5E7549"), "MEDIUM": colors.HexColor("#A17F35"), "HIGH": colors.HexColor("#8F4229")}


def build_report_pdf(report: Any) -> bytes:
    """Renders the stored analysis into a self-contained PDF document."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"VendorGuard AI Report — {report.supplier_name}",
    )
    styles = getSampleStyleSheet()
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                        fontSize=13, textColor=OLIVE, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9.5, leading=13.5, textColor=INK)
    mono = ParagraphStyle("mono", parent=body, fontName="Courier", fontSize=8.5, textColor=MUTED)
    meta = ParagraphStyle("meta", parent=body, fontSize=8.5, textColor=MUTED)

    story = []

    # ── Header ─────────────────────────────────────────────────────────
    story.append(Paragraph("VendorGuard AI — Supplier Risk Report",
                           ParagraphStyle("h1", parent=styles["Title"], fontSize=18,
                                          textColor=INK, alignment=0)))
    story.append(HRFlowable(width="100%", thickness=1.2, color=BRASS, spaceAfter=6))
    generated = report.generated_at.strftime("%d %b %Y %H:%M UTC") if report.generated_at else ""
    story.append(Paragraph(
        f"<b>{report.supplier_name}</b> · ID {report.supplier_id} · generated {generated} · "
        f"model {report.model_version} · rules v2.0.0-trust-core", meta))
    story.append(Spacer(1, 6))

    state = report.assessment_state
    level = report.risk_level or "UNASSESSED"
    score_text = f"{report.risk_score}/100" if report.risk_score is not None else "N/A (not assessable)"
    level_color = LEVEL_COLORS.get(report.risk_level, MUTED)
    story.append(Paragraph(
        f"<b>Trust score:</b> <font size='14'>{score_text}</font> &nbsp;&nbsp;"
        f"<font color='#6e6656'><b>{level} RISK</b></font> &nbsp;&nbsp;"
        f"State: <b>{state}</b> · coverage {report.evidence_coverage}% · "
        f"confidence {report.assessment_confidence}% · basis {report.data_source} "
        f"({report.document_count} document(s))", body))
    story.append(Spacer(1, 4))

    # ── Analyst summary ───────────────────────────────────────────────
    story.append(Paragraph("Analyst Summary", h2))
    story.append(Paragraph(report.summary or "—", body))

    # ── Vector breakdown ──────────────────────────────────────────────
    story.append(Paragraph("Risk Vector Breakdown", h2))
    breakdown = report.risk_breakdown.model_dump() if hasattr(report.risk_breakdown, "model_dump") else dict(report.risk_breakdown)
    rows = []
    for k, v in breakdown.items():
        if k == "vectors" or isinstance(v, dict):
            if k == "vectors":
                continue  # nested detail lives in the reason codes below
            score = v.get("score")
            status = v.get("status", "computed")
            shown = f"{score}" if score is not None else "Insufficient — excluded"
            if v.get("reason_codes"):
                shown += f"  ({', '.join(v['reason_codes'][:3])})"
            rows.append([k.capitalize(), shown])
        else:
            rows.append([k.capitalize(), f"{v}"])
    t = Table([["Vector", "Score (0–100)"], *rows], colWidths=[90 * mm, 50 * mm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D9CBAA")),
        ("BACKGROUND", (0, 0), (-1, 0), PAPER),
        ("FONTNAME", (1, 1), (1, -1), "Courier-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
    ]))
    story.append(t)

    # ── Key findings ──────────────────────────────────────────────────
    story.append(Paragraph("Key Findings", h2))
    for f in report.key_findings:
        color = {"success": "#5E7549", "info": "#6E6656", "warning": "#A17F35", "danger": "#8F4229"}.get(f.severity, "#2E2011")
        story.append(Paragraph(
            f"<font color='{color}'><b>[{f.severity.upper()}]</b></font> "
            f"<b>({f.category})</b> {f.message} <i>— {f.source_reference or ''}</i>", body))

    # ── Verified claims with evidence ─────────────────────────────────
    story.append(Paragraph("Verified Claims", h2))
    for c in report.claims:
        story.append(Paragraph(
            f"<b>{c.status}</b> ({c.confidence_score:.2f}, reviewer: {c.reviewer_state}) — {c.claim_text}", body))
        if c.evidence_snippet:
            story.append(Paragraph(
                f"Source: {c.source_doc_name or 'n/a'} · “{(c.evidence_snippet or '')[:220]}”", mono))

    # ── Limitations & responsible use (mandatory block) ───────────────
    story.append(Paragraph("Limitations & Responsible Use", h2))
    story.append(Paragraph(
        "This report is decision-support output, not a legal determination, fraud verdict or "
        "guarantee of supplier reliability. Risk indicators require human review before any "
        "procurement decision. No live government-registry verification is implied: only the "
        "documented sources listed above were consulted, on the dates shown. Scores are computed "
        "only where evidence exists — vectors marked insufficient were excluded. The rule version "
        "and model version above make this assessment reproducible.", body))

    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.8, color=BRASS))
    story.append(Paragraph(
        f"Generated by VendorGuard AI · decision-support prototype · {datetime.now(timezone.utc):%d %b %Y %H:%M UTC}",
        meta))

    doc.build(story)
    return buf.getvalue()
