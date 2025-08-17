# ⏰ Automatic Order Scheduler System

The scheduler automatically moderates fake orders at their exact `hour_start_utc` time without manual intervention.

## 🤖 **How It Works:**

### **Timeline Example:**
```
21:41:57 UTC - Fake order created
   ↓ (Order stored with hour_start_utc: "2025-08-17T21:45:45.000Z")
   ↓ (Status: PENDING)
   ↓ (Scheduler checks every 10 seconds)
   ↓
21:45:45 UTC - Scheduler detects order is due
   ↓ (Calls moderator.moderate_hour())
   ↓ (Random 70% approval with RT LMP generation)
   ↓ (Database updated: PENDING → APPROVED/REJECTED)
   ↓
21:45:46 UTC - Order moderated automatically
   ↓ (Appears in Positions Management as closed position)
   ↓ (Live P&L calculation begins)
```

## 🔧 **Scheduler Components:**

### **1. OrderScheduler Class (`order_scheduler.py`)**
- **Background thread** runs continuously
- **Checks every 30 seconds** for due orders
- **Automatically moderates** orders at exact scheduled time
- **Batch processing** for multiple orders at same time

### **2. Auto-Start on Import**
- Scheduler **starts automatically** when backend starts
- Runs as **daemon thread** in background
- **Thread-safe** database operations

### **3. Database Query Logic**
```sql
SELECT * FROM orders 
WHERE status = 'PENDING' 
AND hour_start_utc <= NOW()
```

## 📊 **API Endpoints:**

### **Check Scheduler Status:**
```bash
curl -X GET "http://localhost:8000/api/v1/scheduler/status"
```

**Response:**
```json
{
  "status": "success",
  "scheduler": {
    "running": true,
    "thread_alive": true,
    "pending_due_now": 0,
    "upcoming_10_min": 2,
    "next_due_order": "2025-08-17T21:45:45.000Z",
    "last_check": "2025-08-17T21:44:30.000Z"
  }
}
```

### **Manual Controls:**
```bash
# Start scheduler (if stopped)
curl -X POST "http://localhost:8000/api/v1/scheduler/start"

# Stop scheduler  
curl -X POST "http://localhost:8000/api/v1/scheduler/stop"

# Force immediate processing
curl -X POST "http://localhost:8000/api/v1/scheduler/force-run"
```

## ⚡ **Key Features:**

### **1. Automatic Processing:**
- ✅ **No manual intervention** needed
- ✅ **Exact timing**: Processes at scheduled `hour_start_utc`
- ✅ **Continuous monitoring**: Checks every 30 seconds
- ✅ **Batch efficient**: Groups orders by same time

### **2. Resilient Operation:**
- ✅ **Error handling**: Continues on individual order failures
- ✅ **Logging**: Detailed logs for monitoring
- ✅ **Thread safety**: Safe concurrent database access
- ✅ **Graceful shutdown**: Clean thread termination

### **3. Realistic Moderation:**
- ✅ **Random decisions**: 70% approval rate
- ✅ **RT LMP generation**: $30-$50 range (base $40 ±$10)
- ✅ **Rejection reasons**: Realistic market reasons
- ✅ **Status tracking**: PENDING → APPROVED/REJECTED

## 🎯 **User Experience:**

### **Frontend Workflow:**
1. **Create Fake Order** → Order stored with future `hour_start_utc`
2. **Order Shows PENDING** → Appears in positions table as pending
3. **Automatic Processing** → Scheduler moderates at exact time
4. **Status Updates** → Order becomes APPROVED/REJECTED automatically
5. **Live P&L** → Calculation begins with approval RT LMP

### **No Frontend Changes Needed:**
- Frontend doesn't need to poll or check
- Positions table automatically shows updated status
- P&L calculations work with approved orders
- Scheduler runs transparently in background

## 🔍 **Monitoring:**

### **Logs Output:**
```
🚀 Order scheduler started
⏰ 2 orders scheduled for moderation in next 5 min: ['2025-08-17T21:45:45.000Z', '2025-08-17T21:50:45.000Z']
🤖 Auto-moderating 1 orders for 2025-08-17T21:45:45.000Z
✅ Moderated 1 orders for 2025-08-17T21:45:45.000Z: 1 approved, 0 rejected
📊 Processed 1 orders in this cycle
```

### **Status Monitoring:**
```bash
# Check what's coming up
curl http://localhost:8000/api/v1/scheduler/status

# See upcoming orders and scheduler health
```

## 🚀 **Benefits:**

- **🎯 Precise timing**: Orders moderated at exact scheduled time
- **🔄 Zero maintenance**: Runs automatically in background  
- **📈 Scalable**: Handles multiple orders efficiently
- **🛡️ Reliable**: Error-resistant with proper logging
- **🧪 Perfect for testing**: Realistic order lifecycle simulation

Your fake orders now get automatically moderated at the exact `hour_start_utc` time with no manual intervention needed! 🎉

## 🔧 **Example Usage:**

1. **Create fake order at 21:41:57** → Gets `hour_start_utc: "2025-08-17T21:45:45.000Z"`
2. **Scheduler running** → Checks every 10 seconds for due orders  
3. **At exactly 21:45:45** → Scheduler finds the order and moderates it
4. **Order updated** → Status changes to APPROVED/REJECTED with RT LMP
5. **Positions table** → Shows the final result automatically