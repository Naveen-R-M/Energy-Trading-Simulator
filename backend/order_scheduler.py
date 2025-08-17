#!/usr/bin/env python3
"""
Order Scheduler - Automatically moderate orders at their scheduled hour_start_utc time
"""
import asyncio
import threading
import sqlite3
import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from contextlib import contextmanager
import time
import logging

from moderate_hour import moderator

# Configuration
DEFAULT_DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OrderScheduler:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        self.running = False
        self.scheduler_thread = None
        self._stop_event = threading.Event()
    
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
    
    def get_pending_orders_due(self) -> List[Dict[str, Any]]:
        """Get orders that are due for moderation (hour_start_utc <= now)."""
        now_utc = datetime.now(timezone.utc).isoformat()
        
        with self._get_connection() as con:
            cursor = con.execute(
                """
                SELECT * FROM orders 
                WHERE status = 'PENDING' 
                AND hour_start_utc <= ? 
                ORDER BY hour_start_utc ASC
                """,
                (now_utc,)
            )
            return [dict(row) for row in cursor.fetchall()]
    
    def get_upcoming_orders(self, look_ahead_minutes: int = 10) -> List[Dict[str, Any]]:
        """Get orders that will be due for moderation within the next N minutes."""
        now_utc = datetime.now(timezone.utc)
        future_utc = (now_utc + timedelta(minutes=look_ahead_minutes)).isoformat()
        
        with self._get_connection() as con:
            cursor = con.execute(
                """
                SELECT * FROM orders 
                WHERE status = 'PENDING' 
                AND hour_start_utc BETWEEN ? AND ?
                ORDER BY hour_start_utc ASC
                """,
                (now_utc.isoformat(), future_utc)
            )
            return [dict(row) for row in cursor.fetchall()]
    
    def moderate_due_orders(self) -> Dict[str, Any]:
        """Moderate all orders that are currently due."""
        due_orders = self.get_pending_orders_due()
        
        if not due_orders:
            return {"processed": 0, "results": []}
        
        results = []
        processed_count = 0
        
        # Group orders by hour_start_utc for batch processing
        orders_by_hour = {}
        for order in due_orders:
            hour_key = order['hour_start_utc']
            if hour_key not in orders_by_hour:
                orders_by_hour[hour_key] = []
            orders_by_hour[hour_key].append(order)
        
        # Moderate each hour group
        for hour_start_utc, hour_orders in orders_by_hour.items():
            try:
                logger.info(f"🤖 Auto-moderating {len(hour_orders)} orders for {hour_start_utc}")
                
                # Use the moderator to process this hour
                moderation_result = moderator.moderate_hour(
                    hour_start_utc=hour_start_utc,
                    approval_probability=0.7,  # 70% approval rate
                    rt_lmp_base=40.0,         # Base RT price
                    rt_lmp_variance=10.0      # ±$10 variance
                )
                
                results.append({
                    "hour_start_utc": hour_start_utc,
                    "orders_count": len(hour_orders),
                    "moderation_result": moderation_result
                })
                
                processed_count += len(hour_orders)
                
                logger.info(f"✅ Moderated {len(hour_orders)} orders for {hour_start_utc}: {moderation_result['approved']} approved, {moderation_result['rejected']} rejected")
                
            except Exception as e:
                logger.error(f"❌ Error moderating orders for {hour_start_utc}: {e}")
                results.append({
                    "hour_start_utc": hour_start_utc,
                    "orders_count": len(hour_orders),
                    "error": str(e)
                })
        
        return {
            "processed": processed_count,
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def _scheduler_loop(self):
        """Main scheduler loop that runs in a separate thread."""
        logger.info("🚀 Order scheduler started")
        
        while not self._stop_event.is_set():
            try:
                # Check for due orders every 30 seconds
                result = self.moderate_due_orders()
                
                if result['processed'] > 0:
                    logger.info(f"📊 Processed {result['processed']} orders in this cycle")
                
                # Also log upcoming orders for visibility (every 5th check = ~2.5 minutes)
                if int(time.time()) % 150 == 0:  # Every 2.5 minutes
                    upcoming = self.get_upcoming_orders(5)  # Next 5 minutes
                    if upcoming:
                        upcoming_times = [order['hour_start_utc'] for order in upcoming]
                        logger.info(f"⏰ {len(upcoming)} orders scheduled for moderation in next 5 min: {upcoming_times}")
                
            except Exception as e:
                logger.error(f"❌ Scheduler error: {e}")
            
            # Wait 30 seconds before next check (or until stop event)
            self._stop_event.wait(30)
        
        logger.info("⏹️ Order scheduler stopped")
    
    def start(self):
        """Start the scheduler in a background thread."""
        if self.running:
            logger.warning("⚠️ Scheduler already running")
            return
        
        self.running = True
        self._stop_event.clear()
        self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()
        logger.info("🎯 Order scheduler thread started")
    
    def stop(self):
        """Stop the scheduler gracefully."""
        if not self.running:
            return
        
        logger.info("🛑 Stopping order scheduler...")
        self.running = False
        self._stop_event.set()
        
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=5)
        
        logger.info("✅ Order scheduler stopped")
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get current scheduler status and statistics."""
        pending_orders = self.get_pending_orders_due()
        upcoming_orders = self.get_upcoming_orders(10)
        
        return {
            "running": self.running,
            "thread_alive": self.scheduler_thread.is_alive() if self.scheduler_thread else False,
            "pending_due_now": len(pending_orders),
            "upcoming_10_min": len(upcoming_orders),
            "next_due_order": upcoming_orders[0]['hour_start_utc'] if upcoming_orders else None,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "check_interval_seconds": 30
        }

# Global scheduler instance
order_scheduler = OrderScheduler()

# Auto-start scheduler when module is imported
if not order_scheduler.running:
    order_scheduler.start()