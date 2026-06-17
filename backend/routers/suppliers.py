from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/restaurants/{restaurant_id}/suppliers", tags=["Suppliers"])


@router.get("/", response_model=List[schemas.SupplierOut])
def list_suppliers(restaurant_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Supplier).filter(
        models.Supplier.restaurant_id == restaurant_id,
        models.Supplier.is_active == True,
    ).order_by(models.Supplier.name).all()


@router.post("/", response_model=schemas.SupplierOut, status_code=201)
def create_supplier(restaurant_id: int, payload: schemas.SupplierCreate,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    supplier = models.Supplier(**payload.model_dump(), restaurant_id=restaurant_id)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/{supplier_id}", response_model=schemas.SupplierOut)
def get_supplier(restaurant_id: int, supplier_id: int,
                 db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    s = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id, models.Supplier.restaurant_id == restaurant_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return s


@router.put("/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(restaurant_id: int, supplier_id: int, payload: schemas.SupplierUpdate,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    s = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id, models.Supplier.restaurant_id == restaurant_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(restaurant_id: int, supplier_id: int,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    s = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id, models.Supplier.restaurant_id == restaurant_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    s.is_active = False
    db.commit()


@router.post("/{supplier_id}/payment")
def record_payment(restaurant_id: int, supplier_id: int, amount: float,
                   db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    s = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id, models.Supplier.restaurant_id == restaurant_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    s.outstanding_balance = max(0, s.outstanding_balance - amount)
    db.commit()
    return {"outstanding_balance": s.outstanding_balance, "paid": amount}
