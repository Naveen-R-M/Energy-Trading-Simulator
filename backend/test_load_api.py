import requests
import os
from dotenv import load_dotenv

load_dotenv()

# Get first API key
api_keys = os.getenv("GRIDSTATUS_API_KEYS", "").split(",")
api_key = api_keys[0].strip()

BASE = "https://api.gridstatus.io/v1/datasets"

def test_actual_load_api():
    """Test the actual load API directly."""
    
    # Test different endpoints to see which one has data
    endpoints_to_test = [
        ("pjm_load", "load"),
        ("pjm_load_metered_hourly", "mw"),
        ("pjm_load_forecast_hourly", "load_forecast")
    ]
    
    for endpoint, column in endpoints_to_test:
        url = f"{BASE}/{endpoint}/query?api_key={api_key}&start_time=2025-08-16T00:00:00Z&end_time=2025-08-16T23:59:59Z&order=asc&limit=5"
        
        try:
            print(f"\n🔍 Testing {endpoint}:")
            print(f"URL: {url}")
            
            response = requests.get(url)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Data count: {len(data.get('data', []))}")
                if data.get('data'):
                    print(f"First record: {data['data'][0]}")
                    if len(data['data']) > 1:
                        print(f"Last record: {data['data'][-1]}")
            else:
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == "__main__":
    test_actual_load_api()
