import requests
import os
import time
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API keys from environment
API_KEYS = os.getenv("GRIDSTATUS_API_KEYS", "").split(",")
API_KEYS = [key.strip() for key in API_KEYS if key.strip()]

if not API_KEYS:
    raise ValueError("No API keys found in GRIDSTATUS_API_KEYS environment variable")

BASE = "https://api.gridstatus.io/v1/datasets"
current_key_index = 0

def get_next_api_key():
    """Simple round-robin API key selection."""
    global current_key_index
    key = API_KEYS[current_key_index % len(API_KEYS)]
    current_key_index += 1
    return key

def make_api_request(url, max_retries=3):
    """Make API request with automatic key rotation on rate limits."""
    for attempt in range(max_retries):
        api_key = get_next_api_key()
        full_url = f"{url}&api_key={api_key}" if "?" in url else f"{url}?api_key={api_key}"
        
        try:
            print(f"🔑 Using API key {api_key[:8]}... (attempt {attempt + 1})")
            response = requests.get(full_url)
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data:
                    return data["data"]
                else:
                    print(f"⚠️ No 'data' field in response: {data}")
                    return None
                    
            elif response.status_code == 429:
                print(f"⚠️ Rate limit hit, trying next key...")
                if attempt < max_retries - 1:
                    time.sleep(1)  # Brief pause before retry
                continue
                
            else:
                print(f"❌ API error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Request failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            return None
    
    print(f"❌ All {max_retries} attempts failed")
    return None

def get_day_ahead_hour(market: str, location: str, start: str, end: str):
    url = (
        f"{BASE}/{market}_lmp_day_ahead_hourly/query"
        f"?start_time={start}&end_time={end}"
        f"&filter_column=location&filter_value={location}"
        f"&columns=interval_start_utc,interval_end_utc,lmp"
    )
    return make_api_request(url)

def get_rt_range(market: str, location: str, start: str, end: str):
    url = (
        f"{BASE}/{market}_lmp_real_time_5_min/query"
        f"?start_time={start}&end_time={end}"
        f"&filter_column=location&filter_value={location}"
        f"&order=asc&columns=interval_start_utc,lmp"
    )
    return make_api_request(url)

def compute_pnl(direction: str, qty: float, da_price: float, rt_prices: list):
    if not rt_prices:
        return 0.0
    
    pnl = 0
    intervals = len(rt_prices)
    slice_qty = qty / intervals if intervals > 0 else qty
    
    for r in rt_prices:
        rt_lmp = r["lmp"]
        if direction.upper() == "BUY":
            pnl += (rt_lmp - da_price) * slice_qty  # Buy low (DA), sell high (RT)
        else:  # SELL
            pnl += (da_price - rt_lmp) * slice_qty  # Sell high (DA), buy low (RT)
    return pnl

# -----------------------------
# Example Simulation
# -----------------------------
if __name__ == "__main__":
    print("🚀 Starting energy trading simulation...")
    print(f"📊 Loaded {len(API_KEYS)} API keys from environment")
    
    market = "pjm"         
    location = "PJM-RTO"   
    qty = 100              # MWh
    direction = "BUY"      # "BUY" or "SELL"

    # Use a recent hour (adjust as needed)
    hour_start = "2025-08-16T16:00:00+00:00"
    hour_end   = "2025-08-16T17:00:00+00:00"

    print(f"\n📅 Simulating {direction} trade for {hour_start} to {hour_end}")
    print(f"📍 Market: {market}, Location: {location}, Quantity: {qty} MWh")

    # 1. Fetch DA clearing price
    print(f"\n🔍 Fetching day-ahead price...")
    da_data = get_day_ahead_hour(market, location, hour_start, hour_end)
    
    if not da_data:
        print("❌ No day-ahead data found. Exiting.")
        exit(1)

    da_price = da_data[0]["lmp"]
    print(f"✅ Day Ahead Price: ${da_price:.2f}/MWh")

    # 2. Fetch RT 5-min prices for same window
    print(f"\n🔍 Fetching real-time prices...")
    rt_data = get_rt_range(market, location, hour_start, hour_end)
    
    if not rt_data:
        print("❌ No real-time data found. Exiting.")
        exit(1)

    print(f"✅ Fetched {len(rt_data)} real-time intervals")
    
    # Show some sample RT prices
    if len(rt_data) > 0:
        rt_avg = sum(r["lmp"] for r in rt_data) / len(rt_data)
        rt_min = min(r["lmp"] for r in rt_data)
        rt_max = max(r["lmp"] for r in rt_data)
        print(f"📊 RT Price Stats - Avg: ${rt_avg:.2f}, Min: ${rt_min:.2f}, Max: ${rt_max:.2f}")

    # 3. Compute PnL
    print(f"\n💰 Computing P&L...")
    pnl = compute_pnl(direction, qty, da_price, rt_data)

    print(f"\n🎯 SIMULATION RESULTS:")
    print(f"   Trade: {direction} {qty} MWh")
    print(f"   DA Price: ${da_price:.2f}/MWh")
    print(f"   RT Average: ${rt_avg:.2f}/MWh")
    print(f"   P&L: ${pnl:.2f}")
    
    if pnl > 0:
        print(f"   🟢 Profitable trade! (+${pnl:.2f})")
    elif pnl < 0:
        print(f"   🔴 Loss on trade! (${pnl:.2f})")
    else:
        print(f"   ⚪ Break-even trade")