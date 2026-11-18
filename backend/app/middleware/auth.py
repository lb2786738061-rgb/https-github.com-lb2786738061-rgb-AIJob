import jwt
from fastapi import HTTPException, Request

from app.config import PLATFORM_JWT_SECRET
from app.services.platform_client import get_platform_me
from app.services.shadow_user import resolve_shadow_user


async def resolve_token(token: str) -> dict:
    if not token:
        raise HTTPException(
            status_code=401,
            detail={"error": "未登录或 token 无效", "code": "UNAUTHORIZED"},
        )

    try:
        payload = jwt.decode(
            token,
            PLATFORM_JWT_SECRET,
            algorithms=["HS256"],
            issuer="umams",
            audience="umams",
        )
        platform_user_id = payload.get("sub")
        if not platform_user_id or not isinstance(platform_user_id, str):
            raise HTTPException(
                status_code=401,
                detail={"error": "无效的平台 token", "code": "UNAUTHORIZED"},
            )

        try:
            platform_me = await get_platform_me(token)
        except Exception:
            platform_me = None

        shadow = resolve_shadow_user(platform_user_id, platform_me)
        return {
            "userId": shadow["id"],
            "platformUserId": platform_user_id,
            "platformToken": token,
        }
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail={"error": "未登录或 token 无效", "code": "UNAUTHORIZED"},
        ) from None


async def get_auth_context(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    return await resolve_token(token or "")
