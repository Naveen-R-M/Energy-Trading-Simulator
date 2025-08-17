# 🔄 API Rate Limiting System Documentation

## Overview

The Virtual Energy Trading platform implements a sophisticated **multi-layer API rate limiting system** to handle the GridStatus API's strict rate limits while maintaining high performance and reliability. The system combines **round-robin key rotation**, **intelligent caching**, **request queuing**, and **automatic cooldown management**.

## 🏗️ Architecture Overview

```
🌐 Incoming API Request
    ↓
📊 Layer 1: Cache System (SimpleCache)
    ├─ Cache Hit → Return cached data immediately
    └─ Cache Miss → Continue to Queue
    ↓
📥 Layer 2: Request Queue (RateLimitedQueue) 
    ├─ Add to queue → Process at 2s intervals
    └─ Worker thread processes sequentially
    ↓
🔑 Layer 3: API Key Pool (Round-Robin)
    ├─ Select next available key
    ├─ Handle rate limits & cooldowns
    └─ Rotate to next key if needed
    ↓
🔄 Layer 4: Retry Logic with Exponential Backoff
    ├─ 3 retry attempts maximum
    ├─ 2^attempt second delays
    └─ Different key per retry
    ↓
✅ GridStatus API Call
```

---

## 🔑 Round-Robin API Key Pool System

### Components

**File**: `backend/keypool_manager.py`

The API Key Pool manages multiple GridStatus API keys with intelligent rotation and health monitoring.

### Key Features

- **Multiple Strategies**: Round-robin, random, or least-used key selection
- **Health Monitoring**: Tracks usage, failures, and availability per key
- **Automatic Recovery**: Keys automatically reactivate after cooldown periods
- **Thread Safety**: All operations are protected with locks

### Configuration

```python
class ApiKeyPool:
    def __init__(self, api_keys: List[str], strategy: str = "round_robin"):
        self.cooldown_seconds = 5  # Cooldown after rate limit (5 seconds)
        self.strategy = strategy   # "round_robin", "random", "least_used"
```

### Key Statistics Tracked

Each API key maintains:
- `request_count`: Total requests made with this key
- `consecutive_failures`: Current failure streak
- `last_used`: Timestamp of last usage
- `rate_limited_until`: When the key becomes available again

### Round-Robin Algorithm

```python
def _round_robin_selection(self, available_keys: List[ApiKeyStats]) -> str:
    # Increment counter and find next available key in sequence
    for _ in range(len(self.keys_stats)):
        current_key = self.keys_stats[self.current_index % len(self.keys_stats)]
        self.current_index += 1
        
        if current_key in available_keys:
            current_key.last_used = datetime.now()
            current_key.request_count += 1
            return current_key.key
```

### Rate Limiting Behavior

1. **429 Response**: Key marked as rate-limited for 5 seconds (or `Retry-After` header value)
2. **403 Response**: Key temporarily rate-limited for 5 minutes (allows recovery from temporary issues)
3. **Other Errors**: Exponential backoff without marking key as rate-limited

**All keys can recover after their cooldown period expires - no permanent deactivation.**

---

## 💾 Intelligent Caching System

### Components

**File**: `backend/simple_cache.py`

Thread-safe caching with TTL-based expiration and fallback mechanisms.

### Key Features

- **TTL-Based Expiration**: Default 5-minute cache lifetime
- **Double-Check Locking**: Prevents race conditions and duplicate API calls
- **Fallback Strategy**: Uses expired cache data if API fails
- **Per-Key Locking**: Prevents duplicate calls for the same cache key

### Cache Configuration

```python
class SimpleCache:
    def __init__(self, default_ttl_minutes: int = 5):
        self.default_ttl = default_ttl_minutes * 60  # Convert to seconds
```

### Cache Key Generation

```python
def _get_cache_key(self, *args, **kwargs) -> str:
    key_parts = [str(arg) for arg in args]
    key_parts.extend([f"{k}={v}" for k, v in sorted(kwargs.items())])
    return "|".join(key_parts)
```

### Caching Logic Flow

```python
@cached_api_call
def api_function(*args, **kwargs):
    # 1. Generate cache key from function name and parameters
    # 2. Check for fresh cached data (< 5 minutes old)
    # 3. If cache hit: return immediately
    # 4. If cache miss: acquire per-key lock
    # 5. Double-check cache after lock acquisition
    # 6. Make API call and store result
    # 7. On API failure: return expired cache as fallback
```

---

## 📥 Request Queuing System

### Components

