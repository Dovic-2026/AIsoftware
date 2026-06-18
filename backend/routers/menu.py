from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_user
import aiofiles, os, uuid

router = APIRouter(prefix="/restaurants/{restaurant_id}/menu", tags=["Menu"])

UPLOAD_DIR = "uploads/menu"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_restaurant_or_404(restaurant_id: int, db: Session) -> models.Restaurant:
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return r


# ─── Categories ──────────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[schemas.MenuCategoryOut])
def list_categories(restaurant_id: int, db: Session = Depends(get_db),
                    current_user=Depends(get_current_user)):
    return db.query(models.MenuCategory).filter(
        models.MenuCategory.restaurant_id == restaurant_id,
        models.MenuCategory.is_active == True,
    ).order_by(models.MenuCategory.sort_order).all()


@router.post("/categories", response_model=schemas.MenuCategoryOut, status_code=201)
def create_category(restaurant_id: int, payload: schemas.MenuCategoryCreate,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    get_restaurant_or_404(restaurant_id, db)
    cat = models.MenuCategory(**payload.model_dump(), restaurant_id=restaurant_id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categories/{category_id}", response_model=schemas.MenuCategoryOut)
def update_category(restaurant_id: int, category_id: int, payload: schemas.MenuCategoryCreate,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cat = db.query(models.MenuCategory).filter(
        models.MenuCategory.id == category_id,
        models.MenuCategory.restaurant_id == restaurant_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(restaurant_id: int, category_id: int,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cat = db.query(models.MenuCategory).filter(
        models.MenuCategory.id == category_id,
        models.MenuCategory.restaurant_id == restaurant_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = False
    db.commit()


# ─── Items ───────────────────────────────────────────────────────────────────

@router.get("/items", response_model=List[schemas.MenuItemOut])
def list_items(
    restaurant_id: int,
    category_id: Optional[int] = None,
    is_available: Optional[bool] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(models.MenuItem).filter(models.MenuItem.restaurant_id == restaurant_id)
    if category_id:
        query = query.filter(models.MenuItem.category_id == category_id)
    if is_available is not None:
        query = query.filter(models.MenuItem.is_available == is_available)
    if q:
        query = query.filter(models.MenuItem.name.ilike(f"%{q}%"))
    return query.order_by(models.MenuItem.sort_order, models.MenuItem.name).all()


@router.post("/items", response_model=schemas.MenuItemOut, status_code=201)
def create_item(restaurant_id: int, payload: schemas.MenuItemCreate,
                db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    get_restaurant_or_404(restaurant_id, db)
    item = models.MenuItem(**payload.model_dump(), restaurant_id=restaurant_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/items/{item_id}", response_model=schemas.MenuItemOut)
def get_item(restaurant_id: int, item_id: int, db: Session = Depends(get_db),
             current_user=Depends(get_current_user)):
    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id,
        models.MenuItem.restaurant_id == restaurant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/items/{item_id}", response_model=schemas.MenuItemOut)
def update_item(restaurant_id: int, item_id: int, payload: schemas.MenuItemUpdate,
                db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id,
        models.MenuItem.restaurant_id == restaurant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}/toggle", response_model=schemas.MenuItemOut)
def toggle_availability(restaurant_id: int, item_id: int,
                        db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id,
        models.MenuItem.restaurant_id == restaurant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_available = not item.is_available
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(restaurant_id: int, item_id: int,
                db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id,
        models.MenuItem.restaurant_id == restaurant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


@router.post("/items/{item_id}/image")
async def upload_item_image(restaurant_id: int, item_id: int, file: UploadFile = File(...),
                            db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from config import settings
    item = db.query(models.MenuItem).filter(
        models.MenuItem.id == item_id,
        models.MenuItem.restaurant_id == restaurant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    content = await file.read()
    ext = (file.filename or "jpg").split(".")[-1].lower()
    filename = f"restaurant_{restaurant_id}/{uuid.uuid4()}.{ext}"

    # Use Supabase Storage if configured, else local filesystem
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        import httpx
        upload_url = f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}/{filename}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                upload_url,
                content=content,
                headers={
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": file.content_type or "image/jpeg",
                    "x-upsert": "true",
                },
            )
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=500, detail=f"Storage upload failed: {resp.text}")
        image_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{settings.SUPABASE_STORAGE_BUCKET}/{filename}"
    else:
        # Fallback: local filesystem
        local_path = f"{UPLOAD_DIR}/{uuid.uuid4()}.{ext}"
        async with aiofiles.open(local_path, "wb") as f:
            await f.write(content)
        image_url = f"/uploads/menu/{local_path.split('/')[-1]}"

    item.image_url = image_url
    db.commit()
    return {"image_url": image_url}
