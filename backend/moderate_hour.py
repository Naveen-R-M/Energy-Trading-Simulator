#!/usr/bin/env python3
"""
Moderate Hour - Auto-approve/decline orders for a specific hour with random decisions
"""
import os
import sqlite3
import random
from datetime import datetime, timezone
from typing import List, Dict, Any
from contextlib import contextmanager

# Configuration
DEFAULT_DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")

class OrderModerator:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
    
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
    
    def get_pending_orders_for_hour(self, hour_start_utc: str) -> List[Dict[str, Any]]:
        """Get all pending orders for a specific hour."""
        with self._get_connection() as con:
            cursor = con.execute(
                "SELECT * FROM orders WHERE hour_start_utc = ? AND status = 'PENDING'",
                (hour_start_utc,)
            )
            return [dict(row) for row in cursor.fetchall()]
    
    def moderate_order(self, order_id: str, 
                      approval_probability: float = 0.7,
                      rt_lmp_base: float = 40.0,
                      rt_lmp_variance: float = 10.0) -> Dict[str, Any]:
        """
        Moderate a single order with random approval/rejection.
        
        Args:
            order_id: Order ID to moderate
            approval_probability: Probability of approval (0.0 to 1.0)
            rt_lmp_base: Base RT LMP price
            rt_lmp_variance: Variance around base price
        """
        is_approved = random.random() < approval_probability
        now_utc = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        
        if is_approved:
            # Generate random RT LMP around base price
            rt_lmp = rt_lmp_base + random.uniform(-rt_lmp_variance, rt_lmp_variance)
            rt_lmp = max(0.01, rt_lmp)  # Ensure positive price
            
            status = "APPROVED"
            approval_rt_lmp = round(rt_lmp, 2)
            approval_rt_source = "moderate_hour:random"
            reject_reason = None
        else:
            status = "REJECTED"
            approval_rt_lmp = None
            approval_rt_source = None
            reject_reason = random.choice([
                "Insufficient market liquidity",
                "Price outside acceptable range", 
                "Grid constraints",
                "Random rejection for testing"
            ])
        
        # Update order in database
        with self._get_connection() as con:
            con.execute(
                """
                UPDATE orders 
                SET status = ?, approved_at = ?, approval_rt_lmp = ?, 
                    approval_rt_source = ?, reject_reason = ?
                WHERE id = ?
                """,
                (status, now_utc, approval_rt_lmp, approval_rt_source, reject_reason, order_id)
            )
            con.commit()
        
        return {
            "order_id": order_id,
            "status": status,
            "approved_at": now_utc,
            "approval_rt_lmp": approval_rt_lmp,
            "approval_rt_source": approval_rt_source,
            "reject_reason": reject_reason
        }
    
    def moderate_hour(self, hour_start_utc: str, 
                     approval_probability: float = 0.7,
                     rt_lmp_base: float = 40.0,
                     rt_lmp_variance: float = 10.0) -> Dict[str, Any]:
        """
        Moderate all pending orders for a specific hour.
        
        Args:
            hour_start_utc: Hour start time in UTC ISO format
            approval_probability: Probability of approval (0.0 to 1.0)
            rt_lmp_base: Base RT LMP price
            rt_lmp_variance: Variance around base price
        """
        pending_orders = self.get_pending_orders_for_hour(hour_start_utc)
        
        if not pending_orders:
            return {
                "hour_start_utc": hour_start_utc,
                "total_orders": 0,
                "approved": 0,
                "rejected": 0,
                "orders": []
            }
        
        results = []
        approved_count = 0
        rejected_count = 0
        
        for order in pending_orders:
            result = self.moderate_order(
                order['id'],
                approval_probability=approval_probability,
                rt_lmp_base=rt_lmp_base,
                rt_lmp_variance=rt_lmp_variance
            )
            results.append(result)
            
            if result['status'] == 'APPROVED':
                approved_count += 1
            else:
                rejected_count += 1
        
        return {
            "hour_start_utc": hour_start_utc,
            "total_orders": len(pending_orders),
            "approved": approved_count,
            "rejected": rejected_count,
            "approval_rate": approved_count / len(pending_orders) if pending_orders else 0,
            "orders": results
        }

# Global moderator instance
moderator = OrderModerator()
