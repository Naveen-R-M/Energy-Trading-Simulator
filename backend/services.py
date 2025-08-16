import requests
import os
import time
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Import the API key pool manager
from keypool_manager import initialize_api_pool, api_request_with_rotation

# Load environment variables
load_dotenv()

# Initialize API key pool
API_POOL = initialize_api_pool("GRIDSTATUS_API_KEYS", strategy="round_robin")
BASE = "https://api.gridstatus.io/v1/datasets"

# Default market and location
DEFAULT_MARKET = "pjm"
DEFAULT_LOCATION = "PJM-RTO"


@api_request_with_rotation(API_POOL, max_retries=3)
def get_day_ahead_latest(market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION, api_key: str = None) -> List[Dict]:
    """Get latest 24 hours of day-ahead prices."""
    url = (
        f"{BASE}/{market}_lmp_day_ahead_hourly/query"
        f"?api_key={api_key}"
        f"&filter_column=location&filter_value={location}"
        f"&order=desc&limit=24"
        f"&columns=interval_start_utc,interval_end_utc,location,lmp"
    )
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=3)
def get_day_ahead_hour(market: str, location: str, hour_start: str, hour_end: str, api_key: str = None) -> List[Dict]:
    """Get day-ahead prices for specific time range."""
    url = (
        f"{BASE}/{market}_lmp_day_ahead_hourly/query"
        f"?api_key={api_key}"
        f"&start_time={hour_start}&end_time={hour_end}"
        f"&filter_column=location&filter_value={location}"
        f"&columns=interval_start_utc,interval_end_utc,lmp"
    )
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=3)
def get_rt_latest(market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION, api_key: str = None) -> List[Dict]:
    """Get latest real-time price."""
    url = (
        f"{BASE}/{market}_lmp_real_time_5_min/query"
        f"?api_key={api_key}"
        f"&time=latest"
        f"&filter_column=location&filter_value={location}"
        f"&limit=1&columns=interval_start_utc,lmp"
    )
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=3)
def get_rt_last24h(market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION, api_key: str = None) -> List[Dict]:
    """Get last 24 hours of real-time prices (288 5-minute intervals)."""
    url = (
        f"{BASE}/{market}_lmp_real_time_5_min/query"
        f"?api_key={api_key}"
        f"&filter_column=location&filter_value={location}"
        f"&order=desc&limit=288"
        f"&columns=interval_start_utc,lmp,energy,congestion,loss"
    )
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=3)
def get_rt_range(market: str, location: str, start: str, end: str, api_key: str = None) -> List[Dict]:
    """Get real-time prices for specific time range."""
    url = (
        f"{BASE}/{market}_lmp_real_time_5_min/query"
        f"?api_key={api_key}"
        f"&start_time={start}&end_time={end}"
        f"&filter_column=location&filter_value={location}"
        f"&order=asc&columns=interval_start_utc,lmp"
    )
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=3)
def get_day_ahead_by_date(date: str, market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION, api_key: str = None) -> List[Dict]:
    """Get day-ahead prices for a specific date (all 24 hours)."""
    url = (
        f"{BASE}/{market}_lmp_day_ahead_hourly/query"
        f"?api_key={api_key}"
        f"&date={date}"
        f"&filter_column=location&filter_value={location}"
        f"&columns=interval_start_utc,interval_end_utc,lmp"
    )
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


def compute_pnl(order, market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION) -> float:
    """Compute P&L for an order by comparing DA and RT prices."""
    try:
        # Get DA price for the hour
        da_data = get_day_ahead_hour(market, location, order.hour_start, order.hour_end)
        if not da_data:
            raise ValueError("No day-ahead data found for the specified hour")
        
        da_price = da_data[0]["lmp"]
        
        # Get RT prices for the same hour
        rt_data = get_rt_range(market, location, da_data[0]["interval_start_utc"], da_data[0]["interval_end_utc"])
        if not rt_data:
            raise ValueError("No real-time data found for the specified hour")
        
        # Calculate P&L
        pnl = 0
        rt_intervals = len(rt_data)
        slice_qty = order.qty / rt_intervals if rt_intervals > 0 else order.qty
        
        for rt_point in rt_data:
            rt_price = rt_point["lmp"]
            if order.direction.upper() == "BUY":
                pnl += (rt_price - da_price) * slice_qty
            else:  # SELL
                pnl += (da_price - rt_price) * slice_qty
        
        return pnl
        
    except Exception as e:
        print(f"Error computing P&L: {e}")
        return 0.0


def get_api_pool_stats() -> Dict:
    """Get current API key pool statistics."""
    return API_POOL.get_stats()


def reset_api_pool(strategy: str = "round_robin"):
    """Reset the API pool with a new strategy."""
    global API_POOL
    API_POOL = initialize_api_pool("GRIDSTATUS_API_KEYS", strategy)
    return get_api_pool_stats()


# Health check function
def health_check() -> Dict[str, Any]:
    """Perform a health check on the API and key pool."""
    try:
        # Try to get latest RT data as a health check
        latest_rt = get_rt_latest()
        pool_stats = get_api_pool_stats()
        
        return {
            "status": "healthy",
            "api_responsive": True,
            "latest_data_timestamp": latest_rt[0]["interval_start_utc"] if latest_rt else None,
            "pool_stats": pool_stats
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "api_responsive": False,
            "error": str(e),
            "pool_stats": get_api_pool_stats()
        }


# Utility function for testing different strategies
def test_api_strategies():
    """Test different API key strategies and return performance stats."""
    strategies = ["round_robin", "random", "least_used"]
    results = {}
    
    for strategy in strategies:
        print(f"\n🧪 Testing {strategy} strategy...")
        temp_pool = initialize_api_pool("GRIDSTATUS_API_KEYS", strategy)
        
        # Make a few test requests
        try:
            start_time = time.time()
            for _ in range(3):
                get_rt_latest()
            end_time = time.time()
            
            results[strategy] = {
                "success": True,
                "duration": end_time - start_time,
                "stats": temp_pool.get_stats()
            }
        except Exception as e:
            results[strategy] = {
                "success": False,
                "error": str(e),
                "stats": temp_pool.get_stats()
            }
    
    return results


if __name__ == "__main__":
    # Quick test
    print("🚀 Testing API key pool...")
    
    # Check pool stats
    stats = get_api_pool_stats()
    print(f"📊 Pool initialized with {stats['total_keys']} keys")
    
    # Test health check
    health = health_check()
    print(f"🏥 Health check: {health['status']}")
    
    if health['api_responsive']:
        print(f"⏱️ Latest data: {health['latest_data_timestamp']}")