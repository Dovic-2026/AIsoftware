from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import date, datetime, timedelta
from database import get_db
import models, schemas
from auth import get_current_user
import aiofiles, os, uuid

router = APIRouter(prefix="/restaurants/{restaurant_id}/expenses", tags=["Expenses"])
UPLOAD_DIR = "uploads/receipts"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/", response_model=schemas.ExpenseOut, status_code=201)
def create_expense(
    restaurant_id: int, payload: schemas.ExpenseCreate,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    expense = models.Expense(**payload.model_dump(), restaurant_id=restaurant_id, recorded_by=current_user.id)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/", response_model=List[schemas.ExpenseOut])
def list_expenses(
    restaurant_id: int,
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(models.Expense).filter(models.Expense.restaurant_id == restaurant_id)
    if category:
        query = query.filter(models.Expense.category == category)
    if start_date:
        query = query.filter(models.Expense.expense_date >= start_date)
    if end_date:
        query = query.filter(models.Expense.expense_date <= end_date)
    return query.order_by(desc(models.Expense.expense_date)).limit(limit).all()


@router.put("/{expense_id}", response_model=schemas.ExpenseOut)
def update_expense(
    restaurant_id: int, expense_id: int, payload: schemas.ExpenseCreate,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    exp = db.query(models.Expense).filter(
        models.Expense.id == expense_id, models.Expense.restaurant_id == restaurant_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(exp, k, v)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    restaurant_id: int, expense_id: int,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    exp = db.query(models.Expense).filter(
        models.Expense.id == expense_id, models.Expense.restaurant_id == restaurant_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()


@router.get("/summary")
def expense_summary(
    restaurant_id: int,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    now = datetime.now()
    m = month or now.month
    y = year or now.year
    start = date(y, m, 1)
    if m == 12:
        end = date(y + 1, 1, 1)
    else:
        end = date(y, m + 1, 1)

    expenses = db.query(models.Expense).filter(
        models.Expense.restaurant_id == restaurant_id,
        models.Expense.expense_date >= start,
        models.Expense.expense_date < end,
    ).all()

    total = sum(e.amount for e in expenses)
    by_category = {}
    for e in expenses:
        by_category[e.category] = by_category.get(e.category, 0) + e.amount

    return {
        "month": m, "year": y,
        "total": round(total, 2),
        "by_category": {k: round(v, 2) for k, v in sorted(by_category.items(), key=lambda x: -x[1])},
    }


@router.post("/{expense_id}/receipt")
async def upload_receipt(
    restaurant_id: int, expense_id: int, file: UploadFile = File(...),
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    exp = db.query(models.Expense).filter(
        models.Expense.id == expense_id, models.Expense.restaurant_id == restaurant_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    path = f"{UPLOAD_DIR}/{filename}"
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    exp.receipt_url = f"/uploads/receipts/{filename}"
    db.commit()
    return {"receipt_url": exp.receipt_url}
