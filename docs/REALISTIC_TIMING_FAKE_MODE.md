# ⏰ Realistic Fake Mode Timing

The fake mode now implements realistic market timing that matches real energy trading operations.

## 🕐 **Timing Logic**

### **Example Scenario:**
- **Current Time**: 3:27 PM
- **Order Placed**: Immediately stored as PENDING
- **Moderation Time**: 4:00:45 PM (next 5-min mark + 45s buffer)
- **Status**: PENDING until moderation triggers

### **5-Minute Intervals:**
- **3:27 PM** → Next 5-min: **3:30 PM** → Moderation: **3:30:45 PM**
- **3:32 PM** → Next 5-min: **3:35 PM** → Moderation: **3:35:45 PM**
- **3:58 PM** → Next 5-min: **4:00 PM** → Moderation: **4:00:45 PM**

## 🎯 **Implementation Details**

### **Frontend Calculation:**
```typescript
const getNextModerationTime = () => {
  const now = new Date(currentTime)
  const minutes = now.getMinutes()
  const nextFiveMin = Math.ceil(minutes / 5) * 5
  
  const nextModerationTime = new Date(now)
  if (nextFiveMin >= 60) {
    // Next hour, 0 minutes + 45 seconds
    nextModerationTime.setHours(nextModerationTime.getHours() + 1, 0, 45, 0)
  } else {
    // Same hour, next 5-min mark + 45 seconds
    nextModerationTime.setMinutes(nextFiveMin, 45, 0)
  }
  
  return nextModerationTime
}
```

### **Backend Moderation:**
- **API**: `POST /api/v1/orders/moderate/{hour_start_utc}`
- **Random Logic**: 70% approval rate
- **RT LMP**: $30-$50 range (base $40 ±$10)
- **Status Update**: PENDING → APPROVED/REJECTED

## 📊 **User Experience Timeline**

```
3:27 PM - Order Placed
  ↓ (Order stored as PENDING)
  ↓ (User sees: "Pending until 3:30:45 PM")
  ↓ (Positions table shows PENDING status)
  ↓
3:30:45 PM - Auto-Moderation Triggers
  ↓ (API call to moderate hour)
  ↓ (Random approval/rejection)
  ↓ (Database updated)
  ↓
3:30:46 PM - Result Displayed
  ↓ (UI shows: "Order approved at $42.35")
  ↓ (Positions table shows APPROVED status)
  ↓ (Live P&L calculation begins)
```

## 🎨 **UI Updates**

### **Fake Mode Info Panel:**
```
┌─────────────────────────────────────────────────────────┐
│ 📁 Fake Mode Active                                     │
│    Orders auto-moderate at 3:30:45 PM (next 5-min + 45s) │
└─────────────────────────────────────────────────────────┘
```

### **Hour Selection (Fake Mode):**
```
┌─────────────────────────────────────────────────────────┐
│ Auto-selected: 16:00 - 17:00          ~$42.50          │
│ Fake mode uses current time + 1 hour                   │
│ ─────────────────────────────────────────────────────── │
│ 🕒 Moderation at: 3:30:45 PM (next 5-min + 45s buffer) │
└─────────────────────────────────────────────────────────┘
```

### **Success Message:**
```
✅ Fake order created for hour 16:00! 
   Order ID: 3ec7bc61... (Pending until 3:30:45 PM)
```

## ⚡ **Benefits**

### **Realistic Market Simulation:**
- ✅ **Real timing**: Matches actual energy market operations  
- ✅ **Buffer time**: 45-second safety margin for processing
- ✅ **5-minute intervals**: Aligns with RT data publication
- ✅ **Pending state**: Orders stay PENDING until moderation

### **Better Testing:**
- ✅ **Predictable timing**: Users know exactly when moderation happens
- ✅ **Realistic delays**: Not instant, but realistic market timing
- ✅ **Visual feedback**: Clear countdown and status messaging
- ✅ **Database persistence**: Orders stored immediately, updated later

The fake mode now perfectly simulates real energy market timing with automatic moderation at realistic intervals! 🎯