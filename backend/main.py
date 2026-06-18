from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from database import engine, Base, SessionLocal
from config import settings
import os, logging, asyncio
from datetime import datetime, date
import pytz

import models

from routers import auth, menu, inventory, sales, expenses, suppliers, staff, reports, whatsapp, dashboard, restaurant
from routers import admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")


async def _send_nightly_reports():
    """Send daily WhatsApp report to every restaurant owner at 9 PM IST."""
    from services.whatsapp_service import send_whatsapp_message
    from services.ai_service import gather_daily_metrics, generate_whatsapp_summary
    db = SessionLocal()
    try:
        restaurants = db.query(models.Restaurant).filter(models.Restaurant.is_active == True).all()
        for r in restaurants:
            try:
                # Find owner phone
                owner_member = db.query(models.RestaurantMember).filter(
                    models.RestaurantMember.restaurant_id == r.id,
                    models.RestaurantMember.role == models.UserRole.owner,
                ).first()
                owner = db.query(models.User).filter(models.User.id == owner_member.user_id).first() if owner_member else None
                owner_phone = (owner.phone if owner and owner.phone else None) or r.phone
                if not owner_phone:
                    continue
                metrics = gather_daily_metrics(r.id, date.today(), db)
                summary = await generate_whatsapp_summary(metrics, r.name)
                header = f"🌙 *Nightly Report — {r.name}*\n_{date.today().strftime('%d %B %Y')}_\n\n"
                await send_whatsapp_message(owner_phone, header + summary)
                logger.info(f"[Nightly] Sent report for {r.name} → {owner_phone}")
            except Exception as e:
                logger.error(f"[Nightly] Failed for {r.name}: {e}")
    finally:
        db.close()


async def nightly_report_scheduler():
    """Loop forever; fire _send_nightly_reports at 21:00 IST each day."""
    while True:
        now = datetime.now(IST)
        target = now.replace(hour=21, minute=0, second=0, microsecond=0)
        if now >= target:
            target = target.replace(day=target.day + 1)
        wait_secs = (target - now).total_seconds()
        logger.info(f"[Nightly] Next report in {wait_secs/3600:.1f} hrs")
        await asyncio.sleep(wait_secs)
        await _send_nightly_reports()


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
    asyncio.create_task(nightly_report_scheduler())
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
    "https://aisoftware-ashen.vercel.app",
    "https://ai-software-git-master-dovic.vercel.app",
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
