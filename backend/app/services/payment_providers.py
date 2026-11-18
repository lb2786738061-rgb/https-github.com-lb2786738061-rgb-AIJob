import hashlib
import os
import time
import uuid
from typing import Literal

from app.config import PORT

PaymentChannel = Literal["mock", "wechat"]

WECHAT_PAY_ENABLED = os.getenv("WECHAT_PAY_ENABLED", "false").lower() == "true"
WECHAT_APP_ID = os.getenv("WECHAT_APP_ID", "")
WECHAT_MCH_ID = os.getenv("WECHAT_MCH_ID", "")
WECHAT_API_KEY = os.getenv("WECHAT_API_KEY", "")
WECHAT_NOTIFY_URL = os.getenv(
    "WECHAT_NOTIFY_URL", f"http://localhost:{PORT}/api/v1/payments/wechat/notify"
)


def available_channels() -> list[str]:
    channels = ["mock"]
    if WECHAT_PAY_ENABLED and WECHAT_APP_ID and WECHAT_MCH_ID and WECHAT_API_KEY:
        channels.append("wechat")
    return channels


def create_wechat_prepay(order: dict, openid: str | None = None) -> dict:
    if not WECHAT_PAY_ENABLED:
        return {
            "channel": "mock",
            "orderId": order["id"],
            "message": "微信支付未启用，请使用 confirm 接口模拟支付",
        }

    nonce = uuid.uuid4().hex[:16]
    timestamp = str(int(time.time()))
    package = f"prepay_id=mock_{order['id']}_{nonce}"

    sign_payload = {
        "appId": WECHAT_APP_ID,
        "timeStamp": timestamp,
        "nonceStr": nonce,
        "package": package,
        "signType": "MD5",
    }
    sign_str = "&".join(f"{k}={sign_payload[k]}" for k in sorted(sign_payload)) + f"&key={WECHAT_API_KEY}"
    pay_sign = hashlib.md5(sign_str.encode()).hexdigest().upper()

    return {
        "channel": "wechat",
        "orderId": order["id"],
        "appId": WECHAT_APP_ID,
        "timeStamp": timestamp,
        "nonceStr": nonce,
        "package": package,
        "signType": "MD5",
        "paySign": pay_sign,
        "message": "开发环境返回 mock prepay 参数；生产需对接微信支付 v3 API",
        "openid": openid,
    }


def verify_wechat_notify(payload: dict) -> bool:
    if not WECHAT_PAY_ENABLED:
        return payload.get("mockPaid") is True
    return payload.get("result_code") == "SUCCESS"
