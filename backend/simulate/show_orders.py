import sqlite3, os

DB_PATH = os.environ.get("DB_PATH", "/app/data/trading.db")

con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row

rows = con.execute("""
    SELECT id, created_at, market, location, hour_start_utc, side, qty_mwh, limit_price, status
    FROM orders
    ORDER BY created_at DESC
    LIMIT 10
""").fetchall()

print("Last 10 orders:")
for r in rows:
    print(dict(r))
