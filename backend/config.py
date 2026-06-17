from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "DOVIC AI Restaurant OS"
    SECRET_KEY: str = "change-this-in-production-min-32-chars-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Database — use PostgreSQL for production (Supabase)
    DATABASE_URL: str = "sqlite:///./dovic.db"

    # Super Admin credentials (set via environment variables)
    ADMIN_USERNAME: str = "dovic_admin"
    ADMIN_PASSWORD: str = "Admin@Dovic2026"  # Change via env var in production
    ADMIN_SECRET_KEY: str = "admin-secret-key-change-in-production"

    # WhatsApp
    DOVIC_WA_PROVIDER: str = "mock"
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"
    META_WA_TOKEN: Optional[str] = None
    META_WA_PHONE_ID: Optional[str] = None
    META_WA_VERIFY_TOKEN: str = "dovic_webhook_verify_2026"

    # Scheduler
    DAILY_REPORT_HOUR: int = 6
    DAILY_REPORT_MINUTE: int = 0
    REPORT_TIMEZONE: str = "Asia/Kolkata"

    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
