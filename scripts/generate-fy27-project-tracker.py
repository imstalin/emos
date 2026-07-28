#!/usr/bin/env python3
"""
FY27 Engineering Project Tracker workbook generator.
Senior PMO / Microsoft Project-style tracker — Excel formulas only (no VBA).
"""

from __future__ import annotations

import argparse
import random
import re
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.chart import BarChart, DoughnutChart, LineChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.formatting.rule import (
    CellIsRule,
    FormulaRule,
    ColorScaleRule,
)
from openpyxl.styles import (
    Alignment,
    Border,
    Font,
    PatternFill,
    Side,
)
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.page import PageMargins
from openpyxl.worksheet.table import Table, TableStyleInfo

# ── Constants ────────────────────────────────────────────────────────────────

FY_START = date(2026, 7, 1)
FY_END = date(2027, 6, 30)
ROOT = Path(__file__).resolve().parents[1]
SOURCE_WORKBOOK = ROOT / "plan" / "FY 27 Draft Planning.xlsx"
SOURCE_SHEET = "FY27 V1"
OUTPUT = ROOT / "docs" / "FY27-Engineering-Project-Tracker.xlsx"
AS_OF = date(2026, 7, 26)  # governance as-of for status inference

BLUE_HEADER = "1F4E79"
BLUE_ACCENT = "2E75B6"
LIGHT_BLUE = "D6EAF8"
ALT_ROW = "F2F2F2"
WHITE = "FFFFFF"
GREEN = "C6EFCE"
GREEN_FONT = "006100"
BLUE_PROG = "BDD7EE"
BLUE_FONT = "1F4E79"
YELLOW = "FFEB9C"
YELLOW_FONT = "9C5700"
RED = "FFC7CE"
RED_FONT = "9C0006"
GREY = "D9D9D9"
GREY_FONT = "595959"
ORANGE = "F4B183"
CRITICAL_RED = "FF5050"

# Populated from FY27 V1 after load (fallbacks kept for empty source)
OWNERS: list[str] = []
TEAMS = [
    "Platform",
    "Core Product",
    "Rewards",
    "Data & AI",
    "Integrations",
    "SRE / Support",
    "Architecture",
    "Compliance Eng",
]
PROJECTS: list[str] = []
CATEGORIES: list[str] = []

PRIORITIES = ["Critical", "High", "Medium", "Low"]
STATUSES = ["Not Started", "In Progress", "Completed", "At Risk", "Blocked"]
PHASES = ["Discovery", "Design", "Build", "Test", "UAT", "Release", "Hypercare"]
WORKSTREAMS = [
    "Product Delivery",
    "Platform",
    "Data",
    "Integrations",
    "Reliability",
    "Governance",
    "Tech Debt",
]
RELEASES = [
    "R26.Q1",
    "R26.Q2",
    "R26.Q3",
    "R26.Q4",
    "R27.Q1",
    "R27.Q2",
    "Hotfix",
    "N/A",
]

# Bi-weekly sprints across FY27
SPRINTS = []
sprint_start = FY_START
for i in range(1, 27):
    SPRINTS.append(f"Sprint {i:02d}")

EPICS_BY_PROJECT = {
    "Channel Smart 2.0": [
        "CS2 Core Experience",
        "CS2 Mobile Parity",
        "CS2 Partner Channels",
        "CS2 Observability",
    ],
    "Cash Rewards & Wallet": [
        "Wallet Ledger",
        "Rewards Redemption",
        "Cashback Engine",
        "Wallet Fraud Controls",
    ],
    "Partner Intelligence Suite": [
        "Partner Scorecards",
        "Insight Pipelines",
        "Partner Portal UX",
    ],
    "Rewards Hub": [
        "Hub Catalog",
        "Personalization",
        "Campaign Ops",
    ],
    "Production Support": [
        "Incident Response",
        "Runbooks",
        "On-call Hardening",
    ],
    "Migration": [
        "Legacy Decommission",
        "Data Cutover",
        "Traffic Shift",
    ],
    "Compliance": [
        "Audit Evidence",
        "PII Controls",
        "Policy Automation",
    ],
    "Salesforce Integration": [
        "SFDC Sync",
        "Opportunity Bridge",
        "Case Automation",
    ],
    "Data Pipeline": [
        "Ingestion Framework",
        "Quality Gates",
        "Serving Layer",
    ],
    "Platform Enhancements": [
        "API Gateway",
        "AuthN/AuthZ",
        "Developer Portal",
    ],
    "Technical Debt": [
        "Service Decomposition",
        "Test Pyramid",
        "Dependency Upgrades",
    ],
    "Maintenance": [
        "Patch Cadence",
        "Certificate Rotation",
        "Capacity Hygiene",
    ],
    "Production Release": [
        "Release Train",
        "Rollback Playbooks",
        "Feature Flags",
    ],
    "Architecture Improvements": [
        "Event Backbone",
        "Resilience Patterns",
        "Cost Optimization",
    ],
}

FEATURES = [
    "API Design",
    "UI Screens",
    "Backend Services",
    "Data Model",
    "ETL Jobs",
    "Security Controls",
    "Monitoring",
    "Performance",
    "Automation",
    "Documentation",
    "Integration Adapter",
    "Migration Scripts",
    "Feature Flags",
    "Load Testing",
    "Accessibility",
]

thin = Border(
    left=Side(style="thin", color="B0B0B0"),
    right=Side(style="thin", color="B0B0B0"),
    top=Side(style="thin", color="B0B0B0"),
    bottom=Side(style="thin", color="B0B0B0"),
)


def week_starts(start: date, end: date) -> list[date]:
    """Monday-aligned week starts covering the fiscal year."""
    d = start - timedelta(days=start.weekday())  # Monday on/before start
    weeks = []
    while d <= end:
        weeks.append(d)
        d += timedelta(days=7)
    return weeks


def month_starts(start: date, end: date) -> list[date]:
    months = []
    y, m = start.year, start.month
    while date(y, m, 1) <= end:
        months.append(date(y, m, 1))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def style_header_row(ws, row: int, start_col: int, end_col: int):
    fill = PatternFill("solid", fgColor=BLUE_HEADER)
    font = Font(name="Calibri", bold=True, color=WHITE, size=11)
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin


def apply_alt_rows(ws, start_row: int, end_row: int, start_col: int, end_col: int):
    fill = PatternFill("solid", fgColor=ALT_ROW)
    for r in range(start_row, end_row + 1):
        if (r - start_row) % 2 == 1:
            for c in range(start_col, end_col + 1):
                cell = ws.cell(row=r, column=c)
                if cell.fill.fgColor is None or cell.fill.fgColor.rgb in (None, "00000000", "0"):
                    cell.fill = fill


def set_print(ws, landscape=True):
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_margins = PageMargins(left=0.4, right=0.4, top=0.5, bottom=0.5)
    ws.print_options.horizontalCentered = True
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def add_table(ws, name: str, ref: str):
    table = Table(displayName=name, ref=ref)
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    ws.add_table(table)


# ── FY27 V1 source loading ───────────────────────────────────────────────────

QUARTER_WINDOWS = {
    "Q1": (date(2026, 7, 1), date(2026, 9, 30)),
    "Q2": (date(2026, 10, 1), date(2026, 12, 31)),
    "Q3": (date(2027, 1, 1), date(2027, 3, 31)),
    "Q4": (date(2027, 4, 1), date(2027, 6, 30)),
    "TBD": (date(2027, 4, 1), date(2027, 6, 30)),
}

RELEASE_BY_QUARTER = {
    "Q1": "R26.Q1",
    "Q2": "R26.Q2",
    "Q3": "R27.Q1",
    "Q4": "R27.Q2",
    "TBD": "N/A",
}

TEAM_BY_PROJECT = {
    "CS 1.0": "Core Product",
    "CS 2.0": "Core Product",
    "CS 2.0 Core": "Platform",
    "CS 2.0 Data": "Data & AI",
    "CS 2.0 Achievo": "Rewards",
}

ROLE_BY_OWNER = {
    "MJ": "EM / Tech Lead — CS",
    "Jawahar": "Tech Lead — Platform / Core",
    "Siva": "Tech Lead — Data / PIS",
    "Shriguru": "Engineer — Achievo / Rewards",
    "Kadarkarai": "Engineer — Platform",
}


def _cell_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_priority(value) -> str:
    text = _cell_str(value).title()
    if text.lower() == "high":
        return "High"
    if text in PRIORITIES:
        return text
    return "Medium"


def _normalize_include(value) -> str:
    text = _cell_str(value).title()
    if text in ("Yes", "No", "Pending"):
        return text
    return "Pending" if not text else text


def _normalize_quarter(value) -> str:
    text = _cell_str(value).upper()
    if text in QUARTER_WINDOWS:
        return text
    return "TBD"


def _parse_hours(value):
    if value is None or _cell_str(value) == "":
        return "TBD"
    if isinstance(value, (int, float)):
        return float(value)
    text = _cell_str(value).upper()
    if text == "TBD":
        return "TBD"
    try:
        return float(text.replace(",", ""))
    except ValueError:
        return "TBD"


