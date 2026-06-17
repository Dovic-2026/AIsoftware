from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/restaurants/{restaurant_id}/inventory", tags=["Inventory"])


@router.get("/ingredients", response_model=List[schemas.IngredientOut])
def list_ingredients(
    restaurant_id: int,
    q: Optional[str] = None,
    low_stock_only: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(models.Ingredient).filter(
        models.Ingredient.restaurant_id == restaurant_id,
        models.Ingredient.is_active == True,
    )
    if q:
        query = query.filter(models.Ingredient.name.ilike(f"%{q}%"))
    items = query.order_by(models.Ingredient.name).all()
    if low_stock_only:
        items = [i for i in items if i.current_stock <= i.min_stock_level]
    return items


@router.post("/ingredients", response_model=schemas.IngredientOut, status_code=201)
def create_ingredient(
    restaurant_id: int, payload: schemas.IngredientCreate,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    ingredient = models.Ingredient(**payload.model_dump(), restaurant_id=restaurant_id)
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return ingredient


@router.put("/ingredients/{ingredient_id}", response_model=schemas.IngredientOut)
def update_ingredient(
    restaurant_id: int, ingredient_id: int, payload: schemas.IngredientUpdate,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    item = db.query(models.Ingredient).filter(
        models.Ingredient.id == ingredient_id,
        models.Ingredient.restaurant_id == restaurant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/ingredients/{ingredient_id}", status_code=204)
def delete_ingredient(
    restaurant_id: int, ingredient_id: int,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    item = db.query(models.Ingredient).filter(
        models.Ingredient.id == ingredient_id,
        models.Ingredient.restaurant_id == restaurant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    item.is_active = False
    db.commit()


@router.post("/transactions", response_model=schemas.InventoryTransactionOut, status_code=201)
def record_transaction(
    restaurant_id: int, payload: schemas.InventoryTransactionCreate,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    ingredient = db.query(models.Ingredient).filter(
        models.Ingredient.id == payload.ingredient_id,
        models.Ingredient.restaurant_id == restaurant_id,
    ).first()
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    txn = models.InventoryTransaction(
        **payload.model_dump(),
        restaurant_id=restaurant_id,
        recorded_by=current_user.id,
    )
    db.add(txn)

    if payload.transaction_type == models.TransactionType.restock:
        ingredient.current_stock += payload.quantity
    elif payload.transaction_type in (models.TransactionType.usage, models.TransactionType.wastage):
        ingredient.current_stock = max(0, ingredient.current_stock - payload.quantity)

    db.commit()
    db.refresh(txn)
    return txn


@router.get("/transactions", response_model=List[schemas.InventoryTransactionOut])
def list_transactions(
    restaurant_id: int,
    ingredient_id: Optional[int] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(models.InventoryTransaction).filter(
        models.InventoryTransaction.restaurant_id == restaurant_id,
    )
    if ingredient_id:
        query = query.filter(models.InventoryTransaction.ingredient_id == ingredient_id)
    return query.order_by(desc(models.InventoryTransaction.created_at)).limit(limit).all()


@router.get("/alerts")
def get_low_stock_alerts(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items = db.query(models.Ingredient).filter(
        models.Ingredient.restaurant_id == restaurant_id,
        models.Ingredient.is_active == True,
    ).all()
    critical = [i for i in items if i.current_stock < i.min_stock_level * 0.5]
    low = [i for i in items if i.min_stock_level * 0.5 <= i.current_stock <= i.min_stock_level]
    return {
        "critical": [{"id": i.id, "name": i.name, "stock": i.current_stock, "min": i.min_stock_level, "unit": i.unit} for i in critical],
        "low": [{"id": i.id, "name": i.name, "stock": i.current_stock, "min": i.min_stock_level, "unit": i.unit} for i in low],
        "total_low": len(critical) + len(low),
    }
