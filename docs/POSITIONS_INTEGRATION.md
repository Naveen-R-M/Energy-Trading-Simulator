# 📊 Positions Management Integration

Your positions table will now display data from `/api/v1/fetch_orders` exactly as you requested!

## 🎯 **How Your Data Maps to the Table:**

Based on your API response:
```json
{
  "closed": {
    "count": 1,
    "orders": [
      {
        "id": "3ec7bc61-d604-4648-b2ed-95220cf615b2",
        "created_at": "2025-08-16T14:30:00+00:00",
        "market": "DA",
        "location_type": "ZONE", 
        "location": "PJM-RTO",
        "hour_start_utc": "2025-08-17T16:00:00+00:00",
        "side": "BUY",
        "qty_mwh": 5,
        "limit_price": 45,
        "status": "APPROVED",
        "approved_at": "2025-08-17T16:40:04+00:00",
        "approval_rt_interval_start_utc": "2025-08-17T16:30:00+00:00",
        "approval_rt_lmp": 35.97,
        "approval_rt_source": "local:rt_latest",
        "reject_reason": null
      }
    ]
  }
}
```

## 📋 **Table Display:**

| Hour | DA LMP | Side | Quantity | Progress | Live P&L | Projected P&L | Status |
|------|--------|------|----------|----------|----------|---------------|---------|
| Aug 17, 12PM | $45.00 (Bid) | BUY | 5 MWh | APPROVED | **-$45.15** | — | APPROVED |

**Live P&L Calculation:**
- BUY order at $45.00 bid
- RT price: $35.97
- P&L = (35.97 - 45.00) × 5 = **-$45.15** (loss because RT < DA)

## ✅ **Features Working:**

1. **✅ Hour** - Shows "Aug 17, 12PM" (ET) with UTC tooltip
2. **✅ DA LMP** - Shows "$45.00 (Bid)" since no DA clearing price stored yet  
3. **✅ Side** - Green "BUY" badge
4. **✅ Quantity** - "5 MWh"
5. **✅ Progress** - Blue progress pill at 66% showing "APPROVED"
6. **✅ Live P&L** - Red "-$45.15" (calculated from approval_rt_lmp vs limit_price)
7. **✅ Projected P&L** - Shows "—" (ready for future enhancement)
8. **✅ Status** - Blue "APPROVED" badge

## 🚀 **To Use in Your App:**

```tsx
import PositionsManager from './components/positions-manager';

// In your app
<PositionsManager />
```

The component will:
1. **Fetch data** from `/api/v1/fetch_orders`
2. **Show tabs** for "Open Positions (0)" and "Closed Positions (1)"
3. **Display the table** with your exact data structure
4. **Calculate P&L** automatically using your approval_rt_lmp data
5. **Handle loading/error states**

Your positions management is now fully integrated with your backend API! 🎉

## 💡 **P&L Logic:**

- **BUY orders**: Profit when RT > DA (buy low, sell high)
- **SELL orders**: Profit when DA > RT (sell high, buy back low)
- Uses `approval_rt_lmp` (35.97) vs `limit_price` (45.00) for calculations
- Shows red for losses, green for profits