from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import date, datetime, timedelta
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/restaurants/{restaurant_id}/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    today = date.today()

    # Today revenue & orders
    today_orders = db.query(models.SalesOrder).filter(
        models.SalesOrder.restaurant_id == restaurant_id,
        func.date(models.SalesOrder.created_at) == today,
        models.SalesOrder.status == models.OrderStatus.completed,
    ).all()
    today_revenue = sum(o.total_amount for o in today_orders)
    today_order_count = len(today_orders)
    avg_order = today_revenue / today_order_count if today_order_count else 0

    # Monthly revenue
    month_start = today.replace(day=1)
    monthly_revenue = db.query(func.sum(models.SalesOrder.total_amount)).filter(
        models.SalesOrder.restaurant_id == restaurant_id,
        func.date(models.SalesOrder.created_at) >= month_start,
        models.SalesOrder.status == models.OrderStatus.completed,
    ).scalar() or 0

    # Monthly expenses
    monthly_expenses = db.query(func.sum(models.Expense.amount)).filter(
        models.Expense.restaurant_id == restaurant_id,
        models.Expense.expense_date >= month_start,
    ).scalar() or 0

    # Low stock
    ingredients = db.query(models.Ingredient).filter(
        models.Ingredient.restaurant_id == restaurant_id,
        models.Ingredient.is_active == True,
    ).all()
    low_stock_items = [
        {"id": i.id, "name": i.name, "stock": i.current_stock, "min": i.min_stock_level, "unit": i.unit,
         "level": "critical" if i.current_stock < i.min_stock_level * 0.5 else "low"}
        for i in ingredients if i.current_stock <= i.min_stock_level
    ]

    # Staff
    total_staff = db.query(models.StaffMember).filter(
        models.StaffMember.restaurant_id == restaurant_id,
        models.StaffMember.is_active == True,
    ).count()
    present_staff = db.query(models.Attendance).filter(
        models.Attendance.restaurant_id == restaurant_id,
        models.Attendance.date == today,
        models.Attendance.status == models.AttendanceStatus.present,
    ).count()

    # Top items (last 7 days)
    top_items = (
        db.query(
            models.SalesOrderItem.item_name,
            func.sum(models.SalesOrderItem.quantity).label("qty"),
            func.sum(models.SalesOrderItem.total_price).label("revenue"),
        )
        .join(models.SalesOrder)
        .filter(
            models.SalesOrder.restaurant_id == restaurant_id,
            models.SalesOrder.created_at >= datetime.now() - timedelta(days=7),
        )
        .group_by(models.SalesOrderItem.item_name)
        .order_by(desc("qty"))
        .limit(5)
        .all()
    )

    # Revenue chart (7 days)
    revenue_chart = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        rev = db.query(func.sum(models.SalesOrder.total_amount)).filter(
            models.SalesOrder.restaurant_id == restaurant_id,
            func.date(models.SalesOrder.created_at) == d,
            models.SalesOrder.status == models.OrderStatus.completed,
        ).scalar() or 0
        revenue_chart.append({"date": d.isoformat(), "day": d.strftime("%a"), "revenue": round(float(rev), 2)})

    # Expense breakdown (this month)
    exp_cats = db.query(
        models.Expense.category,
        func.sum(models.Expense.amount).label("total"),
    ).filter(
        models.Expense.restaurant_id == restaurant_id,
        models.Expense.expense_date >= month_start,
    ).group_by(models.Expense.category).all()
    expense_breakdown = [{"category": r.category, "amount": round(float(r.total), 2)} for r in exp_cats]

    # Recent orders
    recent = db.query(models.SalesOrder).filter(
        models.SalesOrder.restaurant_id == restaurant_id,
    ).order_by(desc(models.SalesOrder.created_at)).limit(5).all()
    recent_orders = [
        {
            "id": o.id, "order_number": o.order_number, "total_amount": o.total_amount,
            "payment_method": o.payment_method.value if hasattr(o.payment_method, "value") else str(o.payment_method),
            "table_number": o.table_number, "status": o.status.value,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in recent
    ]

    # Supplier dues
    supplier_dues = db.query(models.Supplier).filter(
        models.Supplier.restaurant_id == restaurant_id,
        models.Supplier.outstanding_balance > 0,
        models.Supplier.is_active == True,
    ).order_by(desc(models.Supplier.outstanding_balance)).limit(5).all()

    return schemas.DashboardStats(
        today_revenue=round(float(today_revenue), 2),
        today_orders=today_order_count,
        avg_order_value=round(float(avg_order), 2),
        low_stock_count=len(low_stock_items),
        staff_present=present_staff,
        staff_total=total_staff,
        monthly_revenue=round(float(monthly_revenue), 2),
        monthly_expenses=round(float(monthly_expenses), 2),
        top_items=[{"name": r.item_name, "quantity": int(r.qty), "revenue": round(float(r.revenue), 2)} for r in top_items],
        revenue_chart=revenue_chart,
        expense_breakdown=expense_breakdown,
        recent_orders=recent_orders,
        low_stock_items=low_stock_items,
        supplier_dues=[{"name": s.company_name, "balance": s.outstanding_balance, "phone": s.phone} for s in supplier_dues],
    )
