from fastapi import APIRouter

from app.services.local_auth import (
    login_by_sms,
    login_user,
    register_user,
    send_sms_code,
)

router = APIRouter()


@router.post("/register")
async def register(body: dict):
    return register_user(
        body.get("email", ""),
        body.get("password", ""),
        body.get("displayName", ""),
    )


@router.post("/login")
async def login(body: dict):
    return login_user(body.get("email", ""), body.get("password", ""))


@router.post("/send-sms")
async def send_sms(body: dict):
    return send_sms_code(body.get("phone", ""))


@router.post("/login-sms")
async def login_sms(body: dict):
    return login_by_sms(body.get("phone", ""), body.get("code", ""))

