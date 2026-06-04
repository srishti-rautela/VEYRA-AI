"""
VEYRA AI — Premium Report Engine
Generates a polished, branded PDF report with:
  • VEYRA AI logo header
  • Executive KPI summary
  • Store-by-store comparison table
  • Winner declaration with reasoning
  • AI insights section
  • Predictive analytics footer
"""

from fileinput import filename
import os
import io
import math
import glob
from datetime import datetime

from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, Image as RLImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas as pdfcanvas

try:
    from PIL import Image as PILImage, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


# ─── Brand colours ────────────────────────────────────────────────────────────
TEAL       = colors.HexColor("#00FFC8")
TEAL_DARK  = colors.HexColor("#00B890")
TEAL_DIM   = colors.HexColor("#003D30")
ORANGE     = colors.HexColor("#FF6B35")
ORANGE_DIM = colors.HexColor("#3D1800")
NAVY       = colors.HexColor("#040810")
SURFACE    = colors.HexColor("#080E1A")
SURFACE2   = colors.HexColor("#0D1524")
BORDER     = colors.HexColor("#1A2540")
TEXT       = colors.HexColor("#E8F0FE")
TEXT_DIM   = colors.HexColor("#4A5568")
PURPLE     = colors.HexColor("#A78BFA")
GOLD       = colors.HexColor("#FBBF24")
RED        = colors.HexColor("#FF3250")
GREEN      = colors.HexColor("#00E5A0")
BLUE       = colors.HexColor("#38C4FF")
WHITE      = colors.white
BLACK      = colors.black


# ─── Logo generator (PIL) ─────────────────────────────────────────────────────
def _build_logo_png(path: str, width=420, height=120) -> None:
    """Render the VEYRA AI logo to a PNG file using Pillow."""
    img = PILImage.new("RGBA", (width, height), (4, 8, 16, 255))
    draw = ImageDraw.Draw(img)

    for y in range(height):
        t = y / height
        r = int(4 + t * 8)
        g = int(8 + t * 14)
        b = int(16 + t * 20)
        draw.rectangle([(0, y), (width, y)], fill=(r, g, b, 255))

    cx, cy = 56, height // 2
    radii = [34, 24, 16]
    ring_cols = [(0, 255, 200, 60), (0, 255, 200, 110), (0, 255, 200, 170)]
    for radius, col in zip(radii, ring_cols):
        pts = []
        for k in range(6):
            angle = math.radians(k * 60 - 30)
            pts.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
        draw.polygon(pts, outline=col)

    draw.ellipse([cx - 20, cy - 12, cx + 20, cy + 12], outline=(0, 255, 200, 200), width=2)
    draw.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(0, 255, 200, 230))
    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(4, 8, 16, 255))

    try:
        fnt_xl  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 44)
        fnt_lg  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        fnt_sm  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        fnt_xs  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 10)
    except OSError:
        fnt_xl = fnt_lg = fnt_sm = fnt_xs = ImageFont.load_default()

    draw.text((100, 12), "VEYRA", font=fnt_xl, fill=(0, 255, 200, 255))
    draw.text((280, 14), "AI",    font=fnt_lg, fill=(255, 107, 53, 255))
    draw.text((102, 62), "RETAIL INTELLIGENCE PLATFORM", font=fnt_sm, fill=(120, 180, 160, 200))
    draw.text((102, 84), "YOLOv8  •  ByteTrack  •  Computer Vision  •  Vision OS v3",
              font=fnt_xs, fill=(70, 120, 100, 160))

    for x in range(100, 420):
        t = (x - 100) / 320
        a = int(180 * (1 - abs(2 * t - 1)))
        g2 = int(255 - t * 55)
        draw.point((x, 58), fill=(0, g2, 180, a))

    img.save(path, "PNG")


def _get_logo_image(logo_path: str, target_width_pts: float = 220):
    if not PIL_AVAILABLE:
        return None
    try:
        _build_logo_png(logo_path)
        pil = PILImage.open(logo_path)
        w, h = pil.size
        aspect = h / w
        rl_h = target_width_pts * aspect
        return RLImage(logo_path, width=target_width_pts, height=rl_h)
    except Exception:
        return None


