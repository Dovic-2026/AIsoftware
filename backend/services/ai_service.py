"""
AI Report & Query service — Rule-based (no LLM needed).
Fast, free, works offline and in cloud with zero dependencies.
"""
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import models


# ─── Data Gathering ───────────────────────────────────────────────────────────

def gather_daily_metrics(restaurant_id: int, report_date: date, db: Session) -> dict:
    orders = db.query(models.SalesOrder).filter(
        models.SalesOrder.restaurant_id == restaurant_id,
        func.date(models.SalesOrder.created_at) == report_date,
        models.SalesOrder.status == models.OrderStatus.completed,
    ).all()
    total_revenue = sum(o.total_amount for o in orders)
    total_orders = len(orders)

    yesterday = report_date - timedelta(days=1)
    y_orders = db.query(models.SalesOrder).filter(
        models.SalesOrder.restaurant_id == restaurant_id,
        func.date(models.SalesOrder.created_at) == yesterday,
        models.SalesOrder.status == models.OrderStatus.completed,
    ).all()
    y_revenue = sum(o.total_amount for o in y_orders)
    revenue_change = ((total_revenue - y_revenue) / y_revenue * 100) if y_revenue else 0

    item_counts: dict = {}
    item_revenue: dict = {}
    for order in orders:
        for item in order.items:
            item_counts[item.item_name] = item_counts.get(item.item_name, 0) + item.quantity
            item_revenue[item.item_name] = item_revenue.get(item.item_name, 0) + item.total_price
    top_items = sorted(item_counts.items(), key=lambda x: -x[1])[:5]

    payment_breakdown: dict = {}
    for o in orders:
        k = o.payment_method.value if hasattr(o.payment_method, "value") else str(o.payment_method)
        payment_breakdown[k] = payment_breakdown.get(k, 0) + o.total_amount

    expenses = db.query(models.Expense).filter(
        models.Expense.restaurant_id == restaurant_id,
        models.Expense.expense_date == report_date,
    ).all()
    total_expenses = sum(e.amount for e in expenses)

    ingredients = db.query(models.Ingredient).filter(
        models.Ingredient.restaurant_id == restaurant_id,
        models.Ingredient.is_active == True,
    ).all()
    critical_stock = [i for i in ingredients if i.current_stock < i.min_stock_level * 0.5]
    low_stock = [i for i in ingredients if i.min_stock_level * 0.5 <= i.current_stock <= i.min_stock_level]

    total_staff = db.query(models.StaffMember).filter(
        models.StaffMember.restaurant_id == restaurant_id,
        models.StaffMember.is_active == True,
    ).count()
    present_staff = db.query(models.Attendance).filter(
        models.Attendance.restaurant_id == restaurant_id,
        models.Attendance.date == report_date,
        models.Attendance.status == models.AttendanceStatus.present,
    ).count()

    restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()

    return {
        "restaurant_name": restaurant.name if restaurant else "Restaurant",
        "report_date": report_date.isoformat(),
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "avg_order_value": round(total_revenue / total_orders, 2) if total_orders else 0,
        "revenue_change_pct": round(revenue_change, 1),
        "yesterday_revenue": round(y_revenue, 2),
        "top_items": [{"name": n, "qty": q, "revenue": round(item_revenue.get(n, 0), 2)} for n, q in top_items],
        "payment_breakdown": {k: round(v, 2) for k, v in payment_breakdown.items()},
        "total_expenses": round(total_expenses, 2),
        "profit_estimate": round(total_revenue - total_expenses, 2),
        "critical_stock": [{"name": i.name, "stock": i.current_stock, "min": i.min_stock_level, "unit": i.unit} for i in critical_stock],
        "low_stock": [{"name": i.name, "stock": i.current_stock, "min": i.min_stock_level, "unit": i.unit} for i in low_stock],
        "low_stock_count": len(critical_stock) + len(low_stock),
        "staff_present": present_staff,
        "staff_total": total_staff,
    }


# ─── Rule-Based Report ────────────────────────────────────────────────────────

def generate_report_text(metrics: dict) -> str:
    m = metrics
    rev_arrow = "↑" if m["revenue_change_pct"] >= 0 else "↓"
    rev_word = "above" if m["revenue_change_pct"] >= 0 else "below"

    top_items_text = "\n".join(
        f"{i+1}. **{item['name']}** — {item['qty']} orders (₹{item['revenue']:,.0f})"
        for i, item in enumerate(m["top_items"][:3])
    ) or "No sales recorded yet."

    stock_lines = [f"- 🔴 **{i['name']}**: {i['stock']}{i['unit']} left (min {i['min']}{i['unit']})" for i in m["critical_stock"]]
    stock_lines += [f"- 🟡 **{i['name']}**: {i['stock']}{i['unit']} left" for i in m["low_stock"]]
    stock_section = "\n".join(stock_lines) if stock_lines else "✅ All ingredients well-stocked."

    payment_text = "\n".join(f"- {k.upper()}: ₹{v:,.0f}" for k, v in m["payment_breakdown"].items()) or "No payment data."

    absent = m["staff_total"] - m["staff_present"]
    staff_note = f"⚠️ {absent} staff absent." if absent > 0 else "✅ Full team present!"

    recs = []
    if m["critical_stock"]:
        recs.append("🔴 **Urgent**: Reorder critical stock before afternoon rush.")
    if m["revenue_change_pct"] > 5:
        recs.append("📈 Revenue is up — great work! Keep current offerings.")
    elif m["revenue_change_pct"] < -5:
        recs.append("📉 Revenue is down. Consider a combo offer or discount today.")
    if absent > 0:
        recs.append("👨‍🍳 Consider calling backup staff for peak hours.")
    if not recs:
        recs.append("✅ Operations running smoothly. Keep it up!")

    return f"""## Daily Report — {m['report_date']}
### {m['restaurant_name']}

---

### Revenue
Today: **₹{m['total_revenue']:,.0f}** ({rev_arrow}{abs(m['revenue_change_pct'])}% {rev_word} yesterday ₹{m['yesterday_revenue']:,.0f})
- Orders: **{m['total_orders']}** · Avg: **₹{m['avg_order_value']:,.0f}** · Profit est: **₹{m['profit_estimate']:,.0f}**

### Payment Breakdown
{payment_text}

### Top Items
{top_items_text}

### Inventory
{stock_section}

### Staff
{m['staff_present']}/{m['staff_total']} present today. {staff_note}

### Recommendations
{chr(10).join(recs)}

---
*DOVIC AI · {datetime.now().strftime('%I:%M %p')} · {m['report_date']}*"""


