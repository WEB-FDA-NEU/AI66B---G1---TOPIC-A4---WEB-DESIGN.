import os
from datetime import timedelta

# A seat hold lasts 5 minutes (matches the countdown shown on the checkout page).
RESERVATION_TTL = timedelta(seconds=int(os.getenv("RESERVATION_TTL_SECONDS", "300")))
MAX_SEATS_PER_RESERVATION = 8
# Customers may cancel a paid order until this long before the concert starts.
CANCEL_CUTOFF = timedelta(hours=24)
PAYMENT_METHODS = ("card", "ewallet", "bank_transfer")
# How often the background sweeper releases expired holds (seconds).
EXPIRY_SWEEP_INTERVAL = 30
# Retries when PostgreSQL aborts a transaction because of a deadlock/serialization clash.
MAX_TX_RETRIES = 3
