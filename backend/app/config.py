import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "3002"))
DATABASE_URL = os.getenv("DATABASE_URL", "./data/careerai.db")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
LLM_CONNECT_TIMEOUT = float(os.getenv("LLM_CONNECT_TIMEOUT", "10"))
LLM_READ_TIMEOUT = float(os.getenv("LLM_READ_TIMEOUT", "25"))
LLM_RESUME_READ_TIMEOUT = float(os.getenv("LLM_RESUME_READ_TIMEOUT", "120"))
PLATFORM_API_URL = os.getenv("PLATFORM_API_URL", "http://localhost:3001")
PLATFORM_APP_ID = os.getenv("PLATFORM_APP_ID", "f8a2c91e3d7b4a6f9e0c1d2b3a4f5e6d")
PLATFORM_JWT_SECRET = os.getenv(
    "PLATFORM_JWT_SECRET", "umams-dev-jwt-secret-change-me-32chars-min!!"
)
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174"
    ).split(",")
    if o.strip()
]

BASE_DIR = Path(__file__).resolve().parent.parent