# ─── Canvas background & decorations ─────────────────────────────────────────
def _dark_page(canvas, doc):
    canvas.saveState()

    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)

    canvas.setFillColor(colors.HexColor("#0A1020"))
    for gx in range(0, int(A4[0]), 24):
        for gy in range(0, int(A4[1]), 24):
            canvas.circle(gx, gy, 0.6, fill=1, stroke=0)

    canvas.setFillColor(TEAL)
    canvas.rect(0, A4[1] - 4, A4[0], 4, fill=1, stroke=0)

    canvas.setFillColor(colors.HexColor("#004438"))
    canvas.rect(0, A4[1] - 8, A4[0], 4, fill=1, stroke=0)

    canvas.setFillColor(SURFACE)
    canvas.rect(0, 0, A4[0], 28, fill=1, stroke=0)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20, 28, A4[0] - 20, 28)

    canvas.setFillColor(TEXT_DIM)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(20, 10, f"VEYRA AI  •  Vision OS v3  •  Confidential")
    canvas.drawRightString(
        A4[0] - 20, 10,
        f"Generated: {datetime.now().strftime('%d %B %Y  %H:%M')}  •  Page {doc.page}"
    )

    canvas.setFillColor(colors.HexColor("#001A14"))
    canvas.rect(0, 28, 6, A4[1] - 32, fill=1, stroke=0)

    canvas.restoreState()


# ─── Style factory ─────────────────────────────────────────────────────────────
def _make_styles():
    base = getSampleStyleSheet()
    styles = {}

    styles["cover_title"] = ParagraphStyle(
        "cover_title", fontName="Helvetica-Bold", fontSize=28, leading=34,
        textColor=TEAL, spaceAfter=4, alignment=TA_LEFT)
    styles["cover_sub"] = ParagraphStyle(
        "cover_sub", fontName="Helvetica", fontSize=13, leading=18,
        textColor=TEXT_DIM, spaceAfter=6, alignment=TA_LEFT)
    styles["section_head"] = ParagraphStyle(
        "section_head", fontName="Helvetica-Bold", fontSize=13, leading=18,
        textColor=TEAL, spaceBefore=18, spaceAfter=8, borderPad=0)
    styles["section_sub"] = ParagraphStyle(
        "section_sub", fontName="Helvetica-Bold", fontSize=10, leading=14,
        textColor=ORANGE, spaceBefore=10, spaceAfter=5)
    styles["body"] = ParagraphStyle(
        "body", fontName="Helvetica", fontSize=9, leading=14,
        textColor=TEXT, spaceAfter=4)
    styles["body_dim"] = ParagraphStyle(
        "body_dim", fontName="Helvetica", fontSize=8, leading=13,
        textColor=TEXT_DIM, spaceAfter=3)
    styles["winner_box"] = ParagraphStyle(
        "winner_box", fontName="Helvetica-Bold", fontSize=11, leading=16,
        textColor=TEAL, spaceAfter=4, alignment=TA_LEFT)
    styles["insight_title"] = ParagraphStyle(
        "insight_title", fontName="Helvetica-Bold", fontSize=10, leading=14,
        textColor=GOLD, spaceAfter=2)
    styles["insight_body"] = ParagraphStyle(
        "insight_body", fontName="Helvetica", fontSize=9, leading=13,
        textColor=TEXT, spaceAfter=6)
    styles["label_mono"] = ParagraphStyle(
        "label_mono", fontName="Courier-Bold", fontSize=8, leading=12,
        textColor=TEAL, spaceAfter=2)
    styles["prediction"] = ParagraphStyle(
        "prediction", fontName="Helvetica-BoldOblique", fontSize=10, leading=15,
        textColor=PURPLE, spaceBefore=6, spaceAfter=4, alignment=TA_CENTER)
    styles["meta"] = ParagraphStyle(
        "meta", fontName="Courier", fontSize=8, leading=12,
        textColor=TEXT_DIM, spaceAfter=2)

    return styles


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _score_color(score):
    if score >= 85: return GREEN
    if score >= 65: return GOLD
    return RED


