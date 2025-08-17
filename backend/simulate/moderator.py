#!/usr/bin/env python3
import os, sys, json, random, sqlite3, uuid, time, importlib
from typing import Optional, Tuple
from datetime import datetime, date, time as dtime, timedelta, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))  # /app/simulate
ROOT = os.path.dirname(ROOT)                       # /app
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import rt_latest

try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except Exception:
    print("This script requires Python 3.9+ with zoneinfo.", file=sys.stderr)
    sys.exit(1)

import urllib.request
import urllib.parse

DEFAULT_DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")
GRIDSTATUS_API_KEY = os.environ.get("GRIDSTATUS_API_KEY", "").strip()

RT_LATEST_FUNC = os.environ.get("RT_LATEST_FUNC", "../app:rt_latest")

def _resolve_func(spec: str):
    """
    "package.module:funcname" -> returns the callable
    """
    if ":" not in spec:
        raise ValueError("RT_LATEST_FUNC must look like 'package.module:funcname'")
    mod_name, func_name = spec.split(":", 1)
    mod = importlib.import_module(mod_name)
    fn = getattr(mod, func_name)
    if not callable(fn):
        raise TypeError(f"{spec} is not callable")
    return fn

# ---- Schema (adds approval snapshot columns if missing) ----
ORDERS_BASE_SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  market TEXT NOT NULL,
  location_type TEXT NOT NULL,
  location TEXT NOT NULL,
  hour_start_utc TEXT NOT NULL,
  side TEXT NOT NULL,
  qty_mwh REAL NOT NULL,
  limit_price REAL NOT NULL,
  status TEXT NOT NULL,               -- 'PENDING'|'APPROVED'|'REJECTED'|'CLEARED'|'UNFILLED'
  reject_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_hour_loc ON orders(hour_start_utc, location);
