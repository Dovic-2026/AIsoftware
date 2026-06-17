from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import date, datetime, timedelta
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/restaurants/{restaurant_id}/sales", tags=["Sales"])


def generate_order_number(db: Session, restaurant_id: int) -> str:
    today = date.today()
    prefix = today.strftime("%Y%m%d")
    count = db.query(models.SalesOrder).filter(
        models.SalesOrder.restaurant_id == restaurant_id,
        func.date(models.SalesOrder.created_at) == today,
    ).count()
    return f"ORD-{prefix}-{count + 1:03d}"


@router.post("/orders", response_model=schemas.SalesOrderOut, status_code=201)
def create_order(
    restaurant_id: int,
    payload: schemas.SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    subtotal = sum(item.quantity * item.unit_price for item in payload.items)
    tax = round(subtotal * 0.05, 2)
    total = subtotal + tax - payload.discount

    order = models.SalesOrder(
        restaurant_id=restaurant_id,
        order_number=generate_order_number(db, restaurant_id),
        table_number=payload.table_number,
        order_type=payload.order_type,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        payment_method=payload.payment_method,
        discount=payload.discount,
        notes=payload.notes,
        subtotal=subtotal,
        tax=tax,
        total_amount=total,
        status=models.OrderStatus.completed,
        recorded_by=current_user.id,
    )
    db.add(order)
    db.flush()

    for item_data in payload.items:
        order_item = models.SalesOrderItem(
            order_id=order.id,
            menu_item_id=item_data.menu_item_id,
            item_name=item_data.item_name,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            total_price=item_data.quantity * item_data.unit_price,
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=List[schemas.SalesOrderOut])
def list_orders(
    restaurant_id: int,
    period: str = Query("today", regex="^(today|week|month|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    payment_method: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(models.SalesOrder).filter(
        models.SalesOrder.restaurant_id == restaurant_id
    )

    today = date.today()
    if period == "today":
        query = query.filter(func.date(models.SalesOrder.created_at) == today)
    elif period == "week":
        query = query.filter(models.SalesOrder.created_at >= datetime.now() - timedelta(days=7))
    elif period == "month":
        query = query.filter(models.SalesOrder.created_at >= datetime.now() - timedelta(days=30))
    elif period == "custom" and start_date and end_date:
        query = query.filter(
            func.date(models.SalesOrder.created_at) >= start_date,
            func.date(models.SalesOrder.created_at) <= end_date,
        )

    if payment_method:
        query = query.filter(models.SalesOrder.payment_method == payment_method)

    return query.order_by(desc(models.SalesOrder.created_at)).offset(offset).limit(limit).all()


@router.get("/orders/{order_id}", response_model=schemas.SalesOrderOut)
def get_order(
    restaurant_id: int, order_id: int,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    order = db.query(models.SalesOrder).filter(
        models.SalesOrder.id == order_id,
        models.SalesOrder.restaurant_id == restaurant_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/summary")
def sales_summary(
    restaurant_id: int,
    period: str = "today",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    today = date.today()
    base = db.query(models.SalesOrder).filter(
        models.SalesOrder.restaurant_id == restaurant_id,
        models.SalesOrder.status == models.OrderStatus.completed,
    )

    if period == "today":
        q = base.filter(func.date(models.SalesOrder.created_at) == today)
    elif period == "week":
        q = base.filter(models.SalesOrder.created_at >= datetime.now() - timedelta(days=7))
    else:
        q = base.filter(models.SalesOrder.created_at >= datetime.now() - timedelta(days=30))

    orders = q.all()
    total_revenue = sum(o.total_amount for o in orders)
    total_orders = len(orders)
    avg_order = total_revenue / total_orders if total_orders else 0

    payment_breakdown = {}
    for o in orders:
        payment_breakdown[o.payment_method] = payment_breakdown.get(o.payment_method, 0) + o.total_amount

    return {
        "period": period,
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "avg_order_value": round(avg_order, 2),
        "payment_breakdown": {k.value if hasattr(k, "value") else k: round(v, 2) for k, v in payment_breakdown.items()},
    }


@router.get("/top-items")
def top_items(
    restaurant_id: int,
    limit: int = 10,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    since = datetime.now() - timedelta(days=days)
    items = (
        db.query(
            models.SalesOrderItem.item_name,
            func.sum(models.SalesOrderItem.quantity).label("total_qty"),
            func.sum(models.SalesOrderItem.total_price).label("total_revenue"),
        )
        .join(models.SalesOrder)
        .filter(
            models.SalesOrder.restaurant_id == restaurant_id,
            models.SalesOrder.created_at >= since,
        )
        .group_by(models.SalesOrderItem.item_name)
        .order_by(desc("total_qty"))
        .limit(limit)
        .all()
    )
    return [{"name": i.item_name, "quantity": int(i.total_qty), "revenue": round(float(i.total_revenue), 2)} for i in items]


@router.get("/revenue-chart")
def revenue_chart(
    restaurant_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = []
    for i in range(days - 1, -1, -1):
        d = date.today() - timedelta(days=i)
        total = db.query(func.sum(models.SalesOrder.total_amount)).filter(
            models.SalesOrder.restaurant_id == restaurant_id,
            func.date(models.SalesOrder.created_at) == d,
            models.SalesOrder.status == models.OrderStatus.completed,
        ).scalar() or 0
        result.append({"date": d.isoformat(), "revenue": round(float(total), 2)})
    return result