def _truthy_flag(value) -> bool:
    if isinstance(value, bool):
        return value
    text = _cell_str(value).lower()
    return text in {"1", "y", "yes", "true", "x", "core", "mob", "data"}


def _phase_from_category(category: str) -> str:
    c = category.lower()
    if "maintenance" in c:
        return "Hypercare" if "tech" in c else "Release"
    if "new feature" in c or "pis" in c:
        return "Build"
    if "enhance" in c:
        return "Design" if "funct" in c else "Build"
    return "Build"


def _workstream_from_row(category: str, core: bool, mob: bool, data: bool) -> str:
    if data or "pis" in category.lower() or "data" in category.lower():
        return "Data"
    if mob:
        return "Product Delivery"
    if core:
        return "Platform"
    if "maintenance" in category.lower():
        return "Reliability"
    if "tech" in category.lower():
        return "Tech Debt"
    return "Product Delivery"


def _sprint_for_quarter(quarter: str, index_in_quarter: int) -> str:
    # 6 bi-weekly sprints per quarter → map into Sprint 01-26
    base = {"Q1": 1, "Q2": 7, "Q3": 13, "Q4": 19, "TBD": 22}.get(quarter, 1)
    sprint_no = min(26, base + (index_in_quarter % 6))
    return f"Sprint {sprint_no:02d}"


def _schedule_from_quarter(quarter: str, planned_hours, rng: random.Random) -> tuple[date, date]:
    start_q, end_q = QUARTER_WINDOWS.get(quarter, QUARTER_WINDOWS["TBD"])
    if planned_hours == "TBD":
        span = rng.choice([10, 14, 21, 28])
    else:
        # ~6 productive hours/day planning heuristic
        span = max(5, min(70, int(round(float(planned_hours) / 6))))
    window = (end_q - start_q).days
    latest_start = max(0, window - span)
    offset = rng.randint(0, latest_start) if latest_start else 0
    start = start_q + timedelta(days=offset)
    end = min(end_q, start + timedelta(days=span - 1))
    return start, end


def _infer_status(include: str, quarter: str, priority: str, rng: random.Random) -> tuple[str, int]:
    """Return (status, pct_complete) as of early FY27 Q1."""
    if include == "No":
        return "Not Started", 0
    if include == "Pending":
        return "At Risk", rng.randint(5, 25)

    if quarter in {"Q2", "Q3", "Q4", "TBD"}:
        return "Not Started", 0

    # Q1 — FY just started (as-of late July 2026)
    roll = rng.random()
    if priority == "Critical":
        if roll < 0.55:
            return "In Progress", rng.randint(15, 45)
        if roll < 0.70:
            return "At Risk", rng.randint(10, 35)
        return "Not Started", 0
    if priority == "High":
        if roll < 0.40:
            return "In Progress", rng.randint(10, 40)
        if roll < 0.50:
            return "At Risk", rng.randint(5, 25)
        return "Not Started", 0
    if roll < 0.25:
        return "In Progress", rng.randint(10, 30)
    return "Not Started", 0


def load_tasks_from_fy27_v1(source: Path = SOURCE_WORKBOOK, sheet_name: str = SOURCE_SHEET) -> list[dict]:
    if not source.exists():
        raise FileNotFoundError(f"Source workbook not found: {source}")

    wb = load_workbook(source, data_only=True, read_only=True)
    if sheet_name not in wb.sheetnames:
        raise ValueError(f"Sheet '{sheet_name}' not found. Available: {wb.sheetnames}")

    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        raise ValueError(f"Sheet '{sheet_name}' is empty")

    headers = [_cell_str(h) for h in rows[0]]
    col = {h.lower(): i for i, h in enumerate(headers)}

    def get(row, name: str):
        i = col.get(name.lower())
        if i is None or i >= len(row):
            return None
        return row[i]

    required = ["Title"]
    for name in required:
        if name.lower() not in col:
            raise ValueError(f"FY27 V1 missing required column: {name}")

    rng = random.Random(27)
    tasks: list[dict] = []
    quarter_counters: Counter[str] = Counter()

    for raw in rows[1:]:
        title = _cell_str(get(raw, "Title"))
        if not title:
            continue

        project = _cell_str(get(raw, "Project")) or "Unassigned"
        category = _cell_str(get(raw, "Category")) or "Enhancement"
        quarter = _normalize_quarter(get(raw, "Quarter"))
        timeline = _cell_str(get(raw, "Timeline")) or f"{quarter} FY27"
        owner = _cell_str(get(raw, "Assignee")) or "Unassigned"
        priority = _normalize_priority(get(raw, "Priority"))
        include = _normalize_include(get(raw, "Include"))
        hours = _parse_hours(get(raw, "Hours"))
        description = _cell_str(get(raw, "Description"))
        core = _truthy_flag(get(raw, "Core"))
        mob = _truthy_flag(get(raw, "Mob"))
        data = _truthy_flag(get(raw, "Data"))

        idx_q = quarter_counters[quarter]
        quarter_counters[quarter] += 1

        start, end = _schedule_from_quarter(quarter, hours, rng)
        status, pct = _infer_status(include, quarter, priority, rng)

        planned = 40.0 if hours == "TBD" else float(hours)
        if status == "Completed":
            actual = round(planned * rng.uniform(0.9, 1.1), 1)
        elif status in {"In Progress", "At Risk", "Blocked"}:
            actual = round(planned * (pct / 100) * rng.uniform(0.85, 1.15), 1)
        else:
            actual = 0.0

        budget = round(planned * 110, 0)  # blended internal rate placeholder
        remarks_parts = [f"Include={include}", f"Source={SOURCE_SHEET}", f"Timeline={timeline}"]
        if hours == "TBD":
            remarks_parts.append("Hours=TBD in source")

        next_action = {
            "Completed": "Close & document lessons learned",
            "In Progress": "Continue sprint commitments; demos Friday",
            "Not Started": "Confirm kickoff & acceptance criteria",
            "At Risk": "Clarify Include/Pending decision; rebaseline if needed",
            "Blocked": "Resolve blocker with dependency owner",
        }[status]

        tasks.append(
            {
                "id": f"T-{len(tasks) + 1:03d}",
                "epic": f"{project} — {category}",
                "project": project,
                "feature": category,
                "sprint": _sprint_for_quarter(quarter, idx_q),
                "phase": _phase_from_category(category),
                "workstream": _workstream_from_row(category, core, mob, data),
                "name": title,
                "description": description,
                "owner": owner,
                "team": TEAM_BY_PROJECT.get(project, "Core Product"),
                "priority": priority,
                "status": status,
                "start": start,
                "end": end,
                "pct": pct,
                "planned": planned,
                "actual": actual,
                "budget": budget,
                "dependency": "",
                "blocked_by": "",
                "risk": "",
                "next_action": next_action,
                "release": RELEASE_BY_QUARTER.get(quarter, "N/A"),
                "remarks": " | ".join(remarks_parts),
                "critical": priority == "Critical" and status in ("At Risk", "Blocked", "In Progress"),
                "quarter": quarter,
                "include": include,
            }
        )

    if not tasks:
        raise ValueError(f"No titled rows found on '{sheet_name}'")

    # Same-project predecessor dependencies (stable, governance-friendly)
    by_project: dict[str, list[dict]] = {}
    for t in tasks:
        by_project.setdefault(t["project"], []).append(t)

    for project_tasks in by_project.values():
        for i, t in enumerate(project_tasks):
            if i == 0:
                continue
            if t["quarter"] == project_tasks[i - 1]["quarter"] or rng.random() < 0.35:
                pred = project_tasks[i - 1]
                t["dependency"] = pred["id"]
                if t["status"] == "At Risk" and pred["status"] != "Completed" and rng.random() < 0.35:
                    t["status"] = "Blocked"
                    t["blocked_by"] = pred["id"]
                    t["pct"] = min(t["pct"], 15)
                    t["actual"] = round(t["planned"] * (t["pct"] / 100), 1)
                    t["next_action"] = "Resolve blocker with dependency owner"
                    t["critical"] = t["priority"] == "Critical"

    # Refresh module lookup lists from actual data
    global OWNERS, PROJECTS, CATEGORIES
    OWNERS = sorted({t["owner"] for t in tasks if t["owner"]})
    PROJECTS = sorted({t["project"] for t in tasks if t["project"]})
    CATEGORIES = sorted({t["feature"] for t in tasks if t["feature"]})

    risk_ids = [f"R-{i:02d}" for i in range(1, 21)]
    for t in tasks:
        if t["status"] in ("At Risk", "Blocked") or (
            t["priority"] == "Critical" and rng.random() < 0.25
        ):
            t["risk"] = rng.choice(risk_ids)

    return tasks


