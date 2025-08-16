from fastapi import FastAPI, HTTPException, Query
from typing import Optional, List
import os

# Import models and updated services
from models import orders, Order
from services import (
    get_day_ahead_latest, get_day_ahead_by_date, get_day_ahead_hour,
    get_rt_latest, get_rt_last24h, get_rt_range,
    compute_pnl, get_api_pool_stats, reset_api_pool, health_check
)

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