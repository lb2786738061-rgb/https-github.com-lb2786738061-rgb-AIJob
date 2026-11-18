from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_auth_context
from app.services import payments as payment_service
from app.services import payment_providers
from app.utils import row_to_camel, rows_to_camel

router = APIRouter()


@router.get("/plans")
async def list_plans():
    return {
        "plans": payment_service.list_plans(),
        "channels": payment_providers.available_channels(),
    }


@router.post("/wechat/prepay")
async def wechat_prepay(body: dict, auth: dict = Depends(get_auth_context)):
    order_id = body.get("orderId")
    if not order_id:
        raise HTTPException(status_code=400, detail={"error": "orderId required"})
    from app.db.connection import get_db

    db = get_db()
    order = db.execute(
        "SELECT * FROM subscription_orders WHERE id = ? AND user_id = ?",
        (order_id, auth["userId"]),
    ).fetchone()
    if not order:
        raise HTTPException(status_code=404, detail={"error": "订单不存在"})
    prepay = payment_providers.create_wechat_prepay(dict(order), body.get("openid"))
    return prepay


@router.post("/wechat/notify")
async def wechat_notify(body: dict):
    if not payment_providers.verify_wechat_notify(body):
        raise HTTPException(status_code=400, detail={"error": "Invalid notify"})
    order_id = body.get("orderId") or body.get("out_trade_no")
    user_id = body.get("userId")
    if not order_id or not user_id:
        return {"code": "SUCCESS", "message": "ignored"}
    try:
        payment_service.confirm_order(int(user_id), int(order_id))
    except Exception:
        pass
    return {"code": "SUCCESS", "message": "OK"}


@router.get("/orders")
async def list_orders(auth: dict = Depends(get_auth_context)):
    orders = payment_service.list_user_orders(auth["userId"])
    return {"orders": rows_to_camel(orders)}


@router.post("/checkout")
async def checkout(body: dict, auth: dict = Depends(get_auth_context)):
    plan_id = body.get("planId", "")
    try:
        order = payment_service.create_order(auth["userId"], plan_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc

    plan = payment_service.get_plan(plan_id)
    return {
        "order": row_to_camel(order),
        "plan": plan,
        "paymentHint": "开发环境：调用 confirm 接口模拟支付成功",
    }


@router.post("/confirm/{order_id}")
async def confirm_payment(order_id: int, auth: dict = Depends(get_auth_context)):
    try:
        order = payment_service.confirm_order(auth["userId"], order_id)
    except LookupError:
        raise HTTPException(status_code=404, detail={"error": "订单不存在"}) from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc

    return {
        "order": row_to_camel(order),
        "message": "支付成功，权益已开通",
    }
