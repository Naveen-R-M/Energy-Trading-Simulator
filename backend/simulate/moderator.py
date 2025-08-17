#!/usr/bin/env python3
import os, sys, json, random, sqlite3, uuid
from typing import Optional
from datetime import datetime, date, time, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except Exception:
    print("This script requires Python 3.9+ with zoneinfo for ET handling.", file=sys.stderr); sys.exit(1)

DEFAULT_DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")

ORDERS_SCHEMA = """
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

def ensure_db(path: str) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    con = sqlite3.connect(path)
    con.execute("PRAGMA journal_mode=WAL;")
    con.executescript(ORDERS_SCHEMA)
    con.row_factory = sqlite3.Row
    return con

def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()

def ask(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default is not None else ""
    while True:
        s = input(f"{prompt}{suffix}: ").strip()
        if not s and default is not None: return default
        if s: return s

def ask_choice(prompt: str, choices: list[str], default_index: int = 0) -> str:
    for i,c in enumerate(choices,1): print(f"{i}. {c}")
    while True:
        s = ask(prompt, str(default_index+1))
        try:
            k = int(s)
            if 1 <= k <= len(choices): return choices[k-1]
        except ValueError: pass
        print(f"Enter a number between 1 and {len(choices)}.")

def ask_float(prompt: str, default: float, lo: float, hi: float) -> float:
    while True:
        s = ask(prompt, str(default))
        try:
            v = float(s)
            if not (lo <= v <= hi): print(f"Value must be between {lo} and {hi}."); continue
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
        y,m,dd = map(int, dstr.split("-")); day_et = date(y,m,dd)
    except Exception:
        print("Invalid date. Expected YYYY-MM-DD."); sys.exit(1)

    slots=[]
    for h in range(24):
        start = datetime.combine(day_et, time(hour=h, tzinfo=ET))
        end = start + timedelta(hours=1)
        slots.append((start, end))
    print("\nSelect an hour slot (ET):")
    labels = [fmt_hour_range(s,e) for s,e in slots]
    chosen = ask_choice("Choose slot", labels, default_index=0)
    idx = labels.index(chosen)
    start_et, end_et = slots[idx]
    start_utc_iso = iso_utc(start_et)
    print(f"\nChosen: {fmt_hour_range(start_et, end_et)} (UTC start {start_utc_iso})\n")
    return start_utc_iso

def choose_utc_hour_start() -> str:
    now_utc = datetime.now(timezone.utc)
    default_utc = (now_utc.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)).isoformat().replace("+00:00","Z")
    s = ask("Enter hour start in UTC (e.g. 2025-08-16T18:00:00Z)", default_utc).upper().strip()
    if s.endswith("Z"): s = s[:-1]
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        print("Invalid UTC datetime."); sys.exit(1)
    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
    return iso_utc(dt)

def pick_hour_start_interactive() -> str:
    mode = ask_choice("Select hour input mode", [
        "Hour in America/New_York (menu of time slots)",
        "Hour in UTC (enter ISO time)"
    ], default_index=0)
    return choose_et_hour_start() if mode.startswith("Hour in America/New_York") else choose_utc_hour_start()

def approve_by_id(con: sqlite3.Connection, order_id: str) -> dict:
    r = con.execute("SELECT id, status FROM orders WHERE id=?", (order_id,)).fetchone()
    if not r:
        return {"ok": False, "error": "order_not_found"}
    if r["status"] not in ("PENDING","REJECTED","UNFILLED"):
        return {"ok": False, "error": f"invalid_status_for_approval ({r['status']})"}
    con.execute("UPDATE orders SET status='APPROVED', reject_reason=NULL WHERE id=?", (order_id,))
    con.commit()
    return {"ok": True, "order_id": order_id, "new_status": "APPROVED"}

def random_approve_for_hour(con: sqlite3.Connection, hour_start_utc: str, approval_rate: float,
                            seed: Optional[int], location: Optional[str], location_type: Optional[str]) -> dict:
    if seed is not None: random.seed(seed)
    q = """
      SELECT id FROM orders
      WHERE market='DA'
        AND status='PENDING'
        AND hour_start_utc = ?
    """
    params = [hour_start_utc]
    if location:
        q += " AND location = ?"; params.append(location)
    if location_type:
        q += " AND location_type = ?"; params.append(location_type)
    rows = con.execute(q, params).fetchall()
    ids = [r["id"] for r in rows]
    approvals, rejections = [], []
    for oid in ids:
        (approvals if random.random() < approval_rate else rejections).append(oid)
    cur = con.cursor()
    cur.execute("BEGIN;")
    for oid in approvals:
        cur.execute("UPDATE orders SET status='APPROVED', reject_reason=NULL WHERE id=?", (oid,))
    for oid in rejections:
        cur.execute("UPDATE orders SET status='UNFILLED', reject_reason='moderator_unfilled' WHERE id=?", (oid,))
    con.commit()
    return {
        "hour_start_utc": hour_start_utc,
        "filters": {"location": location, "location_type": location_type},
        "total_candidates": len(ids),
        "approved": len(approvals),
        "unfilled": len(rejections),
        "approved_ids": approvals,
        "unfilled_ids": rejections
    }

def main():
    print("=== Interactive Moderator (approval stage) ===\n")
    db_path = ask("SQLite DB path", DEFAULT_DB_PATH)
    con = ensure_db(db_path)

    mode = ask_choice("Choose mode", [
        "A) Approve a single order by ID",
        "B) Randomly approve PENDING orders for an hour"
    ], default_index=0)

    if mode.startswith("A)"):
        order_id = ask("Enter order ID", "")
        result = approve_by_id(con, order_id)
        print(json.dumps(result, indent=2))
        return

    # Mode B
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