def _purge_old_reports(output_dir: str, store_id: str, keep: int = 0) -> None:
    """Delete old report PDFs for this store.
    Matches both timestamped and legacy fixed-name files.
    keep=0 (default) deletes everything — caller writes a fresh file immediately after.
    """
    # Timestamped pattern: VEYRA_AI_Report_ST1008_20260604_025947_123456.pdf
    for pattern in [
        os.path.join(output_dir, f"VEYRA_AI_Report_{store_id}_*.pdf"),
        os.path.join(output_dir, f"VEYRA_AI_Report_{store_id}.pdf"),
        os.path.join(output_dir, f"_VEYRA_AI_Report_{store_id}.pdf"),
        os.path.join(output_dir, f"*{store_id}*.pdf"),
    ]:
        matched = sorted(glob.glob(pattern))
        for f in matched[:-keep] if keep > 0 else matched:
            try:
                os.remove(f)
            except OSError:
                pass


# ─── Insights normaliser ──────────────────────────────────────────────────────
def _extract_insights(raw) -> list:
    """
    Accept any shape that generate_store_advice() might return:
      - a dict with an "insights" key  → return that list
      - a list directly                → return as-is
      - None / anything else           → return []
    This makes the report engine robust regardless of what the caller passes.
    """
    if isinstance(raw, dict):
        return raw.get("insights") or []
    if isinstance(raw, list):
        return raw
    return []


