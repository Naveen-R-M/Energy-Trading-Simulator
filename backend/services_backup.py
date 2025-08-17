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


@api_request_with_rotation(API_POOL, max_retries=6)
def get_day_ahead_latest(market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION, api_key: str = None) -> List[Dict]:
    """Get latest 24 hours of day-ahead prices."""
    url = (
        f"{BASE}/{market}_lmp_day_ahead_hourly/query"
        f"?api_key={api_key}"
        f"&filter_column=location&filter_value={location}"
        f"&order=desc&limit=24"
        f"&columns=interval_start_utc,interval_end_utc,location,lmp"
    )
    print("URL -->", url)
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=6)
def get_day_ahead_hour(market: str, location: str, hour_start: str, hour_end: str, api_key: str = None) -> List[Dict]:
    """Get day-ahead prices for specific time range."""
    url = (
        f"{BASE}/{market}_lmp_day_ahead_hourly/query"
        f"?api_key={api_key}"
        f"&start_time={hour_start}&end_time={hour_end}"
        f"&filter_column=location&filter_value={location}"
        f"&columns=interval_start_utc,interval_end_utc,lmp"
    )
    print("URL -->", url)
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=6)
def get_rt_latest(market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION, api_key: str = None) -> List[Dict]:
    """Get latest real-time price."""
    url = (
        f"{BASE}/{market}_lmp_real_time_5_min/query"
        f"?api_key={api_key}"
        f"&time=latest"
        f"&filter_column=location&filter_value={location}"
        f"&limit=1&columns=interval_start_utc,lmp"
    )
    print("URL -->", url)
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=6)
def get_rt_last24h(market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION, api_key: str = None) -> List[Dict]:
    """Get last 24 hours of real-time prices (288 5-minute intervals)."""
    url = (
        f"{BASE}/{market}_lmp_real_time_5_min/query"
        f"?api_key={api_key}"
        f"&filter_column=location&filter_value={location}"
        f"&order=desc&limit=288"
        f"&columns=interval_start_utc,lmp,energy,congestion,loss"
    )
    print("URL -->", url)
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=6)
def get_rt_range(market: str, location: str, start: str, end: str, api_key: str = None) -> List[Dict]:
    """Get real-time prices for specific time range."""
    url = (
        f"{BASE}/{market}_lmp_real_time_5_min/query"
        f"?api_key={api_key}"
        f"&start_time={start}&end_time={end}"
        f"&filter_column=location&filter_value={location}"
        f"&order=asc&columns=interval_start_utc,lmp"
    )
    print("URL -->", url)
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


@api_request_with_rotation(API_POOL, max_retries=6)
def get_day_ahead_by_date(date: str, market: str = DEFAULT_MARKET, location: str = DEFAULT_LOCATION, api_key: str = None) -> List[Dict]:
    """Get day-ahead prices for a specific date (all 24 hours)."""
    url = (
        f"{BASE}/{market}_lmp_day_ahead_hourly/query"
        f"?api_key={api_key}"
        f"&date={date}"
        f"&filter_column=location&filter_value={location}"
        f"&order=asc&limit=24"
        f"&columns=interval_start_utc,interval_end_utc,lmp"
    )
    print("URL -->", url)
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


# ==============================
# Load Data Functions (Actual vs Forecast)
# ==============================

@api_request_with_rotation(API_POOL, max_retries=3)
def get_pjm_load_actual(date: str, api_key: str = None) -> List[Dict]:
    """Get actual hourly load data for PJM for a specific date."""
    # Use the hourly metered dataset (Option A - recommended)
    start_time = f"{date}T00:00:00Z"
    end_time = f"{date}T23:59:59Z"
    
    url = (
        f"{BASE}/pjm_load/query"
        f"?api_key={api_key}"
        f"&start_time={start_time}&end_time={end_time}"
        f"&filter_column=mkt_region&filter_value=PJM"
        f"&order=asc"
        f"&columns=interval_start_utc,load,mw"
    )
    print("URL -->", url)
    response = requests.get(url)
    response.raise_for_status()
    
    data = response.json()["data"]
    
    # Group by hour and sum MW (aggregate all load areas)
    from collections import defaultdict
    hourly_totals = defaultdict(float)
    
    for item in data:
        hour_key = item["interval_start_utc"][:13] + ":00:00Z"  # Truncate to hour
        hourly_totals[hour_key] += float(item["mw"])
    
    # Convert back to list format
    result = []
    for hour_utc, total_mw in hourly_totals.items():
        result.append({
            "interval_start_utc": hour_utc,
            "actual_load_mw": total_mw
        })
    
    return sorted(result, key=lambda x: x["interval_start_utc"])


@api_request_with_rotation(API_POOL, max_retries=3)
def get_pjm_load_forecast(date: str, api_key: str = None) -> List[Dict]:
    """Get forecast load data for PJM for a specific date."""
    start_time = f"{date}T00:00:00Z"
    end_time = f"{date}T23:59:59Z"
    
    url = (
        f"{BASE}/pjm_load_forecast_hourly/query"
        f"?api_key={api_key}"
        f"&start_time={start_time}&end_time={end_time}"
        f"&order=asc"
        f"&columns=interval_start_utc,load_forecast"
    )
    print("URL -->", url)
    response = requests.get(url)
    response.raise_for_status()
    return response.json()["data"]


def get_load_comparison(date: str) -> Dict[str, Any]:
    """Get actual vs forecast load comparison for a specific date."""
    try:
        actual_data = get_pjm_load_actual(date)
        forecast_data = get_pjm_load_forecast(date)
        
        # Combine actual and forecast by hour
        load_comparison = []
        actual_dict = {item["interval_start_utc"]: item["actual_load_mw"] for item in actual_data}
        
        for forecast_item in forecast_data:
            hour_utc = forecast_item["interval_start_utc"]
            actual_load = actual_dict.get(hour_utc, 0)
            forecast_load = float(forecast_item.get("load_forecast", 0))
            
            load_comparison.append({
                "interval_start_utc": hour_utc,
                "hour": int(hour_utc[11:13]),
                "actual_load_mw": actual_load,
                "load_forecast": forecast_load,
                "error_mw": actual_load - forecast_load,
                "error_percent": ((actual_load - forecast_load) / forecast_load * 100) if forecast_load > 0 else 0
            })
        
        # Calculate summary statistics
        total_actual = sum(item["actual_load_mw"] for item in load_comparison)
        total_forecast = sum(item["load_forecast"] for item in load_comparison)
        peak_actual = max(item["actual_load_mw"] for item in load_comparison) if load_comparison else 0
        avg_error = sum(abs(item["error_mw"]) for item in load_comparison) / len(load_comparison) if load_comparison else 0
        
        return {
            "date": date,
            "data": load_comparison,
            "summary": {
                "peak_load_mw": peak_actual,
                "total_actual_mwh": total_actual,
                "total_forecast_mwh": total_forecast,
                "avg_forecast_error_mw": avg_error,
                "forecast_accuracy_percent": ((total_forecast - abs(total_actual - total_forecast)) / total_forecast * 100) if total_forecast > 0 else 0
            }
        }
        
    except Exception as e:
        print(f"Error getting load comparison: {e}")
        return {
            "date": date,
            "data": [],
            "summary": {},
            "error": str(e)
        }


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