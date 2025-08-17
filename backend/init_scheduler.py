#!/usr/bin/env python3
"""
Startup script to initialize the order scheduler when the app starts
"""
import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def initialize_scheduler():
    """Initialize and start the order scheduler."""
    try:
        from order_scheduler import order_scheduler
        
        print("🚀 Initializing order scheduler...")
        
        # Start the scheduler
        order_scheduler.start()
        
        # Get initial status
        status = order_scheduler.get_scheduler_status()
        print(f"✅ Order scheduler initialized: {status}")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to initialize scheduler: {e}")
        return False

if __name__ == "__main__":
    initialize_scheduler()