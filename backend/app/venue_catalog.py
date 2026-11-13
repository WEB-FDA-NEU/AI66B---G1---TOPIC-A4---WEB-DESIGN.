"""Demo zone defaults for seed only; runtime reads zones.booking_type.

No existing rows are rewritten. Unknown legacy zones retain their numbered-seat
contract; only explicitly configured standing zones use quantity inventory.
"""
from functools import lru_cache
import json
from pathlib import Path


@lru_cache(maxsize=1)
def zone_catalog() -> dict:
    return json.loads(Path(__file__).with_name('venue_zones.json').read_text(encoding='utf-8'))


def booking_type(concert_id: int, zone_name: str) -> str:
    return zone_catalog().get(str(concert_id), {}).get(zone_name, 'seated')
