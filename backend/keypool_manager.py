import os
import random
import time
import threading
from typing import List, Optional, Dict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import requests
from functools import wraps

@dataclass
class ApiKeyStats:
    key: str
    last_used: datetime = field(default_factory=datetime.now)
    request_count: int = 0
    rate_limited_until: Optional[datetime] = None
    consecutive_failures: int = 0
    is_active: bool = True

class ApiKeyPool:
    def __init__(self, api_keys: List[str], strategy: str = "round_robin"):
        """
        Initialize API key pool with rotation strategy.
        
        Args:
            api_keys: List of API keys
            strategy: 'round_robin' or 'random' or 'least_used'
        """
        self.keys_stats = [ApiKeyStats(key=key) for key in api_keys]
        self.strategy = strategy
        self.current_index = 0
        self.lock = threading.Lock()
        self.cooldown_minutes = 1.5  # How long to wait after rate limit
        
    def get_next_key(self) -> Optional[str]:
        """Get the next available API key based on strategy."""
        with self.lock:
            # Filter out rate-limited keys
            available_keys = self._get_available_keys()
            
            print(f"🔍 API Key Pool Status:")
            print(f"   Total keys: {len(self.keys_stats)}")
            print(f"   Available keys: {len(available_keys)}")
            for i, key_stat in enumerate(self.keys_stats):
                status = "Available" if key_stat in available_keys else "Rate-limited/Inactive"
                print(f"   Key {i+1} ({key_stat.key[:8]}...): {status} - Requests: {key_stat.request_count}")
            
            if not available_keys:
                print("❌ No available keys! Checking cooldowns...")
                # All keys are rate limited, wait for the one with shortest cooldown
                self._wait_for_cooldown()
                available_keys = self._get_available_keys()
                
            if not available_keys:
                print("❌ Still no available keys after cooldown check!")
                raise Exception("All API keys are exhausted or inactive")
                
            if self.strategy == "round_robin":
                return self._round_robin_selection(available_keys)
            elif self.strategy == "random":
                return self._random_selection(available_keys)
            elif self.strategy == "least_used":
                return self._least_used_selection(available_keys)
            else:
                return self._round_robin_selection(available_keys)
    
    def _get_available_keys(self) -> List[ApiKeyStats]:
        """Get keys that are not rate limited."""
        now = datetime.now()
        available = []
        
        for key_stat in self.keys_stats:
            if not key_stat.is_active:
                continue
                
            # Check if rate limit has expired
            if key_stat.rate_limited_until and now >= key_stat.rate_limited_until:
                key_stat.rate_limited_until = None
                key_stat.consecutive_failures = 0
                
            # Key is available if not rate limited
            if key_stat.rate_limited_until is None:
                available.append(key_stat)
                
        return available
    
    def _round_robin_selection(self, available_keys: List[ApiKeyStats]) -> str:
        """Round-robin selection strategy."""
        if not available_keys:
            return None
            
        # Find next key in round-robin order
        for _ in range(len(self.keys_stats)):
            current_key = self.keys_stats[self.current_index % len(self.keys_stats)]
            self.current_index += 1
            
            if current_key in available_keys:
                current_key.last_used = datetime.now()
                current_key.request_count += 1
                return current_key.key
                
        # Fallback to first available
        key_stat = available_keys[0]
        key_stat.last_used = datetime.now()
        key_stat.request_count += 1
        return key_stat.key
    
    def _random_selection(self, available_keys: List[ApiKeyStats]) -> str:
        """Random selection strategy."""
        key_stat = random.choice(available_keys)
        key_stat.last_used = datetime.now()
        key_stat.request_count += 1
        return key_stat.key
    
    def _least_used_selection(self, available_keys: List[ApiKeyStats]) -> str:
        """Least used selection strategy."""
        key_stat = min(available_keys, key=lambda k: k.request_count)
        key_stat.last_used = datetime.now()
        key_stat.request_count += 1
        return key_stat.key
    
    def mark_rate_limited(self, api_key: str, retry_after: Optional[int] = None):
        """Mark an API key as rate limited."""
        with self.lock:
            for key_stat in self.keys_stats:
                if key_stat.key == api_key:
                    cooldown_minutes = retry_after or self.cooldown_minutes
                    key_stat.rate_limited_until = datetime.now() + timedelta(minutes=cooldown_minutes)
                    key_stat.consecutive_failures += 1
                    print(f"🚫 API Key {api_key[:8]}... rate limited until {key_stat.rate_limited_until}")
                    break
    
    def mark_success(self, api_key: str):
        """Mark successful API call to reset failure count."""
        with self.lock:
            for key_stat in self.keys_stats:
                if key_stat.key == api_key:
                    key_stat.consecutive_failures = 0
                    break
    
    def deactivate_key(self, api_key: str):
        """Permanently deactivate a problematic API key."""
        with self.lock:
            for key_stat in self.keys_stats:
                if key_stat.key == api_key:
                    key_stat.is_active = False
                    print(f"❌ API Key {api_key[:8]}... deactivated")
                    break
    
    def _wait_for_cooldown(self):
        """Wait for the shortest cooldown period."""
        now = datetime.now()
        rate_limited_keys = [k for k in self.keys_stats if k.rate_limited_until and k.rate_limited_until > now]
        
        if rate_limited_keys:
            shortest_wait = min(rate_limited_keys, key=lambda k: k.rate_limited_until)
            wait_time = (shortest_wait.rate_limited_until - now).total_seconds()
            if wait_time > 0 and wait_time < (self.cooldown_minutes * 60):  # Only wait up to cooldown period
                print(f"⏳ Waiting {wait_time:.1f} seconds for API key cooldown...")
                time.sleep(wait_time)
    
    def get_stats(self) -> Dict:
        """Get current pool statistics."""
        with self.lock:
            now = datetime.now()
            stats = {
                "total_keys": len(self.keys_stats),
                "active_keys": len([k for k in self.keys_stats if k.is_active]),
                "available_keys": len(self._get_available_keys()),
                "rate_limited_keys": len([k for k in self.keys_stats if k.rate_limited_until and k.rate_limited_until > now]),
                "strategy": self.strategy,
                "keys": []
            }
            
            for key_stat in self.keys_stats:
                key_info = {
                    "key_preview": key_stat.key[:8] + "...",
                    "requests": key_stat.request_count,
                    "last_used": key_stat.last_used.isoformat(),
                    "is_active": key_stat.is_active,
                    "rate_limited": key_stat.rate_limited_until is not None,
                    "failures": key_stat.consecutive_failures
                }
                if key_stat.rate_limited_until:
                    key_info["rate_limited_until"] = key_stat.rate_limited_until.isoformat()
                stats["keys"].append(key_info)
                
            return stats


