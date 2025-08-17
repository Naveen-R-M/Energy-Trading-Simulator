# 📊 Updated Positions Management Table

The table columns have been updated as requested:

## 🎯 **New Column Structure:**

| Column | Content | Source |
|--------|---------|--------|
| **Hour** | Aug 17, 12PM (ET) | `hour_start_utc` converted to ET |
| **DA LMP** | $45.00 (Bid) | `limit_price` |
| **Side** | BUY/SELL badge | `side` |
| **Quantity** | 5 MWh | `qty_mwh` |
| **Progress** | APPROVED pill | `status` |
| **Approval LMP** | $35.97 | `approval_rt_lmp` |
| **Live P&L** | — | Empty for now |
| **Status** | APPROVED badge | `status` |

## 📋 **Sample Display:**

For your example order:
```json
{
  "approval_rt_lmp": 35.97,
  "limit_price": 45,
  "qty_mwh": 5,
  "side": "BUY",
  "status": "APPROVED"
}
```

**Table Row:**
| Hour | DA LMP | Side | Quantity | Progress | Approval LMP | Live P&L | Status |
|------|--------|------|----------|----------|--------------|----------|---------|
| Aug 17, 12PM | $45.00 (Bid) | BUY | 5 MWh | APPROVED | **$35.97** | — | APPROVED |

## ✅ **Changes Made:**

1. **✅ "Live P&L" → "Approval LMP"** - Now shows `approval_rt_lmp` ($35.97)
2. **✅ "Projected P&L" → "Live P&L"** - Now empty with "—"
3. **✅ Data mapping updated** - Approval LMP displays the actual real-time price at approval

## 🎨 **Visual Updates:**

- **Approval LMP**: Shows actual dollar amount from your data
- **Live P&L**: Shows placeholder "—" ready for future P&L calculations
- **Same styling**: Consistent with rest of table design

Your table now exactly matches the screenshot layout! 🎯