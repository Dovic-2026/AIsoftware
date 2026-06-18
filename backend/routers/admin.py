"""
Super Admin API — manage users, subscriptions, and platform stats.
Frontend admin panel at /admin route in Next.js app.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional
from database import get_db
import models
from auth import hash_password
from config import settings

router = APIRouter(tags=["Admin"])

ADMIN_JWT_EXPIRE_HOURS = 24


def create_admin_token() -> str:
    expire = datetime.utcnow() + timedelta(hours=ADMIN_JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": "admin", "is_admin": True, "exp": expire}, settings.ADMIN_SECRET_KEY, algorithm="HS256")


def verify_admin_token(request: Request) -> bool:
    token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
    if not token:
        return False
    try:
        payload = jwt.decode(token, settings.ADMIN_SECRET_KEY, algorithms=["HS256"])
        return payload.get("is_admin") is True
    except JWTError:
        return False


def require_admin(request: Request):
    if not verify_admin_token(request):
        raise HTTPException(status_code=401, detail="Admin authentication required")


# ─── Admin Auth ───────────────────────────────────────────────────────────────

@router.post("/admin/login")
def admin_login(payload: dict, db: Session = Depends(get_db)):
    username = payload.get("username", "")
    password = payload.get("password", "")
    if username != settings.ADMIN_USERNAME or password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    token = create_admin_token()
    return {"token": token, "expires_in": ADMIN_JWT_EXPIRE_HOURS * 3600}


# ─── Admin Stats ─────────────────────────────────────────────────────────────

@router.get("/admin/stats")
def admin_stats(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    total_restaurants = db.query(models.Restaurant).count()
    active_restaurants = db.query(models.Restaurant).filter(models.Restaurant.is_active == True).count()
    total_users = db.query(models.User).count()
    total_orders = db.query(models.SalesOrder).count()

    by_plan = db.query(models.Restaurant.plan, func.count(models.Restaurant.id)).group_by(models.Restaurant.plan).all()
    by_status = db.query(models.Restaurant.subscription_status, func.count(models.Restaurant.id)).group_by(models.Restaurant.subscription_status).all()

    recent = db.query(models.Restaurant).order_by(models.Restaurant.created_at.desc()).limit(5).all()

    return {
        "total_restaurants": total_restaurants,
        "active_restaurants": active_restaurants,
        "total_users": total_users,
        "total_orders": total_orders,
        "by_plan": {p: c for p, c in by_plan},
        "by_status": {s: c for s, c in by_status},
        "recent_signups": [{"id": r.id, "name": r.name, "plan": r.plan, "city": r.city, "created_at": r.created_at.isoformat() if r.created_at else None} for r in recent],
    }


# ─── Manage Restaurants ───────────────────────────────────────────────────────

@router.get("/admin/restaurants")
def list_all_restaurants(request: Request, search: Optional[str] = None, db: Session = Depends(get_db)):
    require_admin(request)
    q = db.query(models.Restaurant)
    if search:
        q = q.filter(models.Restaurant.name.ilike(f"%{search}%"))
    restaurants = q.order_by(models.Restaurant.created_at.desc()).limit(200).all()
    result = []
    for r in restaurants:
        owner = db.query(models.RestaurantMember).filter(
            models.RestaurantMember.restaurant_id == r.id,
            models.RestaurantMember.role == models.UserRole.owner,
        ).first()
        owner_user = db.query(models.User).filter(models.User.id == owner.user_id).first() if owner else None
        result.append({
            "id": r.id, "name": r.name, "city": r.city, "phone": r.phone,
            "plan": r.plan, "subscription_status": r.subscription_status,
            "payment_status": r.payment_status, "is_active": r.is_active,
            "whatsapp_connected": r.whatsapp_connected,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "owner_email": owner_user.email if owner_user else None,
            "owner_name": owner_user.full_name if owner_user else None,
        })
    return result


@router.patch("/admin/restaurants/{restaurant_id}")
def update_restaurant_admin(
    restaurant_id: int, payload: dict,
    request: Request, db: Session = Depends(get_db)
):
    require_admin(request)
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    allowed = {"plan", "subscription_status", "payment_status", "is_active", "notes"}
    for k, v in payload.items():
        if k in allowed:
            # Validate enums
            if k == "plan":
                v = models.PlanType(v)
            elif k == "subscription_status":
                v = models.SubscriptionStatus(v)
            elif k == "payment_status":
                v = models.PaymentStatus(v)
            setattr(r, k, v)

    if payload.get("plan_expires_at"):
        r.plan_expires_at = datetime.fromisoformat(payload["plan_expires_at"])

    db.commit()
    db.refresh(r)
    return {"success": True, "restaurant_id": r.id, "plan": r.plan, "subscription_status": r.subscription_status}


@router.post("/admin/restaurants/{restaurant_id}/suspend")
def suspend_restaurant(restaurant_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    r.is_active = False
    r.subscription_status = models.SubscriptionStatus.suspended
    db.commit()
    return {"success": True}


@router.delete("/admin/restaurants/{restaurant_id}")
def delete_restaurant(restaurant_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    # Delete all related data
    db.query(models.WhatsAppSession).filter(models.WhatsAppSession.restaurant_id == restaurant_id).delete()
    db.query(models.RestaurantMember).filter(models.RestaurantMember.restaurant_id == restaurant_id).delete()
    db.query(models.MenuItem).filter(models.MenuItem.restaurant_id == restaurant_id).delete()
    db.query(models.MenuCategory).filter(models.MenuCategory.restaurant_id == restaurant_id).delete()
    db.query(models.InventoryItem).filter(models.InventoryItem.restaurant_id == restaurant_id).delete()
    db.query(models.SalesOrder).filter(models.SalesOrder.restaurant_id == restaurant_id).delete()
    db.query(models.Expense).filter(models.Expense.restaurant_id == restaurant_id).delete()
    db.query(models.Supplier).filter(models.Supplier.restaurant_id == restaurant_id).delete()
    db.query(models.StaffMember).filter(models.StaffMember.restaurant_id == restaurant_id).delete()
    db.query(models.DailyReport).filter(models.DailyReport.restaurant_id == restaurant_id).delete()
    db.delete(r)
    db.commit()
    return {"success": True}


# ─── Manage Users ─────────────────────────────────────────────────────────────

@router.get("/admin/users")
def list_all_users(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    users = db.query(models.User).order_by(models.User.created_at.desc()).limit(200).all()
    return [{"id": u.id, "email": u.email, "full_name": u.full_name, "phone": u.phone, "is_active": u.is_active, "created_at": u.created_at.isoformat() if u.created_at else None} for u in users]


@router.patch("/admin/users/{user_id}/reset-password")
def reset_user_password(user_id: int, payload: dict, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_password = payload.get("password")
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user.hashed_password = hash_password(new_password)
    db.commit()
    return {"success": True}


@router.post("/admin/users")
def create_user_admin(payload: dict, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    email = payload.get("email", "").strip().lower()
    full_name = payload.get("full_name", "").strip()
    password = payload.get("password", "").strip()
    phone = payload.get("phone", "").strip()

    if not email or not full_name or not password:
        raise HTTPException(status_code=400, detail="email, full_name and password are required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=email,
        full_name=full_name,
        phone=phone or None,
        hashed_password=hash_password(password),
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"success": True, "user_id": user.id, "email": user.email, "full_name": user.full_name}


@router.delete("/admin/users/{user_id}")
def delete_user_admin(user_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Remove memberships first
    db.query(models.RestaurantMember).filter(models.RestaurantMember.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"success": True}


# ─── Admin HTML Panel ─────────────────────────────────────────────────────────
