import time
import threading
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

class SimpleCache:
    def __init__(self, default_ttl_minutes: int = 5):
        self.cache = {}
        self.locks = {}  # Per-key locks to prevent duplicate calls
        self.default_ttl = default_ttl_minutes * 60  # Convert to seconds
        self.global_lock = threading.Lock()
    
    def _get_cache_key(self, *args, **kwargs) -> str:
        """Generate cache key from function arguments."""
        key_parts = [str(arg) for arg in args]
        key_parts.extend([f"{k}={v}" for k, v in sorted(kwargs.items())])
        return "|".join(key_parts)
    
    def get(self, key: str) -> Tuple[Optional[Any], bool]:
        """Get cached data. Returns (data, is_fresh)."""
        with self.global_lock:
            if key in self.cache:
                data, timestamp = self.cache[key]
                if time.time() - timestamp < self.default_ttl:
                    return data, True
                else:
                    # Expired, remove from cache
                    del self.cache[key]
            return None, False
    
    def set(self, key: str, data: Any):
        """Store data in cache with current timestamp."""
        with self.global_lock:
            self.cache[key] = (data, time.time())
    
    def get_lock(self, key: str) -> threading.Lock:
        """Get or create a lock for specific cache key."""
        with self.global_lock:
            if key not in self.locks:
                self.locks[key] = threading.Lock()
            return self.locks[key]
    
    def clear(self):
        """Clear all cached data."""
        with self.global_lock:
            self.cache.clear()
            self.locks.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self.global_lock:
            now = time.time()
            fresh_count = 0
            expired_count = 0
            
            for data, timestamp in self.cache.values():
                if now - timestamp < self.default_ttl:
                    fresh_count += 1
                else:
                    expired_count += 1
            
            return {
                "total_entries": len(self.cache),
                "fresh_entries": fresh_count,
                "expired_entries": expired_count,
                "ttl_minutes": self.default_ttl / 60
            }

# Global cache instance
API_CACHE = SimpleCache(default_ttl_minutes=5)

def cached_api_call(func):
    """Decorator to add caching to API functions."""
    def wrapper(*args, **kwargs):
        # Generate cache key
        cache_key = API_CACHE._get_cache_key(func.__name__, *args, **kwargs)
        
        # Try to get from cache first
        cached_data, is_fresh = API_CACHE.get(cache_key)
        if is_fresh:
            print(f"🔄 Cache HIT for {func.__name__}")
            return cached_data
        
        # Cache miss or expired - get lock for this key
        key_lock = API_CACHE.get_lock(cache_key)
        
        with key_lock:
            # Double-check cache after acquiring lock (another thread might have updated it)
            cached_data, is_fresh = API_CACHE.get(cache_key)
            if is_fresh:
                print(f"🔄 Cache HIT after lock for {func.__name__}")
                return cached_data
            
            # Make actual API call
            print(f"🌐 Cache MISS - calling API for {func.__name__}")
            try:
                result = func(*args, **kwargs)
                # Store in cache
                API_CACHE.set(cache_key, result)
                return result
            except Exception as e:
                # If API fails and we have expired data, use it as fallback
                if cached_data is not None:
                    print(f"⚠️ API failed, using expired cache for {func.__name__}")
                    return cached_data
                raise e
    
    return wrapper

def get_cache_stats():
    """Get current cache statistics."""
    return API_CACHE.get_stats()

def clear_cache():
    """Clear all cached data."""
    API_CACHE.clear()
    return {"status": "Cache cleared successfully"}
