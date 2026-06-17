from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth as auth_utils
import re

router = APIRouter(prefix="/auth", tags=["Authentication"])


def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return s[:50]


@router.post("/register", response_model=schemas.Token)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        phone=payload.phone,
        hashed_password=auth_utils.hash_password(payload.password),
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.flush()

    access_token = auth_utils.create_access_token({"sub": str(user.id)})
    db.commit()
    db.refresh(user)

    return schemas.Token(
        access_token=access_token,
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not auth_utils.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    membership = db.query(models.RestaurantMember).filter(
        models.RestaurantMember.user_id == user.id,
        models.RestaurantMember.is_active == True,
    ).first()

    restaurant = None
    if membership:
        r = db.query(models.Restaurant).filter(models.Restaurant.id == membership.restaurant_id).first()
        if r:
            restaurant = {"id": r.id, "name": r.name, "slug": r.slug, "plan": r.plan, "role": membership.role}

    access_token = auth_utils.create_access_token({"sub": str(user.id)})
    return schemas.Token(
        access_token=access_token,
        user=schemas.UserOut.model_validate(user),
        restaurant=restaurant,
    )


@router.post("/restaurant/setup", response_model=schemas.RestaurantOut)
def setup_restaurant(
    payload: schemas.RestaurantCreate,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    base_slug = slugify(payload.name)
    slug = base_slug
    count = 1
    while db.query(models.Restaurant).filter(models.Restaurant.slug == slug).first():
        slug = f"{base_slug}-{count}"
        count += 1

    restaurant = models.Restaurant(**payload.model_dump(), slug=slug)
    db.add(restaurant)
    db.flush()

    member = models.RestaurantMember(
        restaurant_id=restaurant.id,
        user_id=current_user.id,
        role=models.UserRole.owner,
    )
    db.add(member)

    # Seed default menu categories
    default_categories = [
        models.MenuCategory(restaurant_id=restaurant.id, name="Starters", emoji="🍢", sort_order=1),
        models.MenuCategory(restaurant_id=restaurant.id, name="Main Course", emoji="🍛", sort_order=2),
        models.MenuCategory(restaurant_id=restaurant.id, name="Breads", emoji="🫓", sort_order=3),
        models.MenuCategory(restaurant_id=restaurant.id, name="Beverages", emoji="🥤", sort_order=4),
        models.MenuCategory(restaurant_id=restaurant.id, name="Desserts", emoji="🍮", sort_order=5),
    ]
    db.add_all(default_categories)

    db.commit()
    db.refresh(restaurant)
    return schemas.RestaurantOut.model_validate(restaurant)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return schemas.UserOut.model_validate(current_user)
