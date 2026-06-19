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
    total = subtotal - payload.discount

    order = models.SalesOrder(
        restaurant_id=restaurant_id,
        order_number=generate_order_number(db, restaurant_id),
        table_number=payload.table_number,
        order_type=payload.order_type,
        payment_method=payload.payment_method,
        discount=payload.discount,
        notes=payload.notes,
        subtotal=subtotal,
        tax=0,
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


@router.delete("/orders/{order_id}")
def delete_order(
    restaurant_id: int, order_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    order = db.query(models.SalesOrder).filter(
        models.SalesOrder.id == order_id,
        models.SalesOrder.restaurant_id == restaurant_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Snapshot order before deletion
    log = models.OrderDeletionLog(
        restaurant_id=restaurant_id,
        order_id=order.id,
        order_number=order.order_number,
        order_total=order.total_amount,
        order_items=[{"name": i.item_name, "qty": i.quantity, "price": i.unit_price} for i in order.items],
        payment_method=str(order.payment_method.value) if hasattr(order.payment_method, "value") else str(order.payment_method),
        table_number=order.table_number,
        reason=reason or "No reason given",
        deleted_by_id=current_user.id,
        deleted_by_name=current_user.full_name,
        original_created_at=order.created_at,
    )
    db.add(log)
    db.query(models.SalesOrderItem).filter(models.SalesOrderItem.order_id == order_id).delete()
    db.delete(order)
    db.commit()
    return {"success": True, "log_id": log.id}


@router.get("/deletion-log")
def get_deletion_log(
    restaurant_id: int,
    log_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(models.OrderDeletionLog).filter(
        models.OrderDeletionLog.restaurant_id == restaurant_id
    )
    target = log_date or date.today()
    q = q.filter(func.date(models.OrderDeletionLog.deleted_at) == target)
    logs = q.order_by(models.OrderDeletionLog.deleted_at.desc()).all()
    return [
        {
            "id": l.id,
            "order_number": l.order_number,
            "order_total": l.order_total,
            "order_items": l.order_items,
            "payment_method": l.payment_method,
            "table_number": l.table_number,
            "reason": l.reason,
            "deleted_by": l.deleted_by_name,
            "deleted_at": l.deleted_at.isoformat() if l.deleted_at else None,
            "original_created_at": l.original_created_at.isoformat() if l.original_created_at else None,
        }
        for l in logs
    ]


@router.get("/deletion-log/pdf")
def download_deletion_log_pdf(
    restaurant_id: int,
    log_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    import io

    target = log_date or date.today()
    q = db.query(models.OrderDeletionLog).filter(
        models.OrderDeletionLog.restaurant_id == restaurant_id,
        func.date(models.OrderDeletionLog.deleted_at) == target,
    ).order_by(models.OrderDeletionLog.deleted_at.desc()).all()

    restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm, leftMargin=1.5*cm, rightMargin=1.5*cm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=16, textColor=colors.HexColor("#128C7E"), spaceAfter=4)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=12)

    story.append(Paragraph(f"Order Deletion Log", title_style))
    story.append(Paragraph(f"{restaurant.name if restaurant else ''} · {target.strftime('%d %B %Y')}", sub_style))
    story.append(Spacer(1, 0.3*cm))

    if not q:
        story.append(Paragraph("No deleted orders for this date.", styles["Normal"]))
    else:
        total_deleted = sum(l.order_total for l in q)
        story.append(Paragraph(f"Total deleted orders: <b>{len(q)}</b> · Total value: <b>₹{total_deleted:,.2f}</b>", styles["Normal"]))
        story.append(Spacer(1, 0.4*cm))

        headers = ["Order No.", "Items", "Amount", "Payment", "Table", "Deleted By", "Reason", "Time"]
        data = [headers]
        for l in q:
            items_str = ", ".join([f"{i['name']} x{i['qty']}" for i in (l.order_items or [])]) or "-"
            t = l.deleted_at.strftime("%H:%M") if l.deleted_at else "-"
            data.append([
                l.order_number, items_str[:40], f"Rs.{l.order_total:.0f}",
                (l.payment_method or "-").upper(), l.table_number or "-",
                l.deleted_by_name or "-", l.reason or "-", t,
            ])

        col_widths = [2.5*cm, 4.5*cm, 1.8*cm, 1.8*cm, 1.5*cm, 2.5*cm, 3*cm, 1.4*cm]
        tbl = Table(data, colWidths=col_widths, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#128C7E")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FEF2F2")]),
        ]))
        story.append(tbl)

    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%d %b %Y %H:%M')} · DOVIC AI Restaurant OS", sub_style))

    doc.build(story)
    buf.seek(0)
    filename = f"deletion_log_{target.isoformat()}.pdf"
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})


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
