#!/usr/bin/env python3
"""
SQLite cleaner for the energy trading simulator.

Default: soft clean (DELETE FROM on known tables, VACUUM).
Optional: --hard removes the DB file entirely.

Env:
  DB_PATH=/app/data/trading.db  (default)

Usage (inside container):
  python /app/clean_db.py               # soft clean
  python /app/clean_db.py --hard        # hard reset (delete file)
  python /app/clean_db.py --dry-run     # show what would happen
"""

import os
import sys
import shutil
import sqlite3
import argparse

DEFAULT_DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")

# If you add more tables later, list them here.
KNOWN_TABLES_IN_DELETE_ORDER = [
    # child→parent order if you ever add FKs
    "executions",
    "realtime_ticks",
    "positions",
    "orders",
    "pool_stats",
    "migrations",
]

def soft_clean(db_path: str, dry_run: bool = False) -> None:
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path} (nothing to clean).")
        return

    print(f"Soft cleaning DB at {db_path}")
    if dry_run:
        print("DRY-RUN: would open DB and DELETE FROM the known tables (if they exist).")
        return

    con = sqlite3.connect(db_path)
    cur = con.cursor()

    # Discover existing tables so we don't error if a table isn't present
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    existing = {r[0] for r in cur.fetchall()}

    deleted_any = False
    for tbl in KNOWN_TABLES_IN_DELETE_ORDER:
        if tbl in existing:
            print(f" - Deleting rows in {tbl}")
            cur.execute(f"DELETE FROM {tbl};")
            deleted_any = True
        else:
            print(f" - Skipping {tbl} (not found)")

    con.commit()

    # Reset sqlite autoincrement counters (if any)
    if "sqlite_sequence" in existing:
        print(" - Resetting sqlite_sequence")
        cur.execute("DELETE FROM sqlite_sequence;")
        con.commit()

    # VACUUM to reclaim space
    print(" - VACUUM")
    cur.execute("VACUUM;")
    con.commit()
    con.close()

    if not deleted_any:
        print("No known tables were found to clean.")
    else:
        print("✅ Soft clean complete.")

def hard_clean(db_path: str, dry_run: bool = False) -> None:
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path} (nothing to delete).")
        return
    print(f"HARD RESET: delete {db_path}")
    if dry_run:
        print("DRY-RUN: would remove the DB file.")
        return
    # Make a small safety backup next to it
    backup = db_path + ".bak"
    try:
        shutil.copy2(db_path, backup)
        print(f" - Backup created at {backup}")
    except Exception as e:
        print(f" - Backup failed (continuing): {e}")
    os.remove(db_path)
    print("✅ Hard reset complete (file removed).")

def main():
    ap = argparse.ArgumentParser(description="Clean the simulator SQLite database.")
    ap.add_argument("--db", default=DEFAULT_DB_PATH, help=f"Path to SQLite DB (default: {DEFAULT_DB_PATH})")
    ap.add_argument("--hard", action="store_true", help="Delete the DB file entirely (creates a .bak first).")
    ap.add_argument("--dry-run", action="store_true", help="Show actions without changing anything.")
    args = ap.parse_args()

    if args.hard:
        hard_clean(args.db, args.dry_run)
    else:
        soft_clean(args.db, args.dry_run)

if __name__ == "__main__":
    main()