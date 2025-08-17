#!/usr/bin/env python3
import os
import sqlite3
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from contextlib import contextmanager

try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:
    print("This script requires Python 3.9+ for zoneinfo.")
    exit(1)

# Configuration
DEFAULT_DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")
ET = ZoneInfo("America/New_York")

# Database Schema
ORDERS_BASE_SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,            -- UTC ISO8601 of order creation
  market TEXT NOT NULL,                -- 'DA'
  location_type TEXT NOT NULL,         -- 'HUB'|'ZONE'|'GEN'
  location TEXT NOT NULL,
  hour_start_utc TEXT NOT NULL,        -- ISO8601 UTC (start of the operating hour)
  side TEXT NOT NULL,                  -- 'BUY'|'SELL'
  qty_mwh REAL NOT NULL,
  limit_price REAL NOT NULL,
  status TEXT NOT NULL,                -- 'PENDING'|'APPROVED'|'REJECTED'|'CLEARED'|'UNFILLED'
  reject_reason TEXT,
  
  -- Approval columns
  approved_at TEXT,                              -- UTC ISO when approved
  approval_rt_interval_start_utc TEXT,           -- RT 5-min interval start (UTC)
  approval_rt_lmp REAL,                          -- RT LMP at approval snapshot
  approval_rt_source TEXT,                       -- e.g., 'gridstatus:...'
  approval_rt_payload TEXT                       -- raw JSON payload for audit/debug
);

CREATE INDEX IF NOT EXISTS idx_orders_hour_loc ON orders(hour_start_utc, location);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
"""

class DatabaseManager:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        self._ensure_db()
    
    def _ensure_db(self):
        """Initialize database and create tables if they don't exist."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with self._get_connection() as con:
            con.executescript(ORDERS_BASE_SCHEMA)
            con.commit()
    
    @contextmanager
    def _get_connection(self):
        """Context manager for database connections."""
        con = sqlite3.connect(self.db_path)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL;")
        try:
            yield con
        finally:
            con.close()
    
    def create_fake_order(self, 
                         side: str, 
                         qty_mwh: float, 
                         limit_price: float, 
                         hour_start_utc: str,
                         location: str = "PJM-RTO",
                         location_type: str = "ZONE") -> str:
        """Create a fake order in the database."""
        order_id = str(uuid.uuid4())
        created_at_utc = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        
        with self._get_connection() as con:
            con.execute(
                """
                INSERT INTO orders
                (id, created_at, market, location_type, location, hour_start_utc, side,
                qty_mwh, limit_price, status, reject_reason,
                approved_at, approval_rt_interval_start_utc, approval_rt_lmp,
                approval_rt_source, approval_rt_payload)
                VALUES
                (?, ?, 'DA', ?, ?, ?, ?, ?, ?, 'PENDING', NULL,
                NULL, NULL, NULL, NULL, NULL)
                """,
                (order_id, created_at_utc, location_type, location, hour_start_utc,
                side.upper(), float(qty_mwh), float(limit_price))
            )
            con.commit()
        
        return order_id
    
    def get_order_by_id(self, order_id: str) -> Optional[dict]:
        """Get a specific order by ID."""
        with self._get_connection() as con:
            cursor = con.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
    
    def update_order_status(self, order_id: str, 
                           status: str, 
                           approved_at: Optional[str] = None,
                           approval_rt_lmp: Optional[float] = None,
                           approval_rt_source: Optional[str] = None,
                           reject_reason: Optional[str] = None):
        """Update order status and approval details."""
        with self._get_connection() as con:
            con.execute(
                """
                UPDATE orders 
                SET status = ?, approved_at = ?, approval_rt_lmp = ?, 
                    approval_rt_source = ?, reject_reason = ?
                WHERE id = ?
                """,
                (status, approved_at, approval_rt_lmp, approval_rt_source, reject_reason, order_id)
            )
            con.commit()

# Global database manager instance
db_manager = DatabaseManager()
