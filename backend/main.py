from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from database import engine, Base
from config import settings
import os, logging

import models

from routers import auth, menu, inventory, sales, expenses, suppliers, staff, reports, whatsapp, dashboard, restaurant
from routers import admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ready")
    except Exception as e:
        logger.warning(f"DB create_all skipped: {e}")
    os.makedirs("uploads/menu", exist_ok=True)
    os.makedirs("uploads/receipts", exist_ok=True)
    logger.info("DOVIC AI Restaurant OS — Backend Ready")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="DOVIC AI Restaurant OS",
    description="Complete restaurant management via API + WhatsApp",
    version="1.0.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "https://*.vercel.app",
    "https://*.onrender.com",
]
if settings.ENVIRONMENT == "development":
    ALLOWED_ORIGINS.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if settings.ENVIRONMENT != "development" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router, prefix="/api/v1")
app.include_router(restaurant.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(menu.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(sales.router, prefix="/api/v1")
app.include_router(expenses.router, prefix="/api/v1")
app.include_router(suppliers.router, prefix="/api/v1")
app.include_router(staff.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(whatsapp.router, prefix="/api/v1")
app.include_router(admin.router)  # No prefix — /admin and /admin/* at root


@app.get("/")
def root():
    return {
        "app": "DOVIC AI Restaurant OS",
        "version": "1.0.0",
        "docs": "/docs",
        "admin": "/admin",
        "status": "running",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