def generate_milestones(tasks: list[dict]) -> list[dict]:
    owners = OWNERS or ["Unassigned"]
    projects = PROJECTS or sorted({t["project"] for t in tasks})
    items: list[tuple[str, date, str]] = [
        ("FY27 Planning Baseline Locked (FY27 V1)", date(2026, 7, 10), "Completed"),
        ("Q1 Governance Checkpoint", date(2026, 9, 25), "Not Started"),
        ("Q2 Governance Checkpoint", date(2026, 12, 18), "Not Started"),
        ("Q3 Governance Checkpoint", date(2027, 3, 20), "Not Started"),
        ("Q4 / FY27 Closeout", date(2027, 6, 30), "Not Started"),
    ]
    for project in projects:
        q1_end = date(2026, 9, 30)
        q2_end = date(2026, 12, 31)
        status = "In Progress" if any(
            t["project"] == project and t["quarter"] == "Q1" and t["status"] == "In Progress"
            for t in tasks
        ) else "Not Started"
        items.append((f"{project} — Q1 exit gate", q1_end, status))
        items.append((f"{project} — H1 checkpoint", q2_end, "Not Started"))

    # Critical title milestones from source
    for t in tasks:
        if t["priority"] == "Critical" and t["quarter"] == "Q1":
            items.append((f"Critical: {t['name'][:60]}", t["end"], t["status"]))
            if len([x for x in items if x[0].startswith("Critical:")]) >= 6:
                break

    out = []
    for i, (name, planned, status) in enumerate(items, 1):
        actual = planned - timedelta(days=2) if status == "Completed" else None
        out.append(
            {
                "id": f"M-{i:02d}",
                "name": name,
                "owner": owners[(i - 1) % len(owners)],
                "planned": planned,
                "actual": actual,
                "status": status,
            }
        )
    return out


def generate_risks(tasks: list[dict]) -> list[dict]:
    rng = random.Random(42)
    owners = OWNERS or ["Unassigned"]
    seeds = [
        ("CS 1.0 decommission (BRIKS / Coupon / OTP) may disrupt CS 2.0 dual-run", "High", "High"),
        ("ERP / Salesforce connector scope (CS 2.0) under-estimated vs. planned hours", "High", "Medium"),
        ("PIS Journey Builder prediction agents depend on unstable partner data quality", "High", "High"),
        ("Internal VAPT + remediation capacity contention with feature delivery", "Medium", "High"),
        ("Include=Pending items without decision are inflating Q1 commitment risk", "High", "Medium"),
        ("TBD-hour items prevent reliable capacity & burn forecasting", "Medium", "High"),
        ("CS 2.0 Core tech maintenance backlog crowding new-feature sprints", "High", "Medium"),
        ("Achievo / Rewards stream under-staffed relative to CS 2.0 Achievo scope", "Medium", "Medium"),
        ("Q1 Critical mass may create spillover into Q2 without rebaseline", "High", "High"),
        ("Cross-project dependency chains (same-owner serial work) create idle wait", "Medium", "Medium"),
        ("Description gaps on large-hour items reduce estimate confidence", "Low", "Medium"),
        ("Mobile / Core / Data flag sparsity weakens workstream reporting", "Low", "Low"),
        ("Production support interrupts may steal CS 2.0 Core capacity", "Medium", "High"),
        ("Compliance / VAPT findings late in quarter threaten release gates", "High", "Medium"),
        ("Unassigned project rows in source need owner clarification", "Medium", "Low"),
    ]
    out = []
    for i, (desc, impact, prob) in enumerate(seeds, 1):
        owner = owners[(i - 1) % len(owners)]
        # Prefer owner who holds related work
        for t in tasks:
            if any(token.lower() in t["name"].lower() or token.lower() in t["project"].lower()
                   for token in re.findall(r"[A-Za-z0-9.]+", desc)[:3]):
                owner = t["owner"]
                break
        status = rng.choice(["Open", "Mitigating", "Watching", "Open"])
        out.append(
            {
                "id": f"R-{i:02d}",
                "description": desc,
                "impact": impact,
                "probability": prob,
                "owner": owner,
                "mitigation": f"Owned by {owner}; track in weekly governance; link to FY27 V1 source items.",
                "status": status,
                "review": AS_OF + timedelta(days=rng.randint(7, 45)),
            }
        )

    # Attach risk IDs already assigned on tasks — ensure those IDs exist
    used = {t["risk"] for t in tasks if t.get("risk")}
    for rid in sorted(used):
        if not any(r["id"] == rid for r in out):
            out.append(
                {
                    "id": rid,
                    "description": f"Delivery risk linked from tracker tasks ({rid})",
                    "impact": "High",
                    "probability": "Medium",
                    "owner": owners[0],
                    "mitigation": "Review linked tasks; confirm Include and dates.",
                    "status": "Open",
                    "review": AS_OF + timedelta(days=14),
                }
            )
    return out


def generate_resources(tasks: list[dict]) -> list[dict]:
    hours_by_owner = Counter()
    for t in tasks:
        hours_by_owner[t["owner"]] += float(t["planned"] or 0)

    out = []
    for owner in OWNERS:
        # Annual-ish capacity ~160h/mo * 12, but tracker uses FY planned hours rollup —
        # set capacity to planned book + buffer so utilization is meaningful.
        allocated = hours_by_owner.get(owner, 0)
        capacity = max(1200, int(round(allocated * 1.15 / 50) * 50)) if allocated else 1600
        vacation = 80 if allocated > 1000 else 40
        leave = 24
        out.append(
            {
                "resource": owner,
                "role": ROLE_BY_OWNER.get(owner, "Engineering"),
                "capacity": capacity,
                "vacation": vacation,
                "leave": leave,
            }
        )
    return out


# ── Sheet builders ───────────────────────────────────────────────────────────

def build_lookup(wb: Workbook):
    ws = wb.create_sheet("Lookup Lists", 0)
    set_print(ws)

    ws["A1"] = "LOOKUP LISTS — Dropdown Source Values"
    ws["A1"].font = Font(name="Calibri", bold=True, size=16, color=BLUE_HEADER)
    ws.merge_cells("A1:H1")

    ws["A2"] = "Maintain these lists to drive Project Tracker dropdowns and named ranges."
    ws["A2"].font = Font(name="Calibri", italic=True, size=10, color="666666")

    columns = {
        "A": ("Owners", OWNERS),
        "B": ("Priority", PRIORITIES),
        "C": ("Status", STATUSES),
        "D": ("Teams", TEAMS),
        "E": ("Projects", PROJECTS),
        "F": ("Releases", RELEASES),
        "G": ("Sprint", SPRINTS),
        "H": ("Phase", PHASES),
        "I": ("Workstream", WORKSTREAMS),
        "J": ("Impact", ["High", "Medium", "Low"]),
        "K": ("Probability", ["High", "Medium", "Low"]),
        "L": ("Risk Status", ["Open", "Mitigating", "Watching", "Closed"]),
        "M": ("Dep Status", ["Open", "Satisfied", "Overdue", "Waived"]),
        "N": ("Category", CATEGORIES or ["Enhancement"]),
    }

    for col, (title, values) in columns.items():
        cell = ws[f"{col}4"]
        cell.value = title
        cell.fill = PatternFill("solid", fgColor=BLUE_HEADER)
        cell.font = Font(bold=True, color=WHITE)
        cell.alignment = Alignment(horizontal="center")
        for i, v in enumerate(values, start=5):
            ws[f"{col}{i}"] = v
            ws[f"{col}{i}"].border = thin
        end_row = 4 + len(values)
        # Named ranges (workbook scope)
        def_name = title.replace(" ", "").replace("&", "And")
        wb.defined_names.add(
            DefinedName(name=f"List_{def_name}", attr_text=f"'Lookup Lists'!${col}$5:${col}${end_row}")
        )
        ws.column_dimensions[col].width = 22

    ws.freeze_panes = "A5"
    ws.row_dimensions[4].height = 22
    return ws


