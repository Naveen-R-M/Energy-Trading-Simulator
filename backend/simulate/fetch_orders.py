#!/usr/bin/env python3
import os
import sqlite3
from typing import Any, Dict, List, Tuple, Optional

# --- Config ---
DEFAULT_DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")

# Status policy (edit if you change your workflow)
OPEN_STATUSES   = {"PENDING"}
CLOSED_STATUSES = {"APPROVED", "REJECTED", "UNFILLED", "CLEARED"}

# Preferred field order in API output
ORDER_FIELDS = [
    "id", "created_at", "market", "location_type", "location",
    "hour_start_utc", "side", "qty_mwh", "limit_price", "status",
    "approved_at", "approval_rt_interval_start_utc", "approval_rt_lmp",
    "approval_rt_source", "reject_reason",
]

# --- DB helpers ---
def _connect(db_path: str) -> sqlite3.Connection:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    return con

def _table_columns(con: sqlite3.Connection, table: str) -> List[str]:
    cols = []
    for r in con.execute(f"PRAGMA table_info({table});"):
        cols.append(r["name"] if isinstance(r, sqlite3.Row) else r[1])
    return cols

def _build_select(existing: List[str]) -> Tuple[str, List[str]]:
    # Keep only fields that actually exist in the DB
    fields = [f for f in ORDER_FIELDS if f in existing]
    # Guarantee we can still show reason if present
    if "reject_reason" in existing and "reject_reason" not in fields:
        fields.append("reject_reason")
    return ", ".join(fields), fields

def _rows_to_dicts(rows: List[sqlite3.Row], fields: List[str]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = {k: r[k] for k in fields}
        # Coerce numerics
        if "qty_mwh" in d and d["qty_mwh"] is not None:
            d["qty_mwh"] = float(d["qty_mwh"])
        if "limit_price" in d and d["limit_price"] is not None:
            d["limit_price"] = float(d["limit_price"])
        if "approval_rt_lmp" in d and d["approval_rt_lmp"] is not None:
            try:
                d["approval_rt_lmp"] = float(d["approval_rt_lmp"])
            except Exception:
                pass
        return_order = {}
        # Reorder to our preferred field order
        for k in ORDER_FIELDS:
            if k in d:
                return_order[k] = d[k]
        # Include any extra columns (if schema has more)
        for k, v in d.items():
            if k not in return_order:
                return_order[k] = v
        out.append(return_order)
    return out

def _query_bucket(
    con: sqlite3.Connection,
    select_sql: str,
    kept_fields: List[str],
    statuses: List[str],
    limit: int,
    location: Optional[str],
) -> List[Dict[str, Any]]:
    where = ["status IN ({})".format(",".join("?" * len(statuses)))]
    params: List[Any] = list(statuses)
    if location:
        where.append("location = ?")
        params.append(location)
    sql = f"""
        SELECT {select_sql}
        FROM orders
        WHERE {' AND '.join(where)}
        ORDER BY datetime(created_at) DESC
        LIMIT ?
    """
    params.append(limit)
    rows = con.execute(sql, params).fetchall()
    return _rows_to_dicts(rows, kept_fields)

def fetch_orders(
    db_path: str = DEFAULT_DB_PATH,
    limit_open: int = 200,
    limit_closed: int = 200,
    location: Optional[str] = None,
):
    """
    Simple function to fetch orders from SQLite database.
    Returns:
    {
      "open":   { "count": N, "orders": [...] },
      "closed": { "count": M, "orders": [...] }
    }
    """
    # Connect + sanity
    try:
        con = _connect(db_path)
    except sqlite3.OperationalError as e:
        raise Exception(f"sqlite connect error: {e}")
    
    try:
        existing = _table_columns(con, "orders")
        if not existing:
            return {"open": {"count": 0, "orders": []}, "closed": {"count": 0, "orders": []}}

        select_sql, kept_fields = _build_select(existing)

        open_orders = _query_bucket(
            con, select_sql, kept_fields, sorted(list(OPEN_STATUSES)), limit_open, location
        )
        closed_orders = _query_bucket(
            con, select_sql, kept_fields, sorted(list(CLOSED_STATUSES)), limit_closed, location
        )

        result = {
            "open":   {"count": len(open_orders),   "orders": open_orders},
            "closed": {"count": len(closed_orders), "orders": closed_orders},
        }
        print(f"Fetched {len(open_orders)} open and {len(closed_orders)} closed orders")
        return result
    finally:
        con.close()