# Enhanced request wrapper with retry logic
def api_request_with_rotation(pool: ApiKeyPool, max_retries: int = 3):
    """Decorator to handle API requests with key rotation and retry logic."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    api_key = pool.get_next_key()
                    if not api_key:
                        raise Exception("No API keys available")
                    
                    # Execute the function with the selected API key
                    result = func(*args, api_key=api_key, **kwargs)
                    
                    # Mark success
                    pool.mark_success(api_key)
                    return result
                    
                except requests.exceptions.HTTPError as e:
                    last_exception = e
                    if e.response.status_code == 429:  # Rate limit
                        # Check for Retry-After header
                        retry_after = e.response.headers.get('Retry-After')
                        retry_minutes = int(retry_after) // 60 if retry_after else None
                        pool.mark_rate_limited(api_key, retry_minutes)
                        
                        print(f"⚠️ Rate limit hit on attempt {attempt + 1}, trying different key...")
                        continue
                    elif e.response.status_code == 403:  # Forbidden - bad key
                        pool.deactivate_key(api_key)
                        print(f"⚠️ Invalid API key on attempt {attempt + 1}, trying different key...")
                        continue
                    else:
                        # Other HTTP error, don't retry
                        break
                        
                except Exception as e:
                    last_exception = e
                    print(f"⚠️ Request failed on attempt {attempt + 1}: {str(e)}")
                    
                # Wait before retry
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    
            raise last_exception or Exception("All retry attempts failed")
            
        return wrapper
    return decorator


# Initialize the global pool
def initialize_api_pool(env_var: str = "GRIDSTATUS_API_KEYS", strategy: str = "round_robin") -> ApiKeyPool:
    """Initialize API key pool from environment variable."""
    keys_str = os.getenv(env_var, "")
    if not keys_str:
        raise ValueError(f"Environment variable {env_var} not found or empty")
    
    # Parse comma-separated keys and clean them
    api_keys = [key.strip() for key in keys_str.split(",") if key.strip()]
    
    if not api_keys:
        raise ValueError(f"No valid API keys found in {env_var}")
    
    print(f"🔑 Initialized API key pool with {len(api_keys)} keys using {strategy} strategy")
    return ApiKeyPool(api_keys, strategy)