async def generate_whatsapp_summary(metrics: dict, restaurant_name: str = "") -> str:
    return _generate_whatsapp_summary_sync(metrics, restaurant_name)


def _generate_whatsapp_summary_sync(metrics: dict, restaurant_name: str = "") -> str:
    m = metrics
    rev_arrow = "↑" if m["revenue_change_pct"] >= 0 else "↓"
    top = m["top_items"][0]["name"] if m["top_items"] else "N/A"
    top_qty = m["top_items"][0]["qty"] if m["top_items"] else 0
    alerts = m["low_stock_count"]

    return (
        f"📊 *{m['restaurant_name']} — Daily Report*\n"
        f"*{m['report_date']}*\n\n"
        f"💰 Revenue: *₹{m['total_revenue']:,.0f}* ({rev_arrow}{abs(m['revenue_change_pct'])}%)\n"
        f"🧾 Orders: *{m['total_orders']}* | Avg: ₹{m['avg_order_value']:,.0f}\n"
        f"🍛 Top: {top} ({top_qty} orders)\n"
        f"👥 Staff: {m['staff_present']}/{m['staff_total']} present\n"
        f"{'⚠️ ' + str(alerts) + ' stock alerts!' if alerts else '✅ Stock OK'}\n\n"
        f"Reply *\"Full report\"* for details."
    )


# ─── Rule-Based Query Handler ─────────────────────────────────────────────────

def answer_query(query: str, metrics: dict, language: str = "english") -> str:
    q = query.lower()

    if any(w in q for w in ["revenue", "earning", "income", "sale", "today", "how much"]):
        return f"Today's revenue is ₹{metrics['total_revenue']:,.0f} from {metrics['total_orders']} orders. Average order value is ₹{metrics['avg_order_value']:,.0f}."

    elif any(w in q for w in ["top", "best", "popular", "selling"]):
        if metrics["top_items"]:
            items = ", ".join(f"{i['name']} ({i['qty']} orders)" for i in metrics["top_items"][:3])
            return f"Top selling items: {items}."
        return "No sales data available yet."

    elif any(w in q for w in ["stock", "inventory", "ingredient", "low", "reorder", "running out"]):
        if metrics["critical_stock"]:
            names = ", ".join(i["name"] for i in metrics["critical_stock"])
            return f"⚠️ Critical stock: {names}. Reorder immediately!"
        if metrics["low_stock"]:
            names = ", ".join(i["name"] for i in metrics["low_stock"])
            return f"Low stock warning: {names}. Consider restocking soon."
        return "✅ All stock levels are fine. No reorder needed."

    elif any(w in q for w in ["staff", "employee", "attendance", "present", "absent"]):
        absent = metrics["staff_total"] - metrics["staff_present"]
        if absent > 0:
            return f"{metrics['staff_present']}/{metrics['staff_total']} staff present. {absent} absent today."
        return f"All {metrics['staff_total']} staff are present today. ✅"

    elif any(w in q for w in ["profit", "net", "margin"]):
        return f"Estimated profit today: ₹{metrics['profit_estimate']:,.0f} (Revenue ₹{metrics['total_revenue']:,.0f} - Expenses ₹{metrics['total_expenses']:,.0f})."

    elif any(w in q for w in ["expense", "cost", "spend"]):
        return f"Today's expenses: ₹{metrics['total_expenses']:,.0f}."

    elif any(w in q for w in ["report", "summary", "overview"]):
        return (
            f"Today: Revenue ₹{metrics['total_revenue']:,.0f}, {metrics['total_orders']} orders, "
            f"₹{metrics['profit_estimate']:,.0f} profit. "
            f"Staff {metrics['staff_present']}/{metrics['staff_total']}. "
            f"Stock alerts: {metrics['low_stock_count']}."
        )

    else:
        return (
            f"Today at {metrics['restaurant_name']}: Revenue ₹{metrics['total_revenue']:,.0f} · "
            f"{metrics['total_orders']} orders · Staff {metrics['staff_present']}/{metrics['staff_total']}. "
            f"Ask about revenue, top items, stock, staff, expenses, or profit."
        )


async def try_llm_query(query: str, metrics: dict):
    """No LLM configured — always returns None so rule-based answer is used."""
    return None