**File**: `backend/request_queue.py`

Sequential request processing with configurable rate limiting intervals.

### Key Features

- **Sequential Processing**: One request at a time to prevent API overwhelm
- **Configurable Intervals**: Default 2-second delay between requests
- **Timeout Protection**: 60-second timeout prevents hanging requests
- **Background Processing**: Dedicated worker thread handles queue

### Queue Configuration

```python
class RateLimitedQueue:
    def __init__(self, interval_seconds: float = 2.0):
        self.interval = interval_seconds  # Time between requests
        self.timeout = 60                 # Request timeout in seconds
```

### Queue Processing Flow

```python
def _process_queue(self):
    while self.running:
        # 1. Get next request from queue (non-blocking)
        # 2. Execute the request function
        # 3. Handle success/failure and update stats
        # 4. Signal completion to waiting thread
        # 5. Wait for interval period (rate limiting)
```

### Queue Statistics

- `total_requests`: Total processed requests
- `successful_requests`: Successfully completed requests
- `failed_requests`: Failed request attempts
- `queue_size`: Current number of pending requests
- `last_processed`: Timestamp of last processed request

---

## 🔄 Integration and Decorators

### Decorator Stacking

The system uses multiple decorators that work together:

```python
@queued_api_call              # Layer 2: Add to processing queue
@cached_api_call              # Layer 1: Check cache first
@api_request_with_rotation(   # Layer 3 & 4: Key rotation + retries
    pool=API_POOL, 
    max_retries=3
)
def get_rt_last24h(market, location, api_key=None):
    # Actual API implementation
    pass
```

### Request Flow Example

```python
# Example API call with full protection stack
def api_call_example():
    # 1. Cache check (5-minute TTL)
    # 2. Queue addition (2-second intervals)  
    # 3. Key selection (round-robin)
    # 4. HTTP request with retries (3 attempts max)
    # 5. Response handling and error recovery
    return get_rt_last24h("pjm", "PJM-RTO")
```

---

## 🛠️ Management Commands

### API Endpoint Commands

All management commands are available via FastAPI endpoints:

#### Cache Management

```bash
# Get cache statistics
GET /api/v1/admin/cache/stats

# Clear all cached data
POST /api/v1/admin/cache/clear
```

#### Queue Management  

```bash
# Get queue statistics
GET /api/v1/admin/queue/stats

# Clear and restart the request queue
POST /api/v1/admin/queue/clear
```

#### API Pool Management

```bash
# Get API key pool statistics  
GET /api/v1/admin/pool/stats

# Reset API key pool (clear rate limits)
POST /api/v1/admin/pool/reset
```

#### Health Check

```bash
# Overall system health
GET /api/v1/admin/health
```

### Direct Python Commands

If you need to manage the system programmatically:

#### Cache Operations

```python
from simple_cache import get_cache_stats, clear_cache

# Get cache statistics
stats = get_cache_stats()
print(f"Cache entries: {stats['total_entries']}")
print(f"Fresh entries: {stats['fresh_entries']}")

# Clear all cache
result = clear_cache()
print(result["status"])  # "Cache cleared successfully"
```

#### Queue Operations

```python
from request_queue import get_queue_stats, clear_queue

# Get queue statistics
stats = get_queue_stats()
print(f"Queue size: {stats['queue_size']}")
print(f"Success rate: {stats['successful_requests']}/{stats['total_requests']}")

# Clear and restart queue
result = clear_queue()
print(result["status"])  # "Queue cleared and restarted"
```

#### API Pool Operations

```python
from services import get_api_pool_stats, reset_api_pool

# Get pool statistics
stats = get_api_pool_stats()
print(f"Available keys: {stats['available_keys']}/{stats['total_keys']}")
print(f"Rate limited keys: {stats['rate_limited_keys']}")

# Reset pool (clear rate limits and failures)
result = reset_api_pool()
print(result["status"])  # "API pool reset successfully"
```

### Emergency Commands

#### Complete System Reset

```bash
# Reset everything (cache + queue + pool)
curl -X POST http://localhost:8000/api/v1/admin/cache/clear
curl -X POST http://localhost:8000/api/v1/admin/queue/clear  
curl -X POST http://localhost:8000/api/v1/admin/pool/reset
```

#### Monitor System Health

```bash
# Watch system stats in real-time
watch -n 5 "curl -s http://localhost:8000/api/v1/admin/health | jq"
```

---

## 📊 Monitoring and Observability

### Key Metrics to Monitor

