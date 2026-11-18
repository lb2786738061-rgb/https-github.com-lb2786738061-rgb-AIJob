from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGINS, PORT
from app.db.migrate import migrate
from app.middleware.rate_limit import RateLimitMiddleware
from app.routes import admin, auth, interview, payments, resume, user, voice
from app.services import catalog as catalog_service
from app.services.llm import is_llm_available


@asynccontextmanager
async def lifespan(_app: FastAPI):
    migrate()
    catalog_service.ensure_catalog_seeded()
    print(f"CareerAI API running on http://localhost:{PORT}")
    print(f"LLM: {'enabled' if is_llm_available() else 'rule-based fallback'}")
    print(f"Voice WebSocket available at ws://localhost:{PORT}/api/v1/voice/ws")
    yield


app = FastAPI(title="CareerAI API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    messages = "; ".join(
        e.get("msg", "") for e in exc.errors() if e.get("msg")
    )
    return JSONResponse(
        status_code=400,
        content={"error": messages, "code": "VALIDATION_ERROR"},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception):
    if isinstance(exc, Exception) and hasattr(exc, "status_code"):
        detail = getattr(exc, "detail", str(exc))
        if isinstance(detail, dict):
            return JSONResponse(status_code=exc.status_code, content=detail)
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "llmEnabled": is_llm_available(),
        "version": "0.3.0",
        "features": ["platform-auth", "enterprise", "voice-ws"],
    }


app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(resume.router, prefix="/api/v1/resumes", tags=["resumes"])
app.include_router(interview.router, prefix="/api/v1/interviews", tags=["interviews"])
app.include_router(user.router, prefix="/api/v1/user", tags=["user"])
app.include_router(voice.router, prefix="/api/v1/voice", tags=["voice"])
