import time

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

WINDOW_MS = 60_000
MAX_REQUESTS = 120

_buckets: dict[str, dict] = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/v1/"):
            return await call_next(request)

        ip = (
            request.headers.get("x-forwarded-for")
            or request.headers.get("x-real-ip")
            or "unknown"
        )
        parts = request.url.path.split("/")
        resource = parts[3] if len(parts) > 3 else "root"
        key = f"{ip}:{resource}"
        now = time.time() * 1000

        bucket = _buckets.get(key)
        if not bucket or now > bucket["resetAt"]:
            bucket = {"count": 0, "resetAt": now + WINDOW_MS}
            _buckets[key] = bucket

        bucket["count"] += 1
        if bucket["count"] > MAX_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail={"error": "请求过于频繁，请稍后再试", "code": "RATE_LIMIT"},
            )

        return await call_next(request)