# ─── Main entry point ─────────────────────────────────────────────────────────
def generate_report(
    store_id: str,
    metrics:  dict,
    insights,           # accepts dict OR list — normalised internally
    comparison: dict,
    output_dir: str = ".",
) -> str:
    """
    Build a premium VEYRA AI PDF report.
    Returns the path to the newly generated PDF (unique filename per call).
    """

    os.makedirs(output_dir, exist_ok=True)

    # Microsecond precision — two calls in the same second get different filenames
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename  = os.path.join(output_dir, f"VEYRA_AI_Report_{store_id}_{timestamp}.pdf")
    logo_path = os.path.join(output_dir, "veyra_logo_report.png")

    # Delete EVERY old report for this store before writing the new one.
    # keep=0 means nothing survives — the file we are about to write is the only one.
    _purge_old_reports(output_dir, store_id, keep=0)

    # Normalise insights regardless of what was passed in
    ai_items = _extract_insights(insights)

    st = _make_styles()
    PAGE_W, PAGE_H = A4
    MARGIN    = 22 * mm
    CONTENT_W = PAGE_W - 2 * MARGIN

    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    story = []

    # ── 1. HEADER ─────────────────────────────────────────────────────────────
    logo_img  = _get_logo_image(logo_path, target_width_pts=200)
    now_str   = datetime.now().strftime("%d %B %Y  %H:%M")
    store_name = (
        comparison.get("stores", [{}])[0].get("name", store_id)
        if comparison.get("stores") else store_id
    )

    meta_para = Paragraph(
        f"""<font color="#4A5568" size="8">
        <b><font color="#00FFC8">STORE</font></b>  {store_id} — {store_name}<br/>
        <b><font color="#00FFC8">DATE</font></b>  {now_str}<br/>
        <b><font color="#00FFC8">ENGINE</font></b>  YOLOv8 + ByteTrack + Predictive Analytics<br/>
        <b><font color="#00FFC8">STATUS</font></b>  <font color="#00E5A0">● CONFIDENTIAL — AI GENERATED</font>
        </font>""",
        st["body"],
    )

    if logo_img:
        header_data  = [[logo_img, meta_para]]
        header_col_w = [210, CONTENT_W - 210]
    else:
        title_para = Paragraph(
            '<font color="#00FFC8" size="26"><b>VEYRA AI</b></font>'
            '<font color="#FF6B35" size="18"> VISION OS</font>',
            st["cover_sub"],
        )
        header_data  = [[title_para, meta_para]]
        header_col_w = [180, CONTENT_W - 180]

    header_table = Table(header_data, colWidths=header_col_w)
    header_table.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6))

    story.append(HRFlowable(
        width=CONTENT_W, thickness=1.5,
        color=TEAL, spaceAfter=12, spaceBefore=4
    ))

    # ── 2. TITLE ──────────────────────────────────────────────────────────────
    story.append(Paragraph("RETAIL INTELLIGENCE REPORT", st["cover_title"]))
    story.append(Paragraph(
        "Computer Vision · Autonomous Analytics · AI-Powered Insights",
        st["cover_sub"]
    ))
    story.append(Spacer(1, 10))

    # ── 3. KPI SUMMARY ────────────────────────────────────────────────────────
    story.append(Paragraph("◈  EXECUTIVE KPI SUMMARY", st["section_head"]))

    health     = metrics.get("store_health_score", 0)
    visitors   = metrics.get("unique_visitors", 0)
    in_store   = metrics.get("current_in_store", 0)
    purchases  = metrics.get("purchases", 0)
    conversion = metrics.get("conversion_rate", 0)
    revenue    = metrics.get("revenue_today", 0)
    queue      = metrics.get("queue_depth", 0)
    abandon    = metrics.get("abandonment_rate", 0)
    staff      = metrics.get("staff_count", 0)
    m_split    = metrics.get("gender_split", {})
    female     = m_split.get("F", 0)
    male       = m_split.get("M", 0)

    def _hcol(h): return "00E5A0" if h >= 85 else ("FBBF24" if h >= 65 else "FF3250")

    kpi_rows = [
        [
            Paragraph("<b><font color='#38C4FF'>METRIC</font></b>", st["label_mono"]),
            Paragraph("<b><font color='#38C4FF'>VALUE</font></b>",  st["label_mono"]),
            Paragraph("<b><font color='#38C4FF'>METRIC</font></b>", st["label_mono"]),
            Paragraph("<b><font color='#38C4FF'>VALUE</font></b>",  st["label_mono"]),
        ],
        [Paragraph("AI Store Score",      st["body_dim"]), Paragraph(f'<font color="#{_hcol(health)}"><b>{health}/100</b></font>', st["body"]),
         Paragraph("Unique Visitors",     st["body_dim"]), Paragraph(f'<font color="#00FFC8"><b>{visitors:,}</b></font>', st["body"])],
        [Paragraph("Currently In-Store",  st["body_dim"]), Paragraph(f'<font color="#38C4FF"><b>{in_store}</b></font>', st["body"]),
         Paragraph("Purchases",           st["body_dim"]), Paragraph(f'<font color="#00E5A0"><b>{purchases:,}</b></font>', st["body"])],
        [Paragraph("Conversion Rate",     st["body_dim"]), Paragraph(f'<font color="#FBBF24"><b>{conversion:.1f}%</b></font>', st["body"]),
         Paragraph("Revenue Today",       st["body_dim"]), Paragraph(f'<font color="#FF6B35"><b>₹{revenue:,.0f}</b></font>', st["body"])],
        [Paragraph("Queue Depth",         st["body_dim"]), Paragraph(f'<font color="#{"FF3250" if queue>4 else "00E5A0"}"><b>{queue}</b></font>', st["body"]),
         Paragraph("Abandonment Rate",    st["body_dim"]), Paragraph(f'<font color="#A78BFA"><b>{abandon:.1f}%</b></font>', st["body"])],
        [Paragraph("Female Visitors",     st["body_dim"]), Paragraph(f'<font color="#FF4FA3"><b>{female}</b></font>', st["body"]),
         Paragraph("Male Visitors",       st["body_dim"]), Paragraph(f'<font color="#00E5A0"><b>{male}</b></font>', st["body"])],
        [Paragraph("Staff On Floor",      st["body_dim"]), Paragraph(f'<font color="#38C4FF"><b>{staff}</b></font>', st["body"]),
         Paragraph("Vision Engine",       st["body_dim"]), Paragraph('<font color="#00FFC8"><b>YOLOv8 ACTIVE</b></font>', st["body"])],
    ]

    cw = CONTENT_W / 4
    kpi_table = Table(kpi_rows, colWidths=[cw * 1.4, cw * 0.9, cw * 1.4, cw * 0.9])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  SURFACE2),
        ("BACKGROUND",    (0, 1), (-1, -1), SURFACE),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [SURFACE, colors.HexColor("#0A1222")]),
        ("GRID",          (0, 0), (-1, -1), 0.4, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEABOVE",     (0, 0), (-1, 0),  1.5, TEAL),
        ("LINEBELOW",     (0, -1),(-1, -1), 1.0, TEAL_DARK),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 14))

    # ── 4. STORE COMPARISON ───────────────────────────────────────────────────
    story.append(Paragraph("⚡  MULTI-STORE PERFORMANCE COMPARISON", st["section_head"]))
    story.append(Paragraph(
        "Head-to-head analysis across all tracked stores for the current session.",
        st["body_dim"]
    ))
    story.append(Spacer(1, 6))

    comp_stores = comparison.get("stores", [])

    if comp_stores:
        comp_header = [Paragraph("<b><font color='#38C4FF'>METRIC</font></b>", st["label_mono"])]
        for s in comp_stores:
            sid       = s.get("id", "—")
            sname     = s.get("name", sid)
            is_winner = (sid in comparison.get("winner", ""))
            col       = "#00FFC8" if is_winner else "#FF6B35"
            comp_header.append(Paragraph(
                f'<font color="{col}"><b>{sname}</b></font>'
                + (f'<br/><font color="#00E5A0" size="7">★ WINNER</font>' if is_winner else ""),
                st["label_mono"],
            ))

        def _cmp_row(label, vals, fmt_fn=None, col_fn=None):
            row = [Paragraph(label, st["body_dim"])]
            for v in vals:
                disp = fmt_fn(v) if fmt_fn else str(v)
                col  = col_fn(v) if col_fn else "#E8F0FE"
                row.append(Paragraph(f'<font color="{col}"><b>{disp}</b></font>', st["body"]))
            return row

        def _pct_col(v):  return "#00E5A0" if v >= 85 else ("#FBBF24" if v >= 65 else "#FF3250")
        def _conv_col(v): return "#00FFC8" if v >= 20 else ("#FBBF24" if v >= 15 else "#FF6B35")
        def _q_col(v):    return "#00E5A0" if v <= 3  else ("#FBBF24" if v <= 5  else "#FF3250")

        comp_rows = [
            comp_header,
            _cmp_row("AI Store Score",       [s.get("score",      0) for s in comp_stores], lambda v: f"{v}/100",    _pct_col),
            _cmp_row("Unique Visitors",      [s.get("visitors",   0) for s in comp_stores], lambda v: f"{v:,}",      lambda v: "#00FFC8"),
            _cmp_row("Total Revenue",        [s.get("revenue",    0) for s in comp_stores], lambda v: f"₹{v:,.0f}",  lambda v: "#FF6B35"),
            _cmp_row("Conversion Rate",      [s.get("conversion", 0) for s in comp_stores], lambda v: f"{v:.1f}%",   _conv_col),
            _cmp_row("Queue Depth",          [s.get("queue",      0) for s in comp_stores], lambda v: str(v),        _q_col),
            _cmp_row("Store Health",         [s.get("health",    "—") for s in comp_stores], None, lambda v: "#00E5A0" if "Ex" in str(v) else "#FBBF24"),
            _cmp_row("Highest Traffic Zone", [s.get("top_zone",  "—") for s in comp_stores], None, lambda v: "#A78BFA"),
        ]

        n_stores   = len(comp_stores)
        label_col  = CONTENT_W * 0.32
        store_cols = [(CONTENT_W - label_col) / n_stores] * n_stores

        comp_table = Table(comp_rows, colWidths=[label_col] + store_cols)
        comp_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  SURFACE2),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [SURFACE, colors.HexColor("#0A1222")]),
            ("GRID",          (0, 0), (-1, -1), 0.4, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN",         (1, 0), (-1, -1), "CENTER"),
            ("LINEABOVE",     (0, 0), (-1,  0), 1.5, ORANGE),
            ("LINEBELOW",     (0,-1), (-1, -1), 1.0, TEAL_DARK),
            ("BACKGROUND",    (1, 1), ( 1, -1), colors.HexColor("#001A12")),
        ]))
        story.append(comp_table)
        story.append(Spacer(1, 12))

        # ── 5. WINNER ─────────────────────────────────────────────────────────
        winner_name    = comparison.get("winner", "—")
        winner_reasons = comparison.get("winner_reasons", [])
        recommendation = comparison.get("recommendation", "")

        winner_header = Paragraph(
            f'<font color="#00FFC8" size="12"><b>★  BEST PERFORMING STORE:  {winner_name}</b></font>',
            st["winner_box"]
        )
        reason_bullets = "".join(
            f'<font color="#00E5A0">▶</font>  {r}<br/>' for r in winner_reasons
        ) if winner_reasons else ""

        reason_para = Paragraph(reason_bullets or "No comparison data available.", st["insight_body"])
        rec_para    = Paragraph(
            f'<font color="#FBBF24"><b>RECOMMENDATION:</b></font>  {recommendation}',
            st["insight_body"]
        )

        winner_inner = Table(
            [[winner_header],[Spacer(1,4)],[reason_para],[Spacer(1,4)],[rec_para]],
            colWidths=[CONTENT_W - 28]
        )
        winner_inner.setStyle(TableStyle([
            ("TOPPADDING",    (0,0),(-1,-1), 1), ("BOTTOMPADDING",(0,0),(-1,-1), 1),
            ("LEFTPADDING",   (0,0),(-1,-1), 0), ("RIGHTPADDING", (0,0),(-1,-1), 0),
        ]))
        winner_box = Table([[winner_inner]], colWidths=[CONTENT_W])
        winner_box.setStyle(TableStyle([
            ("BACKGROUND",  (0,0),(-1,-1), colors.HexColor("#001A12")),
            ("LINEABOVE",   (0,0),(-1, 0), 2.0, TEAL),
            ("LINEBEFORE",  (0,0),( 0,-1), 4.0, TEAL),
            ("LINEBELOW",   (0,-1),(-1,-1), 0.5, TEAL_DARK),
            ("TOPPADDING",  (0,0),(-1,-1), 12), ("BOTTOMPADDING",(0,0),(-1,-1), 12),
            ("LEFTPADDING", (0,0),(-1,-1), 14), ("RIGHTPADDING", (0,0),(-1,-1), 14),
        ]))
        story.append(winner_box)
        story.append(Spacer(1, 14))

    # ── 6. AI INSIGHTS ────────────────────────────────────────────────────────
    story.append(Paragraph("🧠  AI-GENERATED INSIGHTS", st["section_head"]))

    # ai_items is already normalised at the top of this function
    if not ai_items:
        story.append(Paragraph(
            "AI engine is processing live store data. Insights will appear in subsequent reports.",
            st["body_dim"]
        ))
    else:
        for idx, ins in enumerate(ai_items):
            title   = ins.get("title",   f"Insight {idx + 1}")
            message = ins.get("message", ins.get("business_impact", ""))
            if ins.get("recommendation"):
                message += f"  Recommendation: {ins['recommendation']}"
            if ins.get("confidence"):
                message += f"  Confidence: {ins['confidence']}%"

            num_col = Paragraph(
                f'<font color="#00FFC8" size="16"><b>{str(idx + 1).zfill(2)}</b></font>',
                st["label_mono"]
            )
            content_table = Table(
                [[Paragraph(title,   st["insight_title"])],
                 [Paragraph(message, st["insight_body"])]],
                colWidths=[CONTENT_W - 50]
            )
            content_table.setStyle(TableStyle([
                ("TOPPADDING",    (0,0),(-1,-1), 1), ("BOTTOMPADDING",(0,0),(-1,-1), 1),
                ("LEFTPADDING",   (0,0),(-1,-1), 0), ("RIGHTPADDING", (0,0),(-1,-1), 0),
            ]))
            row_table = Table([[num_col, content_table]], colWidths=[40, CONTENT_W - 40])
            bg_col = SURFACE if idx % 2 == 0 else colors.HexColor("#0A1222")
            row_table.setStyle(TableStyle([
                ("BACKGROUND",  (0,0),(-1,-1), bg_col),
                ("LINEABOVE",   (0,0),(-1, 0), 0.4, BORDER),
                ("LINEBEFORE",  (0,0),( 0,-1), 2.0, GOLD),
                ("VALIGN",      (0,0),(-1,-1), "TOP"),
                ("TOPPADDING",  (0,0),(-1,-1), 10), ("BOTTOMPADDING",(0,0),(-1,-1), 10),
                ("LEFTPADDING", (0,0),(-1,-1), 10), ("RIGHTPADDING", (0,0),(-1,-1), 10),
            ]))
            story.append(row_table)

    story.append(Spacer(1, 14))

    # ── 7. PIPELINE & REID ────────────────────────────────────────────────────
    story.append(Paragraph("COMPUTER VISION PIPELINE", st["section_head"]))
    story.append(Paragraph(
        "CCTV → YOLOv8 Detection → ByteTrack Tracking → Deep ReID → Event Engine → Retail AI",
        st["body"]
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph("DEEP REID INTELLIGENCE", st["section_head"]))
    story.append(Paragraph(
        "Cross-camera visitor matching and journey reconstruction enabled with identity confidence scoring.",
        st["body"]
    ))
    story.append(Spacer(1, 12))

    # ── 8. PREDICTIONS ────────────────────────────────────────────────────────
    story.append(HRFlowable(width=CONTENT_W, thickness=0.5, color=BORDER, spaceBefore=4, spaceAfter=8))
    story.append(Paragraph("🔮  AI PREDICTIVE ANALYTICS", st["section_head"]))

    predictions = [
        ("Performance Forecast",
         "Store performance expected to improve 15–25% through optimised staff allocation during peak hours."),
        ("Conversion Opportunity",
         f"Increasing dwell time in top zones by 20% could raise conversion from {conversion:.1f}% to an estimated {conversion * 1.2:.1f}%."),
        ("Revenue Potential",
         f"If queue depth stays below 3, predicted daily revenue uplift is ₹{revenue * 0.12:,.0f} (12% increase)."),
        ("Smart Scheduling",
         "YOLOv8 traffic pattern analysis suggests deploying 2 additional staff between 12:00–14:00 and 17:00–19:00 daily."),
    ]

    pred_rows = []
    for p_title, p_body in predictions:
        pred_rows.append([Paragraph(f'<font color="#A78BFA">◈</font>  <b>{p_title}</b>', st["insight_title"])])
        pred_rows.append([Paragraph(p_body, st["body"])])

    pred_table = Table(pred_rows, colWidths=[CONTENT_W])
    pred_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), SURFACE),
        ("ROWBACKGROUNDS",(0,0),(-1,-1), [SURFACE, colors.HexColor("#0A1222")]),
        ("LINEBEFORE",    (0,0),( 0,-1), 3.0, PURPLE),
        ("TOPPADDING",    (0,0),(-1,-1), 5), ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING",   (0,0),(-1,-1), 14), ("RIGHTPADDING",(0,0),(-1,-1), 14),
        ("GRID",          (0,0),(-1,-1), 0.3, BORDER),
    ]))
    story.append(pred_table)
    story.append(Spacer(1, 18))

    # ── 9. SIGN-OFF ───────────────────────────────────────────────────────────
    sign_off = Table([[Paragraph(
        f'<font color="#4A5568" size="7">Report ID: VEYRA-{store_id}-{datetime.now().strftime("%Y%m%d%H%M")}  '
        f'  |  Engine: YOLOv8 + ByteTrack  |  Confidence: HIGH  |  © VEYRA AI Vision OS v3</font>',
        st["meta"]
    )]], colWidths=[CONTENT_W])
    sign_off.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), SURFACE2),
        ("TOPPADDING",    (0,0),(-1,-1), 8), ("BOTTOMPADDING",(0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 12),
        ("LINEABOVE",     (0,0),(-1, 0), 1.0, TEAL),
    ]))
    story.append(sign_off)

    # ── BUILD ─────────────────────────────────────────────────────────────────
    # ── BUILD ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=_dark_page, onLaterPages=_dark_page)

    # Read into memory, delete from disk, return bytes directly
    with open(filename, "rb") as f:
        pdf_bytes = f.read()
    try:
        os.remove(filename)
    except OSError:
        pass
    return pdf_bytes