"""

# Columns we will ensure exist for approval snapshot storage
APPROVAL_COLUMNS = {
    "approved_at": "TEXT",
    "approval_rt_interval_start_utc": "TEXT",
    "approval_rt_lmp": "REAL",
    "approval_rt_source": "TEXT",
    "approval_rt_payload": "TEXT"
}

def ensure_db(path: str) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL;")
    con.executescript(ORDERS_BASE_SCHEMA)
    ensure_approval_columns(con)
    return con

def table_has_column(con: sqlite3.Connection, table: str, column: str) -> bool:
    cur = con.execute(f"PRAGMA table_info({table});")
    cols = {row["name"] for row in cur.fetchall()}
    return column in cols

def ensure_approval_columns(con: sqlite3.Connection):
    for col, typ in APPROVAL_COLUMNS.items():
        if not table_has_column(con, "orders", col):
            con.execute(f"ALTER TABLE orders ADD COLUMN {col} {typ};")
    con.commit()

# ---- Small CLI helpers ----
def ask(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default is not None else ""
    while True:
        s = input(f"{prompt}{suffix}: ").strip()
        if not s and default is not None: return default
        if s: return s

def ask_choice(prompt: str, choices: list[str], default_index: int = 0) -> str:
    for i, c in enumerate(choices, 1):
        print(f"{i}. {c}")
    while True:
        s = ask(prompt, str(default_index + 1))
        try:
            k = int(s)
            if 1 <= k <= len(choices):
                return choices[k - 1]
        except ValueError:
            pass
        print(f"Enter a number between 1 and {len(choices)}.")

def ask_float(prompt: str, default: float, lo: float, hi: float) -> float:
    while True:
        s = ask(prompt, str(default))
        try:
            v = float(s)
            if not (lo <= v <= hi):
                print(f"Value must be between {lo} and {hi}.")
                continue
            return v
        except ValueError:
            print("Please enter a number.")

def fmt_hour_range(start: datetime, end: datetime) -> str:
    def fmt(dt: datetime) -> str:
        hour = dt.strftime("%I").lstrip("0") or "12"
        return f"{hour} {dt.strftime('%p')} {dt.strftime('%Z')}"
    return f"{fmt(start)} to {fmt(end)}"

def choose_et_hour_start() -> str:
    today_et = datetime.now(ET).date()
    dstr = ask("Enter ET operating date (YYYY-MM-DD)", today_et.isoformat())
    try:
        y, m, dd = map(int, dstr.split("-"))
        day_et = date(y, m, dd)
    except Exception:
        print("Invalid date. Expected YYYY-MM-DD.")
        sys.exit(1)

    slots = []
    for h in range(24):
        start = datetime.combine(day_et, dtime(hour=h, tzinfo=ET))
        end = start + timedelta(hours=1)
        slots.append((start, end))

    print("\nSelect an hour slot (ET):")
    labels = [fmt_hour_range(s, e) for s, e in slots]
    chosen = ask_choice("Choose slot", labels, default_index=0)
    idx = labels.index(chosen)
    start_et, end_et = slots[idx]
    start_utc_iso = iso_utc(start_et)
    print(f"\nChosen: {fmt_hour_range(start_et, end_et)} (UTC start {start_utc_iso})\n")
    return start_utc_iso

def choose_utc_hour_start() -> str:
    now_utc = datetime.now(timezone.utc)
    default_utc = (now_utc.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    s = ask("Enter hour start in UTC (e.g. 2025-08-16T18:00:00Z)", default_utc).upper().strip()
    if s.endswith("Z"): s = s[:-1]
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        print("Invalid UTC datetime.")
        sys.exit(1)
    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
    return iso_utc(dt)

def pick_hour_start_interactive() -> str:
    mode = ask_choice("Select hour input mode", [
        "Hour in America/New_York (menu of time slots)",
        "Hour in UTC (enter ISO time)"
    ], default_index=0)
    return choose_et_hour_start() if mode.startswith("Hour in America/New_York") else choose_utc_hour_start()

def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()

# ---- Real-time snapshot fetch ----
def get_api_key() -> Optional[str]:
    if GRIDSTATUS_API_KEY:
        return GRIDSTATUS_API_KEY
    return None

def fetch_latest_rt_snapshot(location: str, location_type: str):
    """
    Calls app.rt_latest() and expects:
    {
      "market": "pjm",
      "location": "PJM-RTO",
      "data": [
        {
          "interval_start_utc": "...",
          "interval_end_utc":   "...",
          "location": "PJM-RTO",
          "lmp": 32.28,
          "energy": 32.21,
          "congestion": 0.05,
          "loss": 0.02
        }
      ]
    }
    Returns: (interval_start_utc, lmp, source, payload_json_or_error)
    """

    import json

    # map any order-side alias to your app’s location
    LOCATION_MAP = {
        "PJM": "PJM-RTO",
        "PJM RTO": "PJM-RTO",
        "PJM-RTO": "PJM-RTO",
    }
    desired_loc = LOCATION_MAP.get(location, location)

    try:
        # try with args (market, location); fall back to zero-arg if needed
        try:
            out = rt_latest("pjm", desired_loc)
        except TypeError:
            out = rt_latest()

        raw = json.dumps(out, ensure_ascii=False)

        if not isinstance(out, dict):
            return (None, None, "lookup_error", "rt_latest() did not return a dict")

        data = out.get("data") or []
        if not isinstance(data, list) or not data:
            return (None, None, "lookup_error", f"no data rows for {desired_loc}")

        row = data[0]
        interval = row.get("interval_start_utc")
        lmp = row.get("lmp")
        try:
            lmp = float(lmp) if lmp is not None else None
        except Exception:
            lmp = None

        if interval is None or lmp is None:
            return (None, None, "lookup_error", f"missing interval/lmp in row: {row}")

        return (interval, lmp, "local:rt_latest", raw)

    except Exception as e:
        # bubble up a useful error string for debugging
        return (None, None, "lookup_error", f"{type(e).__name__}: {e}")
    
# ---- Approval actions ----
def approve_single_by_id(con: sqlite3.Connection, order_id: str) -> dict:
    r = con.execute("""
      SELECT id, status, location, location_type FROM orders WHERE id=?
    """, (order_id,)).fetchone()
    if not r:
        return {"ok": False, "error": "order_not_found"}

    if r["status"] not in ("PENDING", "REJECTED", "UNFILLED"):
        return {"ok": False, "error": f"invalid_status_for_approval ({r['status']})"}

    approved_at = iso_utc(datetime.now(timezone.utc))

    interval_utc, lmp, source, payload = fetch_latest_rt_snapshot(r["location"], r["location_type"])

    cur = con.cursor()
    cur.execute("BEGIN;")
    cur.execute("""
      UPDATE orders
      SET status='APPROVED',
          reject_reason=NULL,
          approved_at=?,
          approval_rt_interval_start_utc=?,
          approval_rt_lmp=?,
          approval_rt_source=?,
          approval_rt_payload=?
      WHERE id=?
    """, (approved_at, interval_utc, lmp, source, payload, order_id))
    con.commit()

    return {
        "ok": True,
        "order_id": order_id,
        "new_status": "APPROVED",
        "approved_at": approved_at,
        "approval_rt_interval_start_utc": interval_utc,
        "approval_rt_lmp": lmp,
        "approval_rt_source": source
    }

def random_approve_for_hour(con: sqlite3.Connection, hour_start_utc: str, approval_rate: float,
                            seed: Optional[int], location: Optional[str], location_type: Optional[str]) -> dict:
    if seed is not None:
        random.seed(seed)

    q = """
      SELECT id, location, location_type
      FROM orders
      WHERE market='DA'
        AND status='PENDING'
        AND hour_start_utc = ?
    """
    params = [hour_start_utc]
    if location:
        q += " AND location = ?"
        params.append(location)
    if location_type:
        q += " AND location_type = ?"
        params.append(location_type)

    rows = con.execute(q, params).fetchall()
    ids = [dict(id=r["id"], location=r["location"], location_type=r["location_type"]) for r in rows]

    approvals, rejections = [], []
    for r in ids:
        (approvals if random.random() < approval_rate else rejections).append(r)

    cur = con.cursor()
    cur.execute("BEGIN;")

    approved_at = iso_utc(datetime.now(timezone.utc))

    # Approve each → snapshot RT price at approval time
    for r in approvals:
        interval_utc, lmp, source, payload = fetch_latest_rt_snapshot(r["location"], r["location_type"])
        cur.execute("""
          UPDATE orders
          SET status='APPROVED',
              reject_reason=NULL,
              approved_at=?,
              approval_rt_interval_start_utc=?,
              approval_rt_lmp=?,
              approval_rt_source=?,
              approval_rt_payload=?
          WHERE id=?
        """, (approved_at, interval_utc, lmp, source, payload, r["id"]))
        # Be nice to rate limits if you’re approving a lot at once
        time.sleep(0.15)

    # The rest → UNFILLED
    for r in rejections:
        cur.execute("""
          UPDATE orders
          SET status='UNFILLED', reject_reason='moderator_unfilled'
          WHERE id=?
        """, (r["id"],))

    con.commit()

    return {
        "hour_start_utc": hour_start_utc,
        "filters": {"location": location, "location_type": location_type},
        "total_candidates": len(ids),
        "approved": len(approvals),
        "unfilled": len(rejections),
        "approved_ids": [x["id"] for x in approvals],
        "unfilled_ids": [x["id"] for x in rejections]
    }

# ---- Main interactive flow ----
def main():
    print("=== Interactive Moderator (approval + RT snapshot) ===\n")
    db_path = ask("SQLite DB path", DEFAULT_DB_PATH)
    con = ensure_db(db_path)

    mode = ask_choice("Choose mode", [
        "A) Approve a single order by ID (captures RT snapshot)",
        "B) Randomly approve PENDING orders for an hour (captures RT snapshot per approval)"
    ], default_index=0)

    if mode.startswith("A)"):
        oid = ask("Enter order ID", "")
        result = approve_single_by_id(con, oid)
        print(json.dumps(result, indent=2))
        return

    # Mode B (hour)
    hour_start_utc = pick_hour_start_interactive()
    location = ask("Filter by location (blank = none)", "") or None
    lt_in = ask("Filter by location_type (HUB/ZONE/GEN or blank)", "").strip().upper() or None
    if lt_in and lt_in not in ("HUB","ZONE","GEN"):
        print("Invalid location_type; allowed: HUB, ZONE, GEN."); sys.exit(1)
    approval_rate = ask_float("Approval rate (0..1)", 0.5, 0.0, 1.0)
    seed_str = ask("Random seed (blank for random)", "")
    seed = int(seed_str) if seed_str else None

    result = random_approve_for_hour(
        con=con,
        hour_start_utc=hour_start_utc,
        approval_rate=approval_rate,
        seed=seed,
        location=location,
        location_type=lt_in
    )
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