def build_tracker(wb: Workbook, tasks: list[dict]):
    ws = wb.create_sheet("Project Tracker", 1)
    set_print(ws)

    headers = [
        "Task ID",
        "Epic",
        "Project",
        "Feature",
        "Sprint",
        "Phase",
        "Workstream",
        "Task Name",
        "Description",
        "Owner",
        "Team",
        "Priority",
        "Status",
        "Start Date",
        "End Date",
        "Duration",
        "% Complete",
        "Planned Hours",
        "Actual Hours",
        "Variance",
        "Budget",
        "Dependency",
        "Blocked By",
        "Risk",
        "Next Action",
        "Target Release",
        "Remarks",
        "Critical Path",
    ]

    ws["A1"] = "FY27 ENGINEERING PROJECT TRACKER"
    ws["A1"].font = Font(name="Calibri", bold=True, size=16, color=BLUE_HEADER)
    ws.merge_cells("A1:H1")
    ws["A2"] = (
        f"Source: plan/FY 27 Draft Planning.xlsx · {SOURCE_SHEET}  |  "
        f"Plan window: {FY_START.isoformat()} → {FY_END.isoformat()}  |  "
        "Formula-driven  |  Weekly governance ready"
    )
    ws["A2"].font = Font(name="Calibri", italic=True, size=10, color="666666")

    header_row = 4
    for c, h in enumerate(headers, 1):
        ws.cell(row=header_row, column=c, value=h)
    style_header_row(ws, header_row, 1, len(headers))
    ws.row_dimensions[header_row].height = 32

    for i, t in enumerate(tasks):
        r = header_row + 1 + i
        ws.cell(row=r, column=1, value=t["id"])
        ws.cell(row=r, column=2, value=t["epic"])
        ws.cell(row=r, column=3, value=t["project"])
        ws.cell(row=r, column=4, value=t["feature"])
        ws.cell(row=r, column=5, value=t["sprint"])
        ws.cell(row=r, column=6, value=t["phase"])
        ws.cell(row=r, column=7, value=t["workstream"])
        ws.cell(row=r, column=8, value=t["name"])
        ws.cell(row=r, column=9, value=t["description"])
        ws.cell(row=r, column=10, value=t["owner"])
        ws.cell(row=r, column=11, value=t["team"])
        ws.cell(row=r, column=12, value=t["priority"])
        ws.cell(row=r, column=13, value=t["status"])
        ws.cell(row=r, column=14, value=t["start"]).number_format = "DD-MMM-YYYY"
        ws.cell(row=r, column=15, value=t["end"]).number_format = "DD-MMM-YYYY"
        # Duration (calendar days)
        ws.cell(row=r, column=16, value=f'=IF(OR(N{r}="",O{r}=""),"",O{r}-N{r}+1)')
        ws.cell(row=r, column=17, value=t["pct"] / 100).number_format = "0%"
        ws.cell(row=r, column=18, value=t["planned"])
        ws.cell(row=r, column=19, value=t["actual"])
        ws.cell(row=r, column=20, value=f"=S{r}-R{r}")  # Variance
        ws.cell(row=r, column=21, value=t["budget"]).number_format = '#,##0'
        ws.cell(row=r, column=22, value=t["dependency"])
        ws.cell(row=r, column=23, value=t["blocked_by"])
        ws.cell(row=r, column=24, value=t["risk"])
        ws.cell(row=r, column=25, value=t["next_action"])
        ws.cell(row=r, column=26, value=t["release"])
        ws.cell(row=r, column=27, value=t["remarks"])
        ws.cell(row=r, column=28, value="Yes" if t["critical"] else "No")

        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.border = thin
            cell.font = Font(name="Calibri", size=10)
            cell.alignment = Alignment(vertical="center", wrap_text=c in (8, 9, 25))

    last_row = header_row + len(tasks)
    add_table(ws, "tblProjectTracker", f"A{header_row}:{get_column_letter(len(headers))}{last_row}")

    # Dropdowns
    validations = [
        ("M5:M" + str(last_row), "List_Status"),
        ("L5:L" + str(last_row), "List_Priority"),
        ("J5:J" + str(last_row), "List_Owners"),
        ("E5:E" + str(last_row), "List_Sprint"),
        ("Z5:Z" + str(last_row), "List_Releases"),
        ("C5:C" + str(last_row), "List_Projects"),
        ("K5:K" + str(last_row), "List_Teams"),
        ("F5:F" + str(last_row), "List_Phase"),
        ("G5:G" + str(last_row), "List_Workstream"),
    ]
    for sqref, named in validations:
        dv = DataValidation(type="list", formula1=f"={named}", allow_blank=True)
        dv.error = "Select a value from the list"
        dv.errorTitle = "Invalid entry"
        dv.sqref = sqref
        ws.add_data_validation(dv)

    # Status CF on Status column
    status_col = "M"
    cf_rules = [
        ("Completed", GREEN, GREEN_FONT),
        ("In Progress", BLUE_PROG, BLUE_FONT),
        ("At Risk", YELLOW, YELLOW_FONT),
        ("Blocked", RED, RED_FONT),
        ("Not Started", GREY, GREY_FONT),
    ]
    for status, fill, font_c in cf_rules:
        ws.conditional_formatting.add(
            f"{status_col}5:{status_col}{last_row}",
            CellIsRule(
                operator="equal",
                formula=[f'"{status}"'],
                fill=PatternFill("solid", fgColor=fill),
                font=Font(color=font_c, bold=True),
            ),
        )

    # Priority Critical highlight
    ws.conditional_formatting.add(
        f"L5:L{last_row}",
        CellIsRule(
            operator="equal",
            formula=['"Critical"'],
            fill=PatternFill("solid", fgColor=RED),
            font=Font(color=RED_FONT, bold=True),
        ),
    )

    widths = {
        "A": 10, "B": 22, "C": 24, "D": 18, "E": 12, "F": 12, "G": 14,
        "H": 36, "I": 40, "J": 16, "K": 14, "L": 10, "M": 12, "N": 12,
        "O": 12, "P": 10, "Q": 11, "R": 12, "S": 12, "T": 10, "U": 10,
        "V": 12, "W": 12, "X": 10, "Y": 28, "Z": 12, "AA": 16, "AB": 12,
    }
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    ws.freeze_panes = "A5"
    return ws, last_row