#### Cache Performance
- **Hit Rate**: `fresh_entries / total_requests`
- **Expiration Rate**: `expired_entries / total_entries`
- **Cache Size**: Total number of cached items

#### Queue Performance  
- **Processing Rate**: `successful_requests / total_requests`
- **Queue Depth**: Current `queue_size`
- **Average Wait Time**: Time between queue addition and processing

#### API Pool Health
- **Key Availability**: `available_keys / total_keys`
- **Rate Limit Frequency**: `rate_limited_keys` over time
- **Failure Rate**: `consecutive_failures` per key

### Logging and Alerts

The system provides detailed logging for monitoring:

```
🔄 Cache HIT for get_rt_last24h
📥 Queued request: get_day_ahead_latest (queue size: 3)
🔑 API Key abcd1234... selected (Round-robin strategy)
🚫 API Key abcd1234... rate limited until 2025-08-17T10:15:05
⚠️ Rate limit hit on attempt 1, trying different key...
✅ Request completed successfully
```

---

## ⚙️ Configuration Options

### Environment Variables

```bash
# API Keys (comma-separated)
GRIDSTATUS_API_KEYS=key1,key2,key3,key4

# Pool Strategy
API_POOL_STRATEGY=round_robin  # or "random", "least_used"

# Cache TTL (minutes)
CACHE_TTL_MINUTES=5

# Queue Interval (seconds)  
QUEUE_INTERVAL_SECONDS=2.0

# Cooldown Period (seconds)
API_COOLDOWN_SECONDS=5
```

### Runtime Configuration

```python
# Initialize with custom settings
from keypool_manager import ApiKeyPool
from simple_cache import SimpleCache
from request_queue import RateLimitedQueue

# Custom API pool
pool = ApiKeyPool(api_keys=["key1", "key2"], strategy="least_used")

# Custom cache with 10-minute TTL
cache = SimpleCache(default_ttl_minutes=10)

# Custom queue with 1-second intervals
queue = RateLimitedQueue(interval_seconds=1.0)
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### High Rate Limit Frequency
**Symptoms**: Many keys showing as rate-limited
**Solutions**: 
- Increase `QUEUE_INTERVAL_SECONDS` 
- Add more API keys
- Check if cache TTL is too low

#### Slow API Response Times
**Symptoms**: Long delays in API responses
**Solutions**:
- Check queue depth with `/api/v1/admin/queue/stats`
- Verify cache hit rate is reasonable (>50%)
- Monitor pool availability

#### Cache Not Working
**Symptoms**: Cache hit rate near 0%
**Solutions**:
- Verify cache TTL settings
- Check if cache keys are being generated consistently
- Clear cache and restart: `POST /api/v1/admin/cache/clear`

#### Queue Backup
**Symptoms**: Queue size continuously growing
**Solutions**:
- Check API key pool health
- Restart queue: `POST /api/v1/admin/queue/clear`
- Increase processing interval if API is overloaded

### Debug Commands

```python
# Enable detailed logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Check individual component health
from services import health_check
health = health_check()
print(f"API responsive: {health['api_responsive']}")
print(f"Latest data: {health['latest_data_timestamp']}")
```

---

## 🎯 Performance Optimization

### Recommended Settings

**For Development**:
```bash
QUEUE_INTERVAL_SECONDS=1.0
CACHE_TTL_MINUTES=2
API_COOLDOWN_SECONDS=5
```

**For Production**:
```bash
QUEUE_INTERVAL_SECONDS=2.0  
CACHE_TTL_MINUTES=5
API_COOLDOWN_SECONDS=5
```

**For High-Load Production**:
```bash
QUEUE_INTERVAL_SECONDS=3.0
CACHE_TTL_MINUTES=10
API_COOLDOWN_SECONDS=10
```

### Scaling Considerations

1. **More API Keys**: Linear improvement in throughput
2. **Longer Cache TTL**: Reduces API load but may serve stale data
3. **Shorter Queue Intervals**: Faster responses but higher API load
4. **Multiple Queue Workers**: Not currently supported (sequential by design)

---

## 📚 Additional Resources

- **GridStatus API Documentation**: [https://api.gridstatus.io/docs](https://api.gridstatus.io/docs)
- **FastAPI Documentation**: [https://fastapi.tiangolo.com](https://fastapi.tiangolo.com)
- **Threading Best Practices**: Python threading documentation
- **Rate Limiting Strategies**: Academic papers on API rate limiting

---

*Last Updated: August 17, 2025*
*Version: 1.0.0*