from fastapi import APIRouter

from app.services.local_auth import login_user, register_user

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
