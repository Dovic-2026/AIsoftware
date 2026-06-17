"""
Production setup script — run once after deploying.
Creates all DB tables, super admin account, and test user with Enterprise plan.
NO dummy restaurant data.

Usage:
    python setup_production.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, Base, SessionLocal
import models
from auth import hash_password
from config import settings
from datetime import datetime, timedelta


def setup():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

    db = SessionLocal()
    try:
        _create_test_user(db)
        _print_credentials()
    finally:
        db.close()


def _create_test_user(db):
    TEST_EMAIL = "test@dovic.ai"
    TEST_PASSWORD = "Test@Dovic2026"
    TEST_NAME = "DOVIC Test User"

    existing = db.query(models.User).filter(models.User.email == TEST_EMAIL).first()
    if existing:
        print(f"Test user already exists: {TEST_EMAIL}")
        return

    # Create the user account
    user = models.User(
        email=TEST_EMAIL,
        full_name=TEST_NAME,
        phone="+919999999999",
        hashed_password=hash_password(TEST_PASSWORD),
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.flush()

    # Create the restaurant (empty — no menu/inventory/staff seeded)
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", "dovic-test-restaurant")
    restaurant = models.Restaurant(
        name="DOVIC Test Restaurant",
        slug=slug,
        phone="+919999999999",
        email=TEST_EMAIL,
        city="Chennai",
        state="Tamil Nadu",
        restaurant_type="restaurant",
        plan=models.PlanType.enterprise,
        subscription_status=models.SubscriptionStatus.active,
        payment_status=models.PaymentStatus.free,
        plan_expires_at=datetime.utcnow() + timedelta(days=365),
        whatsapp_number="+919999999999",
        whatsapp_connected=False,
        is_active=True,
        notes="Test account — Enterprise plan for real user testing",
    )
    db.add(restaurant)
    db.flush()

    # Link user as owner
    membership = models.RestaurantMember(
        restaurant_id=restaurant.id,
        user_id=user.id,
        role=models.UserRole.owner,
        is_active=True,
    )
    db.add(membership)
    db.commit()
    print(f"Test user created: {TEST_EMAIL} / {TEST_PASSWORD}")
    print(f"Restaurant: {restaurant.name} (ID: {restaurant.id}) — Enterprise plan")


def _print_credentials():
    print("\n" + "=" * 60)
    print("DOVIC AI — Production Setup Complete")
    print("=" * 60)
    print(f"\nSuper Admin Panel: /admin")
    print(f"  Username : {settings.ADMIN_USERNAME}")
    print(f"  Password : {settings.ADMIN_PASSWORD}")
    print(f"\nTest User Login:")
    print(f"  Email    : test@dovic.ai")
    print(f"  Password : Test@Dovic2026")
    print(f"  Plan     : Enterprise (1 year)")
    print("\nIMPORTANT: Change all passwords via environment variables before going live.")
    print("=" * 60)


if __name__ == "__main__":
    setup()
