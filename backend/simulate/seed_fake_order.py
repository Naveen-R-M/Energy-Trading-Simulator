#!/usr/bin/env python3
import os, sqlite3, sys, uuid
from datetime import datetime, timedelta, time, timezone, date
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except Exception:
    print("This script requires Python 3.9+ for zoneinfo.", file=sys.stderr); sys.exit(1)

DEFAULT_DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")
ET = ZoneInfo("America/New_York")

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

def ensure_db(db_path: str):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    con = sqlite3.connect(db_path)
    con.execute("PRAGMA journal_mode=WAL;")
    con.executescript(ORDERS_SCHEMA)
    return con

def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()

def ask(prompt: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default is not None else ""
    while True:
        s = input(f"{prompt}{suffix}: ").strip()
        if not s and default is not None: return default
        if s: return s

def ask_float(prompt: str, default: float, minv: float | None = None) -> float:
    while True:
        s = ask(prompt, str(default))
        try:
            v = float(s)
            if minv is not None and v < minv: print(f"Value must be ≥ {minv}"); continue
            return v
        except ValueError:
            print("Please enter a number.")

def ask_choice(prompt: str, choices: list[str], default_index: int = 0) -> str:
    for i, c in enumerate(choices, 1): print(f"{i}. {c}")
    while True:
        s = ask(prompt, str(default_index + 1))
        try:
            k = int(s)
            if 1 <= k <= len(choices): return choices[k - 1]
        except ValueError: pass
        print(f"Please enter a number between 1 and {len(choices)}.")

def ask_yes_no(prompt: str, default_yes: bool = True) -> bool:
    d = "Y/n" if default_yes else "y/N"
    while True:
        s = ask(f"{prompt} ({d})", "")
        if not s: return default_yes
        s = s.lower()
        if s in ("y","yes"): return True
        if s in ("n","no"): return False
        print("Please enter y or n.")

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

    slots = []
    for h in range(24):
        start = datetime.combine(day_et, time(hour=h, tzinfo=ET))
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
    default_utc = (now_utc.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)).isoformat().replace("+00:00","Z")
    s = ask("Enter hour start in UTC (e.g. 2025-08-16T18:00:00Z)", default_utc).upper().strip()
    if s.endswith("Z"): s = s[:-1]
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        print("Invalid UTC datetime. Expected ISO like 2025-08-16T18:00:00Z"); sys.exit(1)
    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
    start_utc_iso = iso_utc(dt)
    print(f"\nChosen UTC start: {start_utc_iso}\n")
    return start_utc_iso

def pick_hour_start_interactive() -> str:
    print("Choose hour selection mode:")
    mode = ask_choice("Enter 1 or 2", [
        "Hour in America/New_York (menu of time slots)",
        "Hour in UTC (enter ISO time)"
    ], default_index=0)
    return choose_et_hour_start() if mode.startswith("Hour in America/New_York") else choose_utc_hour_start()

def main():
    print("=== Interactive Fake Order Seeder (status=PENDING) ===\n")

    db_path = ask("SQLite DB path", DEFAULT_DB_PATH)
    location_type = ask_choice("Choose location_type", ["HUB","ZONE","GEN"], default_index=0)
    location = ask("Enter location", "PJM WESTERN HUB")
    side = ask_choice("Choose side", ["BUY","SELL"], default_index=0)
    qty_mwh = ask_float("Quantity (MWh)", 5.0, minv=0.001)
    limit_price = ask_float("Limit price ($/MWh)", 45.00, minv=0.0)
    hour_start_utc = pick_hour_start_interactive()

    # Yesterday created_at (default 10:30 ET)
    created_time_local = ask("Yesterday created_at ET (HH:MM, before 11:00)", "10:30")
    now_et = datetime.now(ET)
    try:
        hh, mm = map(int, created_time_local.split(":"))
    except Exception:
        print("Invalid time. Expected HH:MM.", file=sys.stderr); sys.exit(1)
    created_et_date = (now_et.date() - timedelta(days=1))
    created_dt_et = datetime.combine(created_et_date, time(hour=hh, minute=mm, tzinfo=ET))

    cutoff_et = datetime.combine(created_et_date, time(hour=11, tzinfo=ET))
    if created_dt_et >= cutoff_et:
        print("Warning: created_at is not before 11:00 ET yesterday. Proceeding anyway for simulation.")

    created_at_utc = iso_utc(created_dt_et)

    print("\n--- Summary ---")
    print(f"DB:               {db_path}")
    print(f"Location type:    {location_type}")
    print(f"Location:         {location}")
    print(f"Side:             {side}")
    print(f"Qty (MWh):        {qty_mwh}")
    print(f"Limit price:      {limit_price}")
    print(f"Hour start (UTC): {hour_start_utc}")
    print(f"Created_at (UTC): {created_at_utc}")
    print(f"Status:           PENDING")
    print("----------------")
    confirm = ask_yes_no("Proceed to insert?", True)
    if not confirm:
        print("Cancelled."); return

    con = ensure_db(db_path)
    try:
        order_id = str(uuid.uuid4())
        con.execute(
            """INSERT INTO orders
               (id, created_at, market, location_type, location, hour_start_utc, side, qty_mwh, limit_price, status, reject_reason)
               VALUES (?, ?, 'DA', ?, ?, ?, ?, ?, ?, 'PENDING', NULL)""",
            (order_id, created_at_utc, location_type, location, hour_start_utc, side, float(qty_mwh), float(limit_price)),
        )
        con.commit()
    finally:
        con.close()

    print("\n✅ Inserted fake order with status=PENDING:")
    print({
        "id": order_id,
        "created_at": created_at_utc,
        "market": "DA",
        "location_type": location_type,
        "location": location,
        "hour_start_utc": hour_start_utc,
        "side": side,
        "qty_mwh": qty_mwh,
        "limit_price": limit_price,
        "status": "PENDING"
    })
    print(f"\nDB: {db_path}")

if __name__ == "__main__":
    main()
