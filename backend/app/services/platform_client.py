from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import PLATFORM_API_URL, PLATFORM_APP_ID


def _app_path(path: str) -> str:
    return f"{PLATFORM_API_URL}/apps/{PLATFORM_APP_ID}{path}"


async def _platform_fetch(
    path: str, token: str, method: str = "GET", body: dict | None = None
) -> Any:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.request(
            method,
            _app_path(path),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        if not response.is_success:
            err = response.json() if response.content else {}
            msg = err.get("message") or err.get("error") or response.reason_phrase
            raise RuntimeError(msg)
        return response.json()


async def get_platform_me(token: str) -> dict:
    return await _platform_fetch("/me", token)


async def consume_platform_usage(token: str, params: dict) -> dict:
    return await _platform_fetch(
        "/usage/consume",
        token,
        method="POST",
        body={
            "featureCode": params["featureCode"],
            "quantity": params.get("quantity", 1),
            "costCredits": params.get("costCredits", 0),
            "allowTrial": params.get("allowTrial", True),
            "refType": params.get("refType"),
            "refId": params.get("refId"),
        },
    )


def has_active_membership_pass(me: dict, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    for e in me.get("entitlements", []):
        if e.get("entitlementCode") != "membership_pass" or e.get("status") != "active":
            continue
        ends_at = e.get("endsAt")
        if ends_at and datetime.fromisoformat(ends_at.replace("Z", "+00:00")) <= now:
            continue
        return True
    return False


def wallet_balance(me: dict, wallet_type: str) -> int:
    for w in me.get("wallets", []):
        if w.get("walletType") == wallet_type:
            return w.get("balance", 0)
    return 0
