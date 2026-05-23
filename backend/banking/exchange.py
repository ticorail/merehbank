"""Simple exchange rate helper using https://fxapi.app.

Provides `get_rate(base, target)` returning a Decimal rate (target per base).
Caches results in-memory for a short TTL to avoid excessive HTTP calls.
"""
from __future__ import annotations

import json
import time
import urllib.request
from decimal import Decimal
from typing import Dict

_CACHE: Dict[str, Dict] = {}
_TTL_SECONDS = 60


def get_rate(base: str, target: str) -> Decimal:
    """Return the exchange rate (target per base) as a Decimal.

    Example: get_rate('USD', 'HTG') returns how many HTG 1 USD is worth.
    """
    key = f"{base.upper()}_{target.upper()}"
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached["ts"] < _TTL_SECONDS:
        return cached["rate"]

    url = f"https://fxapi.app/api/{base.upper()}/{target.upper()}.json"
    try:
        request = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; MerehBank/1.0)',
                'Accept': 'application/json',
            },
        )
        with urllib.request.urlopen(request, timeout=6) as resp:
            payload = json.load(resp)
    except Exception as exc:  # network / parsing errors
        raise RuntimeError(f"failed to fetch exchange rate: {exc}")

    rate = payload.get("rate")
    if rate is None:
        raise RuntimeError("exchange API returned no rate")

    rate_dec = Decimal(str(rate))
    _CACHE[key] = {"rate": rate_dec, "ts": now}
    return rate_dec
