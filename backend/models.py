from pydantic import BaseModel

class Order(BaseModel):
    hour_start: str
    direction: str   # "BUY" or "SELL"
    qty: float       # in MWh

# In-memory ledger (replace with SQLite later if needed)
orders = []