def build_milestones(wb: Workbook, milestones: list[dict]):
    ws = wb.create_sheet("Milestones", 2)
    set_print(ws)
    ws["A1"] = "MILESTONES — FY27 GOVERNANCE"
    ws["A1"].font = Font(name="Calibri", bold=True, size=16, color=BLUE_HEADER)
    ws["A2"] = "Delay and 'Upcoming within 14 days' are formula-driven."
    ws["A2"].font = Font(italic=True, size=10, color="666666")

    headers = [
        "Milestone ID",
        "Milestone",
        "Owner",
        "Planned Date",
        "Actual Date",
        "Status",
        "Delay (days)",
        "Upcoming within 14 days",
    ]
    for c, h in enumerate(headers, 1):
        ws.cell(row=4, column=c, value=h)
    style_header_row(ws, 4, 1, len(headers))

    for i, m in enumerate(milestones):
        r = 5 + i
        ws.cell(row=r, column=1, value=m["id"])
        ws.cell(row=r, column=2, value=m["name"])
        ws.cell(row=r, column=3, value=m["owner"])
        ws.cell(row=r, column=4, value=m["planned"]).number_format = "DD-MMM-YYYY"
        cell_a = ws.cell(row=r, column=5, value=m["actual"])
        cell_a.number_format = "DD-MMM-YYYY"
        ws.cell(row=r, column=6, value=m["status"])
        # Delay: if actual, actual-planned; else if planned < today and not completed, today-planned; else 0
        ws.cell(
            row=r,
            column=7,
            value=(
                f'=IF(E{r}<>"",E{r}-D{r},'
                f'IF(AND(D{r}<TODAY(),F{r}<>"Completed"),TODAY()-D{r},0))'
            ),
        )
        ws.cell(
            row=r,
            column=8,
            value=f'=IF(AND(D{r}>=TODAY(),D{r}<=TODAY()+14,F{r}<>"Completed"),"YES","")',
        )
        for c in range(1, 9):
            ws.cell(row=r, column=c).border = thin
            ws.cell(row=r, column=c).font = Font(name="Calibri", size=10)

    last = 4 + len(milestones)
    add_table(ws, "tblMilestones", f"A4:H{last}")

    ws.conditional_formatting.add(
        f"G5:G{last}",
        CellIsRule(operator="greaterThan", formula=["0"], fill=PatternFill("solid", fgColor=RED), font=Font(color=RED_FONT, bold=True)),
    )
    ws.conditional_formatting.add(
        f"H5:H{last}",
        CellIsRule(operator="equal", formula=['"YES"'], fill=PatternFill("solid", fgColor=ORANGE), font=Font(bold=True)),
    )

    for col, w in zip("ABCDEFGH", [12, 38, 18, 14, 14, 12, 12, 18]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A5"

    dv = DataValidation(type="list", formula1="=List_Status", allow_blank=True)
    dv.sqref = f"F5:F{last}"
    ws.add_data_validation(dv)
    dv2 = DataValidation(type="list", formula1="=List_Owners", allow_blank=True)
    dv2.sqref = f"C5:C{last}"
    ws.add_data_validation(dv2)
    return ws


def build_risks(wb: Workbook, risks: list[dict]):
    ws = wb.create_sheet("Risks & Issues", 3)
    set_print(ws)
    ws["A1"] = "RISKS & ISSUES REGISTER"
    ws["A1"].font = Font(name="Calibri", bold=True, size=16, color=BLUE_HEADER)
    ws["A2"] = "Severity = Impact × Probability (formula). High severity auto-highlighted."
    ws["A2"].font = Font(italic=True, size=10, color="666666")

    headers = [
        "Risk ID",
        "Description",
        "Impact",
        "Probability",
        "Severity",
        "Owner",
        "Mitigation",
        "Status",
        "Review Date",
    ]
    for c, h in enumerate(headers, 1):
        ws.cell(row=4, column=c, value=h)
    style_header_row(ws, 4, 1, len(headers))

    for i, risk in enumerate(risks):
        r = 5 + i
        ws.cell(row=r, column=1, value=risk["id"])
        ws.cell(row=r, column=2, value=risk["description"])
        ws.cell(row=r, column=3, value=risk["impact"])
        ws.cell(row=r, column=4, value=risk["probability"])
        ws.cell(
            row=r,
            column=5,
            value=(
                f'=IF(OR(C{r}="",D{r}=""),"",'
                f'IF((IF(C{r}="High",3,IF(C{r}="Medium",2,1)))*'
                f'(IF(D{r}="High",3,IF(D{r}="Medium",2,1)))>=9,"Critical",'
                f'IF((IF(C{r}="High",3,IF(C{r}="Medium",2,1)))*'
                f'(IF(D{r}="High",3,IF(D{r}="Medium",2,1)))>=6,"High",'
                f'IF((IF(C{r}="High",3,IF(C{r}="Medium",2,1)))*'
                f'(IF(D{r}="High",3,IF(D{r}="Medium",2,1)))>=3,"Medium","Low"))))'
            ),
        )
        ws.cell(row=r, column=6, value=risk["owner"])
        ws.cell(row=r, column=7, value=risk["mitigation"])
        ws.cell(row=r, column=8, value=risk["status"])
        ws.cell(row=r, column=9, value=risk["review"]).number_format = "DD-MMM-YYYY"
        for c in range(1, 10):
            ws.cell(row=r, column=c).border = thin
            ws.cell(row=r, column=c).font = Font(name="Calibri", size=10)
            ws.cell(row=r, column=c).alignment = Alignment(wrap_text=c in (2, 7), vertical="center")

    last = 4 + len(risks)
    add_table(ws, "tblRisks", f"A4:I{last}")

    # High / Critical severity highlight
    ws.conditional_formatting.add(
        f"E5:E{last}",
        FormulaRule(
            formula=['OR($E5="High",$E5="Critical")'],
            fill=PatternFill("solid", fgColor=RED),
            font=Font(color=RED_FONT, bold=True),
        ),
    )

    for col, w in zip("ABCDEFGHI", [10, 55, 12, 12, 12, 18, 40, 12, 12]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A5"
    ws.row_dimensions[4].height = 28

    for col, named in [("C", "List_Impact"), ("D", "List_Probability"), ("F", "List_Owners"), ("H", "List_RiskStatus")]:
        dv = DataValidation(type="list", formula1=f"={named}", allow_blank=True)
        dv.sqref = f"{col}5:{col}{last}"
        ws.add_data_validation(dv)
    return ws


def build_dependencies(wb: Workbook, tasks: list[dict]):
    ws = wb.create_sheet("Dependencies", 4)
    set_print(ws)
    ws["A1"] = "DEPENDENCIES REGISTER"
    ws["A1"].font = Font(name="Calibri", bold=True, size=16, color=BLUE_HEADER)
    ws["A2"] = "Overdue dependencies (Expected Date < TODAY and Status ≠ Satisfied) are highlighted."
    ws["A2"].font = Font(italic=True, size=10, color="666666")

    headers = [
        "Dependency ID",
        "Task",
        "Depends On",
        "Owner",
        "Expected Date",
        "Actual Date",
        "Status",
    ]
    for c, h in enumerate(headers, 1):
        ws.cell(row=4, column=c, value=h)
    style_header_row(ws, 4, 1, len(headers))

    by_id = {t["id"]: t for t in tasks}
    deps = [t for t in tasks if t["dependency"]]
    rng = random.Random(11)

    for i, t in enumerate(deps):
        r = 5 + i
        pred = by_id.get(t["dependency"])
        expected = pred["end"] if pred else t["start"]
        status = "Satisfied" if pred and pred["status"] == "Completed" else (
            "Overdue" if expected < date(2026, 10, 1) and t["status"] != "Completed" else "Open"
        )
        # Bias some overdue for demo
        if t["status"] == "Blocked":
            status = "Overdue"
        actual = expected + timedelta(days=rng.randint(0, 3)) if status == "Satisfied" else None

        ws.cell(row=r, column=1, value=f"D-{i+1:03d}")
        ws.cell(row=r, column=2, value=t["id"])
        ws.cell(row=r, column=3, value=t["dependency"])
        ws.cell(row=r, column=4, value=t["owner"])
        ws.cell(row=r, column=5, value=expected).number_format = "DD-MMM-YYYY"
        cell_a = ws.cell(row=r, column=6, value=actual)
        cell_a.number_format = "DD-MMM-YYYY"
        # Status formula override for live overdue detection while keeping seed value as baseline
        ws.cell(
            row=r,
            column=7,
            value=(
                f'=IF(AND(E{r}<TODAY(),OR(F{r}="",F{r}>E{r}),F{r}=""),"Overdue",'
                f'IF(F{r}<>"","Satisfied","Open"))'
                if status != "Satisfied"
                else "Satisfied"
            ),
        )
        # Better: always formula-driven
        ws.cell(
            row=r,
            column=7,
            value=(
                f'=IF(F{r}<>"","Satisfied",IF(E{r}<TODAY(),"Overdue","Open"))'
            ),
        )
        for c in range(1, 8):
            ws.cell(row=r, column=c).border = thin
            ws.cell(row=r, column=c).font = Font(name="Calibri", size=10)

    last = 4 + max(len(deps), 1)
    if deps:
        add_table(ws, "tblDependencies", f"A4:G{last}")
        ws.conditional_formatting.add(
            f"A5:G{last}",
            FormulaRule(
                formula=['$G5="Overdue"'],
                fill=PatternFill("solid", fgColor=RED),
            ),
        )

    for col, w in zip("ABCDEFG", [14, 12, 12, 18, 14, 14, 12]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A5"
    return ws, len(deps)


def build_gantt(wb: Workbook, tasks: list[dict]):
    ws = wb.create_sheet("Gantt Chart", 5)
    set_print(ws)
    weeks = week_starts(FY_START, FY_END)
    months = month_starts(FY_START, FY_END)

    ws["A1"] = "GANTT CHART — FY27 (Weekly / Monthly / Quarterly)"
    ws["A1"].font = Font(name="Calibri", bold=True, size=16, color=BLUE_HEADER)
    ws.merge_cells("A1:L1")
    ws["A2"] = (
        "Bars auto-highlight from Start/End. Legend: Green=Completed · Blue=In Progress · "
        "Yellow=At Risk · Red=Blocked/Critical · Grey=Not Started · ◆=Milestone week · Orange header=Current week"
    )
    ws["A2"].font = Font(italic=True, size=9, color="666666")
    ws.merge_cells("A2:L2")

    # Meta columns
    meta = ["Task ID", "Task Name", "Owner", "Status", "Start", "End", "% Complete", "Critical"]
    header_row = 4
    for c, h in enumerate(meta, 1):
        ws.cell(row=header_row, column=c, value=h)
    style_header_row(ws, header_row, 1, len(meta))

    # Week headers start at column 9
    week_col0 = 9
    for i, w in enumerate(weeks):
        col = week_col0 + i
        cell = ws.cell(row=header_row, column=col, value=w)
        cell.number_format = "DD-MMM"
        cell.fill = PatternFill("solid", fgColor=BLUE_ACCENT)
        cell.font = Font(name="Calibri", bold=True, color=WHITE, size=8)
        cell.alignment = Alignment(horizontal="center", textRotation=90)
        ws.column_dimensions[get_column_letter(col)].width = 3.2
        # Current week indicator (formula on row 3)
        tip = ws.cell(row=3, column=col)
        tip.value = f'=IF(AND(TODAY()>={get_column_letter(col)}$4,TODAY()<{get_column_letter(col)}$4+7),"▶","")'
        tip.font = Font(color="C65911", bold=True, size=10)
        tip.alignment = Alignment(horizontal="center")

    # Current week header CF
    last_week_col = week_col0 + len(weeks) - 1
    ws.conditional_formatting.add(
        f"{get_column_letter(week_col0)}4:{get_column_letter(last_week_col)}4",
        FormulaRule(
            formula=[f'AND(TODAY()>={get_column_letter(week_col0)}4,TODAY()<{get_column_letter(week_col0)}4+7)'],
            fill=PatternFill("solid", fgColor=ORANGE),
            font=Font(bold=True, color="000000", size=8),
        ),
    )
    # Fix: relative formula for each column - openpyxl applies formula relative to top-left
    # The formula above only works for first cell adjustment. Use a helper row with week start dates
    # already in row 4 — FormulaRule adjusts relatively. Good.

    # Task rows — use formulas referencing Project Tracker where possible for live sync
    # For Gantt performance/clarity, embed dates and use local formulas for bars
    for i, t in enumerate(tasks):
        r = header_row + 1 + i
        ws.cell(row=r, column=1, value=t["id"])
        ws.cell(row=r, column=2, value=t["name"])
        ws.cell(row=r, column=3, value=t["owner"])
        ws.cell(row=r, column=4, value=t["status"])
        ws.cell(row=r, column=5, value=t["start"]).number_format = "DD-MMM-YY"
        ws.cell(row=r, column=6, value=t["end"]).number_format = "DD-MMM-YY"
        ws.cell(row=r, column=7, value=t["pct"] / 100).number_format = "0%"
        ws.cell(row=r, column=8, value="Yes" if t["critical"] else "No")
        for c in range(1, 9):
            ws.cell(row=r, column=c).border = thin
            ws.cell(row=r, column=c).font = Font(name="Calibri", size=9)

        for wi, w in enumerate(weeks):
            col = week_col0 + wi
            col_letter = get_column_letter(col)
            # 1 if week overlaps task; show diamond for short tasks (<=3 days) as milestone-like
            # Value encodes status for CF: C/I/A/B/N/X
            formula = (
                f'=IF(OR($E{r}="",$F{r}=""),"",'
                f'IF(AND({col_letter}$4<=$F{r},{col_letter}$4+6>=$E{r}),'
                f'IF($F{r}-$E{r}<=2,"◆",'
                f'IF($H{r}="Yes","X",LEFT($D{r},1))),""))'
            )
            cell = ws.cell(row=r, column=col, value=formula)
            cell.alignment = Alignment(horizontal="center")
            cell.font = Font(size=8)

    last_row = header_row + len(tasks)

    # CF for gantt cells by letter codes
    gantt_range = f"{get_column_letter(week_col0)}5:{get_column_letter(last_week_col)}{last_row}"
    rules = [
        ('"C"', GREEN, GREEN_FONT),
        ('"I"', BLUE_PROG, BLUE_FONT),
        ('"A"', YELLOW, YELLOW_FONT),
        ('"B"', RED, RED_FONT),
        ('"N"', GREY, GREY_FONT),
        ('"X"', CRITICAL_RED, WHITE),
        ('"◆"', "7030A0", WHITE),
    ]
    for val, fill, font_c in rules:
        ws.conditional_formatting.add(
            gantt_range,
            CellIsRule(
                operator="equal",
                formula=[val],
                fill=PatternFill("solid", fgColor=fill),
                font=Font(color=font_c, size=8, bold=True),
            ),
        )

    # Status column CF
    for status, fill, font_c in [
        ("Completed", GREEN, GREEN_FONT),
        ("In Progress", BLUE_PROG, BLUE_FONT),
        ("At Risk", YELLOW, YELLOW_FONT),
        ("Blocked", RED, RED_FONT),
        ("Not Started", GREY, GREY_FONT),
    ]:
        ws.conditional_formatting.add(
            f"D5:D{last_row}",
            CellIsRule(
                operator="equal",
                formula=[f'"{status}"'],
                fill=PatternFill("solid", fgColor=fill),
                font=Font(color=font_c, bold=True, size=9),
            ),
        )

    for col, w in zip("ABCDEFGH", [10, 34, 14, 12, 11, 11, 10, 9]):
        ws.column_dimensions[col].width = w

    ws.freeze_panes = "I5"

    # ── Monthly summary strip below weekly gantt ──
    month_row = last_row + 3
    ws.cell(row=month_row, column=1, value="MONTHLY VIEW — Task count active per month (formula)")
    ws.cell(row=month_row, column=1).font = Font(bold=True, color=BLUE_HEADER, size=12)
    m_header = month_row + 1
    ws.cell(row=m_header, column=1, value="Month")
    style_header_row(ws, m_header, 1, 1)
    for i, m in enumerate(months):
        col = 2 + i
        ws.cell(row=m_header, column=col, value=m).number_format = "MMM-YY"
        ws.cell(row=m_header, column=col).fill = PatternFill("solid", fgColor=BLUE_HEADER)
        ws.cell(row=m_header, column=col).font = Font(bold=True, color=WHITE, size=9)
        # Count tasks overlapping month
        # Month end = EOMONTH
        ws.cell(
            row=m_header + 1,
            column=col,
            value=(
                f'=SUMPRODUCT(('
                f"'Project Tracker'!$N$5:$N${4+len(tasks)}<="
                f"EOMONTH({get_column_letter(col)}${m_header},0))*"
                f"('Project Tracker'!$O$5:$O${4+len(tasks)}>="
                f"{get_column_letter(col)}${m_header})*1)"
            ),
        )

    # Quarterly utilization strip
    q_row = m_header + 4
    ws.cell(row=q_row, column=1, value="QUARTERLY VIEW — Active tasks by quarter")
    ws.cell(row=q_row, column=1).font = Font(bold=True, color=BLUE_HEADER, size=12)
    quarters = [
        ("FY27-Q1", date(2026, 7, 1), date(2026, 9, 30)),
        ("FY27-Q2", date(2026, 10, 1), date(2026, 12, 31)),
        ("FY27-Q3", date(2027, 1, 1), date(2027, 3, 31)),
        ("FY27-Q4", date(2027, 4, 1), date(2027, 6, 30)),
    ]
    for i, (label, qs, qe) in enumerate(quarters):
        col = 2 + i
        ws.cell(row=q_row + 1, column=col, value=label)
        ws.cell(row=q_row + 1, column=col).fill = PatternFill("solid", fgColor=BLUE_ACCENT)
        ws.cell(row=q_row + 1, column=col).font = Font(bold=True, color=WHITE)
        ws.cell(row=q_row + 2, column=col, value=qs).number_format = "DD-MMM-YY"
        ws.cell(row=q_row + 3, column=col, value=qe).number_format = "DD-MMM-YY"
        ws.cell(
            row=q_row + 4,
            column=col,
            value=(
                f"=SUMPRODUCT(("
                f"'Project Tracker'!$N$5:$N${4+len(tasks)}<={get_column_letter(col)}{q_row+3})*"
                f"('Project Tracker'!$O$5:$O${4+len(tasks)}>={get_column_letter(col)}{q_row+2})*1)"
            ),
        )
        ws.cell(row=q_row + 2, column=1, value="Start")
        ws.cell(row=q_row + 3, column=1, value="End")
        ws.cell(row=q_row + 4, column=1, value="Active Tasks")

    return ws


def build_resources(wb: Workbook, resources: list[dict], tasks: list[dict], n_tasks: int):
    ws = wb.create_sheet("Resource Planning", 6)
    set_print(ws)
    ws["A1"] = "RESOURCE PLANNING — CAPACITY & UTILIZATION"
    ws["A1"].font = Font(name="Calibri", bold=True, size=16, color=BLUE_HEADER)
    ws["A2"] = "Allocated Hours roll up from Project Tracker by Owner. Utilization & Overallocation are formula-driven."
    ws["A2"].font = Font(italic=True, size=10, color="666666")

    headers = [
        "Resource",
        "Role",
        "Capacity (h)",
        "Allocated Hours",
        "Remaining Hours",
        "Utilization %",
        "Vacation (h)",
        "Leave (h)",
        "Overallocated?",
    ]
    for c, h in enumerate(headers, 1):
        ws.cell(row=4, column=c, value=h)
    style_header_row(ws, 4, 1, len(headers))

    tracker_last = 4 + n_tasks
    for i, res in enumerate(resources):
        r = 5 + i
        ws.cell(row=r, column=1, value=res["resource"])
        ws.cell(row=r, column=2, value=res["role"])
        ws.cell(row=r, column=3, value=res["capacity"])
        # Allocated = SUMIF Planned Hours by Owner
        ws.cell(
            row=r,
            column=4,
            value=f"=SUMIF('Project Tracker'!$J$5:$J${tracker_last},A{r},'Project Tracker'!$R$5:$R${tracker_last})",
        )
        # Remaining = Capacity - Vacation - Leave - Allocated
        ws.cell(row=r, column=5, value=f"=C{r}-G{r}-H{r}-D{r}")
        # Utilization = Allocated / (Capacity - Vac - Leave)
        ws.cell(
            row=r,
            column=6,
            value=f'=IF((C{r}-G{r}-H{r})=0,0,D{r}/(C{r}-G{r}-H{r}))',
        ).number_format = "0.0%"
        ws.cell(row=r, column=7, value=res["vacation"])
        ws.cell(row=r, column=8, value=res["leave"])
        ws.cell(row=r, column=9, value=f'=IF(D{r}>(C{r}-G{r}-H{r}),"YES","")')
        for c in range(1, 10):
            ws.cell(row=r, column=c).border = thin
            ws.cell(row=r, column=c).font = Font(name="Calibri", size=10)

    last = 4 + len(resources)
    add_table(ws, "tblResources", f"A4:I{last}")

    # Heatmap on Utilization
    ws.conditional_formatting.add(
        f"F5:F{last}",
        ColorScaleRule(
            start_type="num", start_value=0, start_color="63BE7B",
            mid_type="num", mid_value=0.85, mid_color="FFEB84",
            end_type="num", end_value=1.2, end_color="F8696B",
        ),
    )
    ws.conditional_formatting.add(
        f"I5:I{last}",
        CellIsRule(operator="equal", formula=['"YES"'], fill=PatternFill("solid", fgColor=RED), font=Font(color=RED_FONT, bold=True)),
    )

    for col, w in zip("ABCDEFGHI", [18, 26, 12, 14, 14, 12, 12, 10, 14]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A5"

    # Utilization chart data already in table — bar chart
    chart = BarChart()
    chart.type = "col"
    chart.title = "Resource Utilization %"
    chart.y_axis.title = "Utilization"
    chart.x_axis.title = "Resource"
    data = Reference(ws, min_col=6, min_row=4, max_row=last)
    cats = Reference(ws, min_col=1, min_row=5, max_row=last)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.shape = 4
    chart.height = 10
    chart.width = 18
    ws.add_chart(chart, "K4")

    # Monthly allocation matrix
    months = month_starts(FY_START, FY_END)
    m_row = last + 3
    ws.cell(row=m_row, column=1, value="MONTHLY ALLOCATION (Planned Hours by Owner × Month)")
    ws.cell(row=m_row, column=1).font = Font(bold=True, color=BLUE_HEADER, size=12)
    ws.cell(row=m_row + 1, column=1, value="Resource")
    ws.cell(row=m_row + 1, column=1).fill = PatternFill("solid", fgColor=BLUE_HEADER)
    ws.cell(row=m_row + 1, column=1).font = Font(bold=True, color=WHITE)
    for i, m in enumerate(months):
        cell = ws.cell(row=m_row + 1, column=2 + i, value=m)
        cell.number_format = "MMM-YY"
        cell.fill = PatternFill("solid", fgColor=BLUE_HEADER)
        cell.font = Font(bold=True, color=WHITE, size=9)

    for ri, res in enumerate(resources):
        r = m_row + 2 + ri
        ws.cell(row=r, column=1, value=res["resource"])
        for mi, m in enumerate(months):
            col = 2 + mi
            # Approximate: planned hours * overlap fraction — use SUMIFS-like SUMPRODUCT
            # Hours credited if task overlaps month and owner matches
            cl = get_column_letter(col)
            ws.cell(
                row=r,
                column=col,
                value=(
                    f'=SUMPRODUCT(('
                    f"'Project Tracker'!$J$5:$J${tracker_last}=A{r})*"
                    f"('Project Tracker'!$N$5:$N${tracker_last}<="
                    f"EOMONTH({cl}${m_row+1},0))*"
                    f"('Project Tracker'!$O$5:$O${tracker_last}>={cl}${m_row+1})*"
                    f"('Project Tracker'!$R$5:$R${tracker_last}))"
                ),
            )
            ws.cell(row=r, column=col).number_format = "0"

    month_last_row = m_row + 1 + len(resources)
    month_last_col = 1 + len(months)
    ws.conditional_formatting.add(
        f"B{m_row+2}:{get_column_letter(month_last_col)}{month_last_row}",
        ColorScaleRule(
            start_type="min", start_color="FFFFFF",
            mid_type="percentile", mid_value=50, mid_color="9BC2E6",
            end_type="max", end_color="1F4E79",
        ),
    )

    # Quarter-wise utilization
    q_row = month_last_row + 3
    ws.cell(row=q_row, column=1, value="QUARTER-WISE UTILIZATION %")
    ws.cell(row=q_row, column=1).font = Font(bold=True, color=BLUE_HEADER, size=12)
    quarters = ["FY27-Q1", "FY27-Q2", "FY27-Q3", "FY27-Q4"]
    q_months = [(0, 2), (3, 5), (6, 8), (9, 11)]
    ws.cell(row=q_row + 1, column=1, value="Resource").fill = PatternFill("solid", fgColor=BLUE_HEADER)
    ws.cell(row=q_row + 1, column=1).font = Font(bold=True, color=WHITE)
    for i, q in enumerate(quarters):
        cell = ws.cell(row=q_row + 1, column=2 + i, value=q)
        cell.fill = PatternFill("solid", fgColor=BLUE_ACCENT)
        cell.font = Font(bold=True, color=WHITE)

    for ri, res in enumerate(resources):
        r = q_row + 2 + ri
        src_r = m_row + 2 + ri
        ws.cell(row=r, column=1, value=res["resource"])
        for qi, (a, b) in enumerate(q_months):
            start_c = get_column_letter(2 + a)
            end_c = get_column_letter(2 + b)
            # utilization proxy = quarter hours / (capacity/4)
            ws.cell(
                row=r,
                column=2 + qi,
                value=f'=IF(C{5+ri}=0,0,SUM({start_c}{src_r}:{end_c}{src_r})/(C{5+ri}/4))',
            ).number_format = "0%"

    q_last = q_row + 1 + len(resources)
    ws.conditional_formatting.add(
        f"B{q_row+2}:E{q_last}",
        ColorScaleRule(
            start_type="num", start_value=0, start_color="63BE7B",
            mid_type="num", mid_value=0.9, mid_color="FFEB84",
            end_type="num", end_value=1.3, end_color="F8696B",
        ),
    )
    return ws


def build_dashboard(wb: Workbook, n_tasks: int, n_milestones: int, n_resources: int):
    ws = wb.create_sheet("Dashboard", 0)  # move to front later
    set_print(ws)

    # Title band
    ws.merge_cells("A1:N1")
    ws["A1"] = "FY27 ENGINEERING EXECUTIVE DASHBOARD"
    ws["A1"].font = Font(name="Calibri", bold=True, size=20, color=WHITE)
    ws["A1"].fill = PatternFill("solid", fgColor=BLUE_HEADER)
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 36

    ws.merge_cells("A2:N2")
    ws["A2"] = (
        f"Governance view  |  {FY_START.strftime('%d %b %Y')} – {FY_END.strftime('%d %b %Y')}  |  "
        "All KPIs formula-linked to Project Tracker · Refresh values by recalculating workbook"
    )
    ws["A2"].font = Font(name="Calibri", italic=True, size=10, color="666666")
    ws["A2"].alignment = Alignment(horizontal="center")

    t_last = 4 + n_tasks
    m_last = 4 + n_milestones

    # KPI labels / values
    kpis = [
        ("B4", "B5", "Total Projects", f"=COUNTA('Lookup Lists'!$E$5:$E${4 + max(len(PROJECTS), 1)})"),
        ("D4", "D5", "Total Tasks", f"=COUNTA('Project Tracker'!$A$5:$A${t_last})"),
        ("F4", "F5", "Completed", f'=COUNTIF(\'Project Tracker\'!$M$5:$M${t_last},"Completed")'),
        ("H4", "H5", "In Progress", f'=COUNTIF(\'Project Tracker\'!$M$5:$M${t_last},"In Progress")'),
        ("J4", "J5", "Blocked", f'=COUNTIF(\'Project Tracker\'!$M$5:$M${t_last},"Blocked")'),
        ("L4", "L5", "At Risk", f'=COUNTIF(\'Project Tracker\'!$M$5:$M${t_last},"At Risk")'),
        ("B7", "B8", "Overall Progress %", f"=IFERROR(AVERAGE('Project Tracker'!$Q$5:$Q${t_last}),0)"),
        ("D7", "D8", "Hours Planned", f"=SUM('Project Tracker'!$R$5:$R${t_last})"),
        ("F7", "F8", "Hours Actual", f"=SUM('Project Tracker'!$S$5:$S${t_last})"),
        ("H7", "H8", "Budget Consumed", f"=SUM('Project Tracker'!$U$5:$U${t_last})"),
        ("J7", "J8", "Upcoming Milestones", f'=COUNTIF(Milestones!$H$5:$H${m_last},"YES")'),
        ("L7", "L8", "Overdue Dependencies", f'=COUNTIF(Dependencies!$G$5:$G$200,"Overdue")'),
    ]

    for label_cell, value_cell, label, formula in kpis:
        ws[label_cell] = label
        ws[label_cell].font = Font(name="Calibri", bold=True, size=9, color="666666")
        ws[label_cell].alignment = Alignment(horizontal="center")
        ws[value_cell] = formula
        ws[value_cell].font = Font(name="Calibri", bold=True, size=18, color=BLUE_HEADER)
        ws[value_cell].alignment = Alignment(horizontal="center")
        ws[value_cell].fill = PatternFill("solid", fgColor=LIGHT_BLUE)
        ws[value_cell].border = thin
        if "Progress" in label:
            ws[value_cell].number_format = "0.0%"
        if "Budget" in label:
            ws[value_cell].number_format = '#,##0'

    # Chart data blocks (hidden-ish area starting column P)
    ws["P3"] = "Status"
    ws["Q3"] = "Count"
    for i, status in enumerate(STATUSES, start=4):
        ws.cell(row=i, column=16, value=status)
        ws.cell(row=i, column=17, value=f'=COUNTIF(\'Project Tracker\'!$M$5:$M${t_last},P{i})')

    # Donut by Status
    donut = DoughnutChart()
    donut.title = "Tasks by Status"
    labels = Reference(ws, min_col=16, min_row=4, max_row=8)
    data = Reference(ws, min_col=17, min_row=3, max_row=8)
    donut.add_data(data, titles_from_data=True)
    donut.set_categories(labels)
    donut.dataLabels = DataLabelList()
    donut.dataLabels.showPercent = True
    donut.dataLabels.showVal = False
    donut.dataLabels.showCatName = True
    donut.width = 12
    donut.height = 8
    ws.add_chart(donut, "B11")

    # Owner bar data
    ws["P11"] = "Owner"
    ws["Q11"] = "Tasks"
    for i, owner in enumerate(OWNERS, start=12):
        ws.cell(row=i, column=16, value=owner)
        ws.cell(row=i, column=17, value=f'=COUNTIF(\'Project Tracker\'!$J$5:$J${t_last},P{i})')

    bar = BarChart()
    bar.type = "bar"
    bar.title = "Tasks by Owner"
    data = Reference(ws, min_col=17, min_row=11, max_row=11 + len(OWNERS))
    cats = Reference(ws, min_col=16, min_row=12, max_row=11 + len(OWNERS))
    bar.add_data(data, titles_from_data=True)
    bar.set_categories(cats)
    bar.shape = 4
    bar.width = 14
    bar.height = 10
    ws.add_chart(bar, "H11")

    # Progress line / monthly burn-up data
    months = month_starts(FY_START, FY_END)
    ws["P26"] = "Month"
    ws["Q26"] = "Cumulative Completed %"
    ws["R26"] = "Planned Burn-up %"
    for i, m in enumerate(months):
        row = 27 + i
        ws.cell(row=row, column=16, value=m).number_format = "MMM-YY"
        # Cumulative completed tasks with end date <= month end / total
        ws.cell(
            row=row,
            column=17,
            value=(
                f'=IFERROR(COUNTIFS(\'Project Tracker\'!$M$5:$M${t_last},"Completed",'
                f"'Project Tracker'!$O$5:$O${t_last},\"<=\"&EOMONTH(P{row},0))/"
                f"COUNTA('Project Tracker'!$A$5:$A${t_last}),0)"
            ),
        ).number_format = "0%"
        # Linear planned burn-up
        ws.cell(row=row, column=18, value=(i + 1) / len(months)).number_format = "0%"

    line = LineChart()
    line.title = "Monthly Burn-up (Completed % vs Plan)"
    line.y_axis.title = "Progress"
    line.x_axis.title = "Month"
    data = Reference(ws, min_col=17, min_row=26, max_col=18, max_row=26 + len(months))
    cats = Reference(ws, min_col=16, min_row=27, max_row=26 + len(months))
    line.add_data(data, titles_from_data=True)
    line.set_categories(cats)
    line.width = 16
    line.height = 9
    ws.add_chart(line, "B28")

    # Release progress
    ws["P42"] = "Release"
    ws["Q42"] = "Avg % Complete"
    for i, rel in enumerate(RELEASES, start=43):
        ws.cell(row=i, column=16, value=rel)
        ws.cell(
            row=i,
            column=17,
            value=f'=IFERROR(AVERAGEIF(\'Project Tracker\'!$Z$5:$Z${t_last},P{i},\'Project Tracker\'!$Q$5:$Q${t_last}),0)',
        ).number_format = "0%"

    rel_chart = BarChart()
    rel_chart.type = "col"
    rel_chart.title = "Release Progress (Avg % Complete)"
    data = Reference(ws, min_col=17, min_row=42, max_row=42 + len(RELEASES))
    cats = Reference(ws, min_col=16, min_row=43, max_row=42 + len(RELEASES))
    rel_chart.add_data(data, titles_from_data=True)
    rel_chart.set_categories(cats)
    rel_chart.width = 14
    rel_chart.height = 9
    ws.add_chart(rel_chart, "H28")

    # Resource utilization snapshot (links)
    ws["B44"] = "Resource Utilization (see Resource Planning sheet for heatmap & detail)"
    ws["B44"].font = Font(bold=True, color=BLUE_HEADER, size=12)
    ws["B45"] = "Avg Utilization"
    ws["C45"] = f"=IFERROR(AVERAGE('Resource Planning'!$F$5:$F${4+n_resources}),0)"
    ws["C45"].number_format = "0.0%"
    ws["C45"].font = Font(bold=True, size=14, color=BLUE_HEADER)
    ws["B46"] = "Overallocated Resources"
    ws["C46"] = f'=COUNTIF(\'Resource Planning\'!$I$5:$I${4+n_resources},"YES")'
    ws["C46"].font = Font(bold=True, size=14, color=RED_FONT)

    # Progress line chart (overall vs months) — already have burn-up
    ws["B48"] = "LINE CHART — Progress trend uses Monthly Burn-up above."
    ws["B48"].font = Font(italic=True, size=9, color="666666")

    # Legend / instructions
    ws["B50"] = "STATUS LEGEND"
    ws["B50"].font = Font(bold=True, color=BLUE_HEADER)
    legend = [
        ("Completed", GREEN, GREEN_FONT),
        ("In Progress", BLUE_PROG, BLUE_FONT),
        ("At Risk", YELLOW, YELLOW_FONT),
        ("Blocked", RED, RED_FONT),
        ("Not Started", GREY, GREY_FONT),
    ]
    for i, (name, fill, fc) in enumerate(legend):
        cell = ws.cell(row=51 + i, column=2, value=name)
        cell.fill = PatternFill("solid", fgColor=fill)
        cell.font = Font(bold=True, color=fc)

    ws["D50"] = "HOW TO USE"
    ws["D50"].font = Font(bold=True, color=BLUE_HEADER)
    ws["D51"] = "1. Update Project Tracker (status, dates, hours) — Dashboard KPIs refresh automatically."
    ws["D52"] = "2. Maintain dropdown values on Lookup Lists sheet (named ranges)."
    ws["D53"] = "3. Review Gantt Chart weekly; orange ▶ marks current week."
    ws["D54"] = "4. Clear overdue Dependencies and High/Critical Risks in governance."
    ws["D55"] = "5. Print Dashboard / Tracker in Landscape for CTO pack."

    for col in range(1, 15):
        ws.column_dimensions[get_column_letter(col)].width = 12
    ws.column_dimensions["P"].width = 18
    ws.column_dimensions["Q"].width = 12
    ws.column_dimensions["R"].width = 14

    # Hide helper columns visually by grouping note — keep visible for auditability
    ws["P1"] = "CHART DATA (do not delete)"
    ws["P1"].font = Font(size=8, color="999999")

    return ws


def finalize_sheet_order(wb: Workbook):
    order = [
        "Dashboard",
        "Project Tracker",
        "Gantt Chart",
        "Resource Planning",
        "Milestones",
        "Risks & Issues",
        "Dependencies",
        "Lookup Lists",
    ]
    for idx, name in enumerate(order):
        current = wb.sheetnames.index(name)
        if current != idx:
            wb.move_sheet(wb[name], offset=idx - current)


def main():
    parser = argparse.ArgumentParser(description="Generate FY27 Engineering Project Tracker from FY27 V1")
    parser.add_argument(
        "--source",
        type=Path,
        default=SOURCE_WORKBOOK,
        help="Path to FY 27 Draft Planning.xlsx",
    )
    parser.add_argument(
        "--sheet",
        default=SOURCE_SHEET,
        help="Source sheet name (default: FY27 V1)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT,
        help="Output workbook path",
    )
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading actual data from {args.source} [{args.sheet}]…")
    tasks = load_tasks_from_fy27_v1(args.source, args.sheet)
    print(
        f"Loaded {len(tasks)} tasks | projects={len(PROJECTS)} | owners={OWNERS} | "
        f"categories={len(CATEGORIES)}"
    )

    milestones = generate_milestones(tasks)
    risks = generate_risks(tasks)
    resources = generate_resources(tasks)

    wb = Workbook()
    default = wb.active
    wb.remove(default)

    print("Building Lookup Lists…")
    build_lookup(wb)

    print("Building Project Tracker…")
    _, tracker_last = build_tracker(wb, tasks)
    n_tasks = len(tasks)

    print("Building Milestones…")
    build_milestones(wb, milestones)

    print("Building Risks & Issues…")
    build_risks(wb, risks)

    print("Building Dependencies…")
    build_dependencies(wb, tasks)

    print("Building Gantt Chart…")
    build_gantt(wb, tasks)

    print("Building Resource Planning…")
    build_resources(wb, resources, tasks, n_tasks)

    print("Building Dashboard…")
    build_dashboard(wb, n_tasks, len(milestones), len(resources))

    finalize_sheet_order(wb)

    wb.properties.title = "FY27 Engineering Project Tracker"
    wb.properties.creator = "EMOS PMO Generator"
    wb.properties.description = (
        f"Generated from {args.source.name} / {args.sheet}. "
        "Formula-driven tracker for weekly governance and CTO reviews."
    )

    print(f"Writing {args.output}…")
    wb.save(args.output)
    print(f"Done. Sheets: {wb.sheetnames}")
    print(
        f"Tasks: {n_tasks} | Milestones: {len(milestones)} | "
        f"Risks: {len(risks)} | Resources: {len(resources)}"
    )
    print(f"Source: {args.source}!{args.sheet}")


if __name__ == "__main__":
    main()