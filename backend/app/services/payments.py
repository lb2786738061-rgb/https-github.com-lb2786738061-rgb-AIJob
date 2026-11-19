from datetime import datetime, timedelta, timezone
from typing import TypedDict

from app.db.connection import get_db

PlanId = str


class PlanDefinition(TypedDict):
    id: PlanId
    name: str
    planType: str
    priceCents: int
    priceLabel: str
    durationDays: int | None
    features: list[str]
    recommended: bool


PLANS: list[PlanDefinition] = [
    {
        "id": "monthly",
        "name": "通关会员月卡",
        "planType": "monthly",
        "priceCents": 6900,
        "priceLabel": "¥69/月",
        "durationDays": 30,
        "features": [
            "无限次简历精修与重新分析",
            "无限次多角色模拟面试",
            "深度复盘报告与满分参考答案",
        ],
        "recommended": True,
    },
    {
        "id": "quarterly",
        "name": "通关会员季卡",
        "planType": "quarterly",
        "priceCents": 16800,
        "priceLabel": "¥168/季",
        "durationDays": 90,
        "features": [
            "月卡全部权益",
            "季卡更优惠，适合集中求职期",
            "优先体验新功能",
        ],
        "recommended": False,
    },
    {
        "id": "enterprise_pack",
        "name": "名企定向冲刺包",
        "planType": "enterprise_pack",
        "priceCents": 19900,
        "priceLabel": "¥199/次",
        "durationDays": None,
        "features": [
            "1 次大厂真题专项突击训练",
            "AI + 算法双重精修反馈",
            "针对字节/阿里/腾讯/华为/麦肯锡等",
        ],
        "recommended": False,
    },
]


def get_plan(plan_id: str) -> PlanDefinition | None:
    for plan in PLANS:
        if plan["id"] == plan_id:
            return plan
    return None


def list_plans() -> list[PlanDefinition]:
    return PLANS


def create_order(user_id: int, plan_id: str) -> dict:
    plan = get_plan(plan_id)
    if not plan:
        raise ValueError("Invalid plan")

    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    cursor = db.execute(
        """INSERT INTO subscription_orders
           (user_id, plan_type, amount_cents, status, created_at)
           VALUES (?, ?, ?, 'pending', ?)""",
        (user_id, plan["planType"], plan["priceCents"], now),
    )
    db.commit()
    order_id = cursor.lastrowid
    row = db.execute(
        "SELECT * FROM subscription_orders WHERE id = ?", (order_id,)
    ).fetchone()
    return dict(row)


def confirm_order(user_id: int, order_id: int) -> dict:
    db = get_db()
    order = db.execute(
        "SELECT * FROM subscription_orders WHERE id = ?", (order_id,)
    ).fetchone()
    if not order or order["user_id"] != user_id:
        raise LookupError("Order not found")
    if order["status"] == "paid":
        return dict(order)

    plan = get_plan(order["plan_type"])
    if not plan:
        plan = next((p for p in PLANS if p["planType"] == order["plan_type"]), None)
    if not plan:
        raise ValueError("Unknown plan type on order")

    now = datetime.now(timezone.utc)
    paid_at = now.isoformat()
    expires_at: str | None = None

    if plan["planType"] in ("monthly", "quarterly") and plan["durationDays"]:
        expires_at = (now + timedelta(days=plan["durationDays"])).isoformat()
        db.execute(
            "UPDATE users SET plan_tier = 'membership_pass' WHERE id = ?",
            (user_id,),
        )
    elif plan["planType"] == "enterprise_pack":
        existing = db.execute(
            "SELECT id FROM usage_quotas WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing:
            db.execute(
                "UPDATE usage_quotas SET enterprise_credits = enterprise_credits + 1 WHERE user_id = ?",
                (user_id,),
            )
        else:
            db.execute(
                """INSERT INTO usage_quotas
                   (user_id, resume_diagnosis_used, mock_interview_used, reanalyze_used, enterprise_credits)
                   VALUES (?, 0, 0, 0, 1)""",
                (user_id,),
            )

    db.execute(
        """UPDATE subscription_orders
           SET status = 'paid', paid_at = ?, expires_at = ?
           WHERE id = ?""",
        (paid_at, expires_at, order_id),
    )
    db.commit()

    updated = db.execute(
        "SELECT * FROM subscription_orders WHERE id = ?", (order_id,)
    ).fetchone()
    return dict(updated)


def list_user_orders(user_id: int) -> list[dict]:
    db = get_db()
    rows = db.execute(
        "SELECT * FROM subscription_orders WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def refund_order(user_id: int, order_id: int, reason: str = "") -> dict:
    db = get_db()
    row = db.execute(
        "SELECT * FROM subscription_orders WHERE id = ? AND user_id = ?",
        (order_id, user_id),
    ).fetchone()
    if not row:
        raise LookupError("Order not found")
    order = dict(row)
    if order["status"] != "paid":
        raise ValueError("Only paid orders can be refunded")
    if order.get("refund_status") == "refunded":
        raise ValueError("Order already refunded")

    now = datetime.now(timezone.utc).isoformat()
    refund_reason = reason.strip() or "用户在管理面板申请退款"

    if order["plan_type"] == "enterprise_pack":
        db.execute(
            "UPDATE usage_quotas SET enterprise_credits = MAX(0, enterprise_credits - 1) WHERE user_id = ?",
            (user_id,),
        )
    elif order["plan_type"] in ("monthly", "quarterly"):
        other_active = db.execute(
            """SELECT id FROM subscription_orders
               WHERE user_id = ? AND id != ? AND status = 'paid'
                 AND plan_type IN ('monthly', 'quarterly')""",
            (user_id, order_id),
        ).fetchone()
        if not other_active:
            db.execute("UPDATE users SET plan_tier = 'free' WHERE id = ?", (user_id,))

    db.execute(
        """UPDATE subscription_orders
           SET status = 'refunded',
               refund_status = 'refunded',
               refund_reason = ?,
               refunded_at = ?
           WHERE id = ?""",
        (refund_reason, now, order_id),
    )
    db.commit()

    updated = db.execute(
        "SELECT * FROM subscription_orders WHERE id = ?", (order_id,)
    ).fetchone()
    return dict(updated)



def has_active_membership(user_id: int) -> bool:
    db = get_db()
    row = db.execute(
        """SELECT expires_at FROM subscription_orders
           WHERE user_id = ? AND status = 'paid'
             AND plan_type IN ('monthly', 'quarterly')
           ORDER BY expires_at DESC LIMIT 1""",
        (user_id,),
    ).fetchone()
    if not row or not row["expires_at"]:
        user = db.execute("SELECT plan_tier FROM users WHERE id = ?", (user_id,)).fetchone()
        return bool(user and user["plan_tier"] == "membership_pass")

    try:
        expires = datetime.fromisoformat(row["expires_at"])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return expires > datetime.now(timezone.utc)
    except ValueError:
        return False
