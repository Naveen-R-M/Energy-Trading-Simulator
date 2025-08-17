from fastapi import FastAPI, HTTPException, Query
from typing import Optional, List
import os
from datetime import datetime, timezone

# Import models and updated services
from models import orders, Order
from fake_order_manager import db_manager
from moderate_hour import moderator
from services import (
    get_day_ahead_latest, get_day_ahead_by_date, get_day_ahead_hour,
    get_rt_latest, get_rt_last24h, get_rt_range,
    compute_pnl, get_api_pool_stats, reset_api_pool, health_check,
    get_load_comparison, get_cache_stats, clear_cache,
    get_queue_stats, clear_queue
)

import simulate.fetch_orders as fetch_orders

app = FastAPI(
    title="Virtual Energy Trading API",
    description="API for virtual energy trading with Day-Ahead and Real-Time markets",
    version="1.0.0"
)

# Default values
DEFAULT_MARKET = "pjm"
DEFAULT_LOCATION = "PJM-RTO"

# --- Day Ahead Market Endpoints ---
@app.get("/api/v1/dayahead/latest")
def day_ahead_latest(
    market: str = Query(DEFAULT_MARKET, description="Market (e.g., pjm, ercot)"),
    location: str = Query(DEFAULT_LOCATION, description="Location/Node (e.g., PJM-RTO)")
):
    """Get latest 24 hours of day-ahead prices."""
    try:
        return {
            "market": market,
            "location": location,
            "data": get_day_ahead_latest(market, location)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching day-ahead data: {str(e)}")

@app.get("/api/v1/dayahead/date/{date}")
def day_ahead_by_date(
    date: str,
    market: str = Query(DEFAULT_MARKET, description="Market (e.g., pjm, ercot)"),
    location: str = Query(DEFAULT_LOCATION, description="Location/Node (e.g., PJM-RTO)")
):
    """Get day-ahead prices for a specific date (YYYY-MM-DD)."""
    try:
        return {
            "market": market,
            "location": location,
            "date": date,
            "data": get_day_ahead_by_date(date, market, location)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching day-ahead data for {date}: {str(e)}")

@app.get("/api/v1/dayahead/range")
def day_ahead_range(
    start: str = Query(..., description="Start time (ISO format)"),
    end: str = Query(..., description="End time (ISO format)"),
    market: str = Query(DEFAULT_MARKET, description="Market (e.g., pjm, ercot)"),
    location: str = Query(DEFAULT_LOCATION, description="Location/Node (e.g., PJM-RTO)")
):
    """Get day-ahead prices for a specific time range."""
    try:
        return {
            "market": market,
            "location": location,
            "start": start,
            "end": end,
            "data": get_day_ahead_hour(market, location, start, end)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching day-ahead data: {str(e)}")

# --- Real Time Market Endpoints ---
@app.get("/api/v1/realtime/latest")
def rt_latest(
    market: str = Query(DEFAULT_MARKET, description="Market (e.g., pjm, ercot)"),
    location: str = Query(DEFAULT_LOCATION, description="Location/Node (e.g., PJM-RTO)")
):
    """Get latest real-time price."""
    try:
        return {
            "market": market,
            "location": location,
            "data": get_rt_latest(market, location)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching real-time data: {str(e)}")

@app.get("/api/v1/realtime/last24h")
def rt_last24h(
    market: str = Query(DEFAULT_MARKET, description="Market (e.g., pjm, ercot)"),
    location: str = Query(DEFAULT_LOCATION, description="Location/Node (e.g., PJM-RTO)")
):
    """Get last 24 hours of real-time prices."""
    try:
        return {
            "market": market,
            "location": location,
            "data": get_rt_last24h(market, location)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching 24h real-time data: {str(e)}")

@app.get("/api/v1/realtime/range")
def rt_range(
    start: str = Query(..., description="Start time (ISO format)"),
    end: str = Query(..., description="End time (ISO format)"),
    market: str = Query(DEFAULT_MARKET, description="Market (e.g., pjm, ercot)"),
    location: str = Query(DEFAULT_LOCATION, description="Location/Node (e.g., PJM-RTO)")
):
    """Get real-time prices for a specific time range."""
    try:
        return {
            "market": market,
            "location": location,
            "start": start,
            "end": end,
            "data": get_rt_range(market, location, start, end)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching real-time data: {str(e)}")

# --- Load Data Endpoints ---
@app.get("/api/v1/load/comparison/{date}")
def load_comparison(
    date: str,
    market: str = Query("pjm", description="Market (currently only pjm supported)")
):
    """Get actual vs forecast load comparison for a specific date (YYYY-MM-DD)."""
    try:
        result = get_load_comparison(date)
        return {
            "market": market,
            "date": date,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching load comparison for {date}: {str(e)}")

# --- Trading / Orders Endpoints ---
@app.post("/api/v1/orders")
def place_order(order: Order):
    """Place a new trading order."""
    try:
        # Add some basic validation
        if order.qty <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        
        if order.direction.upper() not in ["BUY", "SELL"]:
            raise HTTPException(status_code=400, detail="Direction must be 'BUY' or 'SELL'")
        
        # Store order (in production, this would go to a database)
        orders.append(order)
        
        return {
            "status": "success",
            "message": "Order placed successfully",
            "order": order.dict(),
            "order_id": len(orders)  # Simple ID for now
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error placing order: {str(e)}")

@app.get("/api/v1/orders")
def list_orders():
    """Get all orders."""
    return {
        "total_orders": len(orders),
        "orders": [order.dict() for order in orders]
    }

# --- Fake Order Endpoints ---
@app.post("/api/v1/orders/fake")
def create_fake_order(
    side: str = Query(..., description="BUY or SELL"),
    qty_mwh: float = Query(..., ge=0.001, description="Quantity in MWh"),
    limit_price: float = Query(..., ge=0.0, description="Limit price in $/MWh"),
    hour_start_utc: str = Query(..., description="Hour start in UTC ISO format"),
    location: str = Query(default="PJM-RTO", description="Location/Node"),
    location_type: str = Query(default="ZONE", description="Location type")
):
    """Create a fake order and store it in the SQLite database."""
    try:
        # Validate side
        if side.upper() not in ["BUY", "SELL"]:
            raise HTTPException(status_code=400, detail="Side must be 'BUY' or 'SELL'")
        
        # Validate hour_start_utc format
        try:
            datetime.fromisoformat(hour_start_utc.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid hour_start_utc format. Expected ISO format like '2025-08-17T16:00:00Z'")
        
        # Create the fake order
        order_id = db_manager.create_fake_order(
            side=side.upper(),
            qty_mwh=qty_mwh,
            limit_price=limit_price,
            hour_start_utc=hour_start_utc,
            location=location,
            location_type=location_type
        )
        
        # Get the created order for response
        created_order = db_manager.get_order_by_id(order_id)
        
        return {
            "status": "success",
            "message": "Fake order created successfully",
            "order_id": order_id,
            "order": created_order
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating fake order: {str(e)}")

@app.patch("/api/v1/orders/fake/{order_id}")
def update_fake_order(
    order_id: str,
    status: str = Query(..., description="Order status: PENDING, APPROVED, REJECTED, CLEARED, UNFILLED"),
    approval_rt_lmp: Optional[float] = Query(None, description="RT LMP at approval"),
    approval_rt_source: Optional[str] = Query(None, description="RT source"),
    reject_reason: Optional[str] = Query(None, description="Rejection reason")
):
    """Update a fake order's status and approval details."""
    try:
        # Validate status
        valid_statuses = ["PENDING", "APPROVED", "REJECTED", "CLEARED", "UNFILLED"]
        if status.upper() not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(valid_statuses)}")
        
        # Check if order exists
        existing_order = db_manager.get_order_by_id(order_id)
        if not existing_order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Prepare approval timestamp if approving
        approved_at = None
        if status.upper() == "APPROVED":
            approved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        
        # Update the order
        db_manager.update_order_status(
            order_id=order_id,
            status=status.upper(),
            approved_at=approved_at,
            approval_rt_lmp=approval_rt_lmp,
            approval_rt_source=approval_rt_source,
            reject_reason=reject_reason
        )
        
        # Get updated order
        updated_order = db_manager.get_order_by_id(order_id)
        
        return {
            "status": "success",
            "message": f"Order {order_id} updated to {status.upper()}",
            "order": updated_order
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating fake order: {str(e)}")

@app.post("/api/v1/orders/moderate/{hour_start_utc}")
def moderate_hour_orders(
    hour_start_utc: str,
    approval_probability: float = Query(default=0.7, ge=0.0, le=1.0, description="Probability of approval (0.0 to 1.0)"),
    rt_lmp_base: float = Query(default=40.0, ge=0.0, description="Base RT LMP price"),
    rt_lmp_variance: float = Query(default=10.0, ge=0.0, description="Variance around base price")
):
    """Moderate all pending orders for a specific hour with random approval/rejection."""
    try:
        # Validate hour_start_utc format
        try:
            datetime.fromisoformat(hour_start_utc.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid hour_start_utc format. Expected ISO format like '2025-08-17T16:00:00Z'")
        
        # Moderate the hour
        result = moderator.moderate_hour(
            hour_start_utc=hour_start_utc,
            approval_probability=approval_probability,
            rt_lmp_base=rt_lmp_base,
            rt_lmp_variance=rt_lmp_variance
        )
        
        return {
            "status": "success",
            "message": f"Moderated {result['total_orders']} orders for hour {hour_start_utc}",
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error moderating hour: {str(e)}")

@app.get("/api/v1/positions/open")
def open_positions(
    market: str = Query(DEFAULT_MARKET, description="Market (e.g., pjm, ercot)"),
    location: str = Query(DEFAULT_LOCATION, description="Location/Node (e.g., PJM-RTO)")
):
    """Get all positions with P&L calculations."""
    try:
        enriched = []
        for i, order in enumerate(orders):
            try:
                pnl = compute_pnl(order, market, location)
                order_data = order.dict()
                order_data.update({
                    "order_id": i + 1,
                    "pnl": round(pnl, 2),
                    "market": market,
                    "location": location
                })
                enriched.append(order_data)
            except Exception as e:
                # If P&L calculation fails, still include the order
                order_data = order.dict()
                order_data.update({
                    "order_id": i + 1,
                    "pnl": 0.0,
                    "pnl_error": str(e),
                    "market": market,
                    "location": location
                })
                enriched.append(order_data)
        
        total_pnl = sum(pos["pnl"] for pos in enriched)
        
        return {
            "total_positions": len(enriched),
            "total_pnl": round(total_pnl, 2),
            "positions": enriched
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating positions: {str(e)}")

# --- API Key Pool Management ---
@app.get("/api/v1/pool/stats")
def pool_stats():
    """Get API key pool statistics."""
    return get_api_pool_stats()

@app.post("/api/v1/pool/reset")
def reset_pool(strategy: str = Query("round_robin", description="Strategy: round_robin, random, or least_used")):
    """Reset API key pool with new strategy."""
    if strategy not in ["round_robin", "random", "least_used"]:
        raise HTTPException(status_code=400, detail="Invalid strategy. Must be: round_robin, random, or least_used")
    
    try:
        stats = reset_api_pool(strategy)
        return {
            "status": "success",
            "message": f"API pool reset with {strategy} strategy",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting pool: {str(e)}")

# --- Queue Management ---
@app.get("/api/v1/queue/stats")
def queue_stats():
    """Get request queue statistics."""
    return get_queue_stats()

@app.post("/api/v1/queue/clear")
def clear_request_queue():
    """Clear the request queue (emergency use only)."""
    try:
        result = clear_queue()
        return {
            "status": "success",
            "message": "Request queue cleared and restarted",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing queue: {str(e)}")
    
# --- The endpoint ---
@app.get("/api/v1/fetch_orders")
def fetch_orders_from_sqlite(
    db: str = Query(default="/app/data/trading.db", description="SQLite DB path"),
    limit_open: int = Query(default=200, ge=1, le=10000),
    limit_closed: int = Query(default=200, ge=1, le=10000),
    location: Optional[str] = Query(default=None, description="Exact location filter (e.g., PJM-RTO)")
):
    """Fetch orders from the SQLite database."""
    try:
        result = fetch_orders.fetch_orders(db, limit_open, limit_closed, location)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching orders: {str(e)}")

# --- Cache Management ---
@app.get("/api/v1/cache/stats")
def cache_stats():
    """Get cache statistics."""
    return get_cache_stats()

@app.post("/api/v1/cache/clear")
def clear_api_cache():
    """Clear all cached data."""
    try:
        result = clear_cache()
        return {
            "status": "success",
            "message": "Cache cleared successfully",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing cache: {str(e)}")

# --- Health Check ---
@app.get("/api/v1/health")
def health():
    """Comprehensive health check including API key pool status."""
    return health_check()

@app.get("/api/v1/health/simple")
def simple_health():
    """Simple health check."""
    return {"status": "ok", "service": "virtual-energy-trading-api"}

# --- Root endpoint ---
@app.get("/")
def root():
    """API information."""
    return {
        "service": "Virtual Energy Trading API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
        "endpoints": {
            "day_ahead": "/api/v1/dayahead/",
            "real_time": "/api/v1/realtime/",
            "orders": "/api/v1/orders",
            "positions": "/api/v1/positions/open",
            "pool_stats": "/api/v1/pool/stats"
        }
    }

# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return HTTPException(
        status_code=500,
        detail={
            "error": "Internal server error",
            "message": str(exc),
            "path": str(request.url)
        }
    )