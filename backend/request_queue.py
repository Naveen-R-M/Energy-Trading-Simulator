import time
import threading
import queue
from typing import Callable, Any, Dict
from dataclasses import dataclass
from datetime import datetime

@dataclass
class QueuedRequest:
    func: Callable
    args: tuple
    kwargs: dict
    result_event: threading.Event
    result: Any = None
    error: Exception = None

class RateLimitedQueue:
    def __init__(self, interval_seconds: float = 2.5):
        self.queue = queue.Queue()
        self.interval = interval_seconds
        self.running = False
        self.worker_thread = None
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "queue_size": 0,
            "last_processed": None
        }
        self.stats_lock = threading.Lock()
    
    def start(self):
        """Start the queue processor."""
        if not self.running:
            self.running = True
            self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
            self.worker_thread.start()
            print("🚀 Rate-limited queue started (interval: {:.1f}s)".format(self.interval))
    
    def stop(self):
        """Stop the queue processor."""
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
    
    def _process_queue(self):
        """Process queued requests at fixed intervals."""
        while self.running:
            try:
                # Get next request (non-blocking)
                try:
                    request = self.queue.get_nowait()
                except queue.Empty:
                    time.sleep(0.1)  # Brief sleep if queue is empty
                    continue
                
                # Process the request
                start_time = time.time()
                try:
                    print(f"🔄 Processing queued request: {request.func.__name__}")
                    request.result = request.func(*request.args, **request.kwargs)
                    
                    with self.stats_lock:
                        self.stats["successful_requests"] += 1
                        
                except Exception as e:
                    print(f"❌ Queued request failed: {e}")
                    request.error = e
                    
                    with self.stats_lock:
                        self.stats["failed_requests"] += 1
                
                # Update stats
                with self.stats_lock:
                    self.stats["total_requests"] += 1
                    self.stats["last_processed"] = datetime.now().isoformat()
                    self.stats["queue_size"] = self.queue.qsize()
                
                # Signal completion
                request.result_event.set()
                
                # Wait for interval (rate limiting)
                elapsed = time.time() - start_time
                sleep_time = max(0, self.interval - elapsed)
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
            except Exception as e:
                print(f"❌ Queue processor error: {e}")
                time.sleep(1)  # Brief pause on error
    
    def enqueue_request(self, func: Callable, *args, **kwargs) -> Any:
        """Add request to queue and wait for result."""
        request = QueuedRequest(
            func=func,
            args=args,
            kwargs=kwargs,
            result_event=threading.Event()
        )
        
        # Add to queue
        self.queue.put(request)
        
        with self.stats_lock:
            self.stats["queue_size"] = self.queue.qsize()
        
        print(f"📥 Queued request: {func.__name__} (queue size: {self.queue.qsize()})")
        
        # Wait for processing (with timeout)
        if request.result_event.wait(timeout=60):  # 60 second timeout
            if request.error:
                raise request.error
            return request.result
        else:
            raise TimeoutError(f"Request {func.__name__} timed out in queue")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics."""
        with self.stats_lock:
            return {
                **self.stats,
                "queue_size": self.queue.qsize(),
                "is_running": self.running
            }

# Global queue instance
REQUEST_QUEUE = RateLimitedQueue(interval_seconds=2.5)

def queued_api_call(func):
    """Decorator to queue API calls for rate limiting."""
    def wrapper(*args, **kwargs):
        # Start queue if not running
        if not REQUEST_QUEUE.running:
            REQUEST_QUEUE.start()
        
        # Add to queue and wait for result
        return REQUEST_QUEUE.enqueue_request(func, *args, **kwargs)
    
    return wrapper

def get_queue_stats():
    """Get current queue statistics."""
    return REQUEST_QUEUE.get_stats()

def clear_queue():
    """Clear the request queue (emergency use only)."""
    REQUEST_QUEUE.stop()
    REQUEST_QUEUE.start()
    return {"status": "Queue cleared and restarted"}
