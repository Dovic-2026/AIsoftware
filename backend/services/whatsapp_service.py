"""
WhatsApp message handler — supports both Twilio and Meta Cloud API.
Processes incoming messages and routes to the appropriate handler.
"""
import re
from datetime import date, datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
import models
from config import settings
import httpx


# ─── Message Sending ──────────────────────────────────────────────────────────

async def send_whatsapp_message(to_number: str, message: str) -> bool:
    """Send a WhatsApp message via Twilio or Meta API."""
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        return await _send_via_twilio(to_number, message)
    elif settings.META_WA_TOKEN and settings.META_WA_PHONE_ID:
        return await _send_via_meta(to_number, message)
    else:
        print(f"[WA MOCK] To: {to_number}\n{message}\n---")
        return True


async def _send_via_twilio(to_number: str, message: str) -> bool:
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    to = f"whatsapp:+{to_number.lstrip('+')}" if not to_number.startswith("whatsapp:") else to_number
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            data={"From": settings.TWILIO_WHATSAPP_FROM, "To": to, "Body": message},
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
        )
        return resp.status_code in (200, 201)


async def _send_via_meta(to_number: str, message: str) -> bool:
    url = f"https://graph.facebook.com/v20.0/{settings.META_WA_PHONE_ID}/messages"
    clean_number = to_number.replace("+", "").replace(" ", "")
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_number,
        "type": "text",
        "text": {"preview_url": False, "body": message},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {settings.META_WA_TOKEN}"},
        )
        return resp.status_code == 200


# ─── Session Management ───────────────────────────────────────────────────────

def get_or_create_session(phone: str, db: Session) -> models.WhatsAppSession:
    session = db.query(models.WhatsAppSession).filter(
        models.WhatsAppSession.phone_number == phone
    ).first()
    if not session:
        session = models.WhatsAppSession(phone_number=phone, state="idle", context={})
        db.add(session)
        db.commit()
        db.refresh(session)
    return session


def get_session_restaurant(session: models.WhatsAppSession, db: Session) -> Optional[models.Restaurant]:
    if not session.restaurant_id:
        return None
    return db.query(models.Restaurant).filter(models.Restaurant.id == session.restaurant_id).first()


# ─── Message Parser ───────────────────────────────────────────────────────────

def parse_sale_message(text: str) -> Optional[dict]:
    """Parse: 'Sale: 2 Chicken Biryani, 1 Lassi, ₹480, UPI, Table 3'"""
    text = text.strip()
    if not re.match(r'^sale[:\s]', text, re.IGNORECASE):
        return None

    body = re.sub(r'^sale[:\s]*', '', text, flags=re.IGNORECASE)

    amount_match = re.search(r'₹?\s*(\d+(?:\.\d+)?)', body)
    amount = float(amount_match.group(1)) if amount_match else 0

    payment = "cash"
    for pm in ["upi", "cash", "card", "online"]:
        if pm in body.lower():
            payment = pm
            break

    table_match = re.search(r'\b[Tt](?:able\s*)?(\w+)\b', body)
    table = table_match.group(1) if table_match else None

    return {
        "amount": amount,
        "payment_method": payment,
        "table_number": table,
        "raw": body,
        "items": [],
    }


def parse_expense_message(text: str) -> Optional[dict]:
    """Parse: 'Expense: Vegetables from Fresh Farms ₹3200'"""
    if not re.match(r'^expense[:\s]', text, re.IGNORECASE):
        return None
    body = re.sub(r'^expense[:\s]*', '', text, flags=re.IGNORECASE)
    amount_match = re.search(r'₹?\s*(\d+(?:\.\d+)?)', body)
    amount = float(amount_match.group(1)) if amount_match else 0
    desc = re.sub(r'₹?\s*\d+(?:\.\d+)?', '', body).strip().rstrip(',')
    return {"description": desc, "amount": amount, "category": "Raw Materials"}


def parse_restock_message(text: str) -> Optional[dict]:
    """Parse: 'Restock: Chicken 10kg' or 'Stock in: Rice 20kg'"""
    if not re.match(r'^(restock|stock\s*in)[:\s]', text, re.IGNORECASE):
        return None
    body = re.sub(r'^(restock|stock\s*in)[:\s]*', '', text, flags=re.IGNORECASE)
    qty_match = re.search(r'(\d+(?:\.\d+)?)\s*(kg|g|L|ml|pcs|dozen)?', body, re.IGNORECASE)
    qty = float(qty_match.group(1)) if qty_match else 0
    unit = qty_match.group(2) if qty_match and qty_match.group(2) else "kg"
    name = re.sub(r'\d+(?:\.\d+)?\s*(kg|g|L|ml|pcs|dozen)?', '', body, flags=re.IGNORECASE).strip().rstrip(',').strip()
    return {"ingredient_name": name, "quantity": qty, "unit": unit}


# ─── Command Router ───────────────────────────────────────────────────────────

async def handle_incoming_message(
    phone: str,
    message_text: str,
    db: Session,
) -> str:
    """Main entry point — returns the response text."""
    session = get_or_create_session(phone, db)
    restaurant = get_session_restaurant(session, db)
    text = message_text.strip()
    lower = text.lower()

    # ── Registration flow ─────────────────────────────────────────────────────
    if not restaurant:
        # Auto-link if the user registered via web app — match by phone number
        clean_phone = phone.lstrip("+")
        linked = (
            db.query(models.Restaurant).filter(models.Restaurant.phone.ilike(f"%{clean_phone[-10:]}%")).first()
        )
        if linked:
            session.restaurant_id = linked.id
            db.commit()
            restaurant = linked
        else:
            return await _handle_onboarding(phone, text, lower, session, db)

    # ── Commands ──────────────────────────────────────────────────────────────

    if lower in ("hi", "hello", "helo", "hey", "start"):
        return _welcome_message(restaurant)

    if lower in ("help", "commands", "menu"):
        return _help_message()

    if re.match(r"^(today|report|daily report|today's report|full report)", lower):
        if not _is_owner(phone, restaurant, db):
            return "⛔ Daily reports are only available to the restaurant owner."
        return await _handle_report(restaurant, db)

    if re.match(r"^(stock|stock check|inventory|low stock)", lower):
        return _handle_stock_check(restaurant, db)

    if re.match(r"^(present|i am here|i'm present|attendance|here today)", lower):
        return await _handle_attendance(phone, restaurant, db)

    if re.match(r"^(top|best|popular|top items|bestsell)", lower):
        return _handle_top_items(restaurant, db)

    if re.match(r"^(dues|supplier|pending payment|supplier dues)", lower):
        return _handle_supplier_dues(restaurant, db)

    if re.match(r"^(sale[:\s])", lower):
        return await _handle_sale(text, restaurant, db, session)

    if re.match(r"^(expense[:\s])", lower):
        return await _handle_expense(text, restaurant, db)

    if re.match(r"^(restock|stock in)[:\s]", lower):
        return await _handle_restock(text, restaurant, db)

    if re.match(r"^(summary|today summary)", lower):
        if not _is_owner(phone, restaurant, db):
            return "⛔ Daily reports are only available to the restaurant owner."
        return await _handle_report(restaurant, db)

    # ── AI Fallback ───────────────────────────────────────────────────────────
    return await _handle_ai_query(text, restaurant, db)


async def _handle_onboarding(phone: str, text: str, lower: str, session: models.WhatsAppSession, db: Session) -> str:
    import re as _re
    from auth import hash_password, create_access_token
    ctx = session.context or {}

    # ── Step 0: Greeting ──────────────────────────────────────────────────────
    if lower in ("hi", "hello", "hey", "start", "link"):
        # Check if already linked
        existing = db.query(models.WhatsAppSession).filter(
            models.WhatsAppSession.phone_number == phone,
            models.WhatsAppSession.restaurant_id != None
        ).first()
        if existing and existing.restaurant_id:
            restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == existing.restaurant_id).first()
            if restaurant:
                session.restaurant_id = existing.restaurant_id
                session.state = "idle"
                db.commit()
                return f"✅ *Already linked to {restaurant.name}!*\n\nType *'Help'* to see all commands 🚀"

        session.state = "reg_name"
        session.context = {}
        db.commit()
        return (
            "👋 *Welcome to DOVIC AI Restaurant OS!* 🍽️\n\n"
            "Let me set up your restaurant in just 4 quick steps — right here on WhatsApp!\n\n"
            "━━━━━━━━━━━━━━━\n"
            "👤 *Step 1 of 4*\n"
            "What is your *full name*?"
        )

    # ── Step 1: Full Name ─────────────────────────────────────────────────────
    if session.state == "reg_name":
        if len(text.strip()) < 2:
            return "Please enter your full name (at least 2 characters)."
        ctx["full_name"] = text.strip()
        ctx["email"] = f"{phone.lstrip('+')}@wa.dovic.ai"  # auto-generate email from phone
        session.state = "reg_restaurant_name"
        session.context = ctx
        db.commit()
        return (
            f"Nice to meet you, *{ctx['full_name']}*! 👋\n\n"
            "━━━━━━━━━━━━━━━\n"
            "🏪 *Step 2 of 3*\n"
            "What is your *restaurant name*?\n\n"
            "_e.g. Raj's Biryani House, Annapoorna Cafe_"
        )

    # ── Step 2: Password ──────────────────────────────────────────────────────
    if session.state == "reg_password":
        if len(text.strip()) < 6:
            return "❌ Password must be at least 6 characters. Try again:"
        ctx["password"] = text.strip()
        session.state = "reg_restaurant_name"
        session.context = ctx
        db.commit()
        return (
            "━━━━━━━━━━━━━━━\n"
            "🏪 *Step 3 of 3*\n"
            "What is your *restaurant name*?\n\n"
            "_e.g. Raj's Biryani House, Annapoorna Cafe_"
        )

    # ── Step 4: Restaurant Name → Auto Register ───────────────────────────────
    if session.state == "reg_restaurant_name":
        if len(text.strip()) < 2:
            return "Please enter your restaurant name (at least 2 characters)."
        ctx["restaurant_name"] = text.strip()

        try:
            # Create user if new
            if ctx.get("user_id"):
                user = db.query(models.User).filter(models.User.id == ctx["user_id"]).first()
            else:
                auto_email = ctx.get("email") or f"{phone.lstrip('+').replace(' ','')}@wa.dovic.ai"
                auto_password = ctx.get("password") or phone[-6:]  # last 6 digits of phone as default password
                user = models.User(
                    email=auto_email,
                    full_name=ctx.get("full_name", "Owner"),
                    phone=phone,
                    hashed_password=hash_password(auto_password),
                    is_active=True,
                    is_verified=True,
                )
                db.add(user)
                db.flush()

            # Create restaurant
            import re as re2
            base_slug = re2.sub(r"[^\w\s-]", "", ctx["restaurant_name"].lower().strip())
            base_slug = re2.sub(r"[\s_-]+", "-", base_slug)[:50]
            slug = base_slug
            count = 1
            while db.query(models.Restaurant).filter(models.Restaurant.slug == slug).first():
                slug = f"{base_slug}-{count}"
                count += 1

            restaurant = models.Restaurant(
                name=ctx["restaurant_name"],
                slug=slug,
                phone=phone,
                plan="starter",
                whatsapp_number=phone,
            )
            db.add(restaurant)
            db.flush()

            member = models.RestaurantMember(
                restaurant_id=restaurant.id,
                user_id=user.id,
                role=models.UserRole.owner,
            )
            db.add(member)

            # Default menu categories
            for cat in [
                models.MenuCategory(restaurant_id=restaurant.id, name="Starters", emoji="🍢", sort_order=1),
                models.MenuCategory(restaurant_id=restaurant.id, name="Main Course", emoji="🍛", sort_order=2),
                models.MenuCategory(restaurant_id=restaurant.id, name="Beverages", emoji="🥤", sort_order=3),
                models.MenuCategory(restaurant_id=restaurant.id, name="Desserts", emoji="🍮", sort_order=4),
            ]:
                db.add(cat)

            session.restaurant_id = restaurant.id
            session.state = "idle"
            session.context = {}
            db.commit()

            final_email = ctx.get("email") or f"{phone.lstrip('+').replace(' ','')}@wa.dovic.ai"
            final_password = ctx.get("password") or phone[-6:]
            return (
                f"🎉 *{ctx['restaurant_name']} is now live on DOVIC AI!*\n\n"
                f"━━━━━━━━━━━━━━━\n"
                f"✅ Account created\n"
                f"✅ Restaurant registered\n"
                f"✅ WhatsApp linked\n\n"
                f"📱 *Dashboard login:*\n"
                f"https://aisoftware-ashen.vercel.app/login\n"
                f"📧 Email: {final_email}\n"
                f"🔑 Password: {final_password}\n\n"
                f"Type *'Help'* to see all WhatsApp commands 🚀"
            )

        except Exception as e:
            db.rollback()
            session.state = "idle"
            session.context = {}
            db.commit()
            return f"❌ Registration failed: {str(e)}\n\nType *'Hi'* to try again."

    return "👋 Send *'Hi'* to get started with DOVIC AI!"


def _is_owner(phone: str, restaurant: models.Restaurant, db: Session) -> bool:
    """Check if the WhatsApp number belongs to the restaurant owner."""
    clean = phone.lstrip("+")
    # Match by restaurant's own phone field
    if restaurant.phone and clean[-10:] in restaurant.phone.replace("+", "").replace(" ", ""):
        return True
    # Match by owner user's phone via RestaurantMember
    owner_member = db.query(models.RestaurantMember).filter(
        models.RestaurantMember.restaurant_id == restaurant.id,
        models.RestaurantMember.role == models.UserRole.owner,
    ).first()
    if owner_member:
        owner = db.query(models.User).filter(models.User.id == owner_member.user_id).first()
        if owner and owner.phone and clean[-10:] in owner.phone.replace("+", "").replace(" ", ""):
            return True
    return False


def _welcome_message(restaurant: models.Restaurant) -> str:
    return f"""👋 Welcome back to *DOVIC AI*!

🏪 *{restaurant.name}*
📅 {date.today().strftime('%d %B %Y')}

Here's what I can help you with:
• 📊 *Today's report* — Daily summary
• 📦 *Stock check* — Inventory status
• ✅ *Present today* — Mark attendance
• 💰 Record a sale
• 💸 Record an expense

Type *'Help'* for all commands."""


def _help_message() -> str:
    return """🤖 *DOVIC AI — Commands*

📊 *Reports*
• "Today's report"
• "Top items"
• "Supplier dues"

📦 *Inventory*
• "Stock check"
• "Restock: Chicken 10kg"

✅ *Attendance*
• "Present today"

💰 *Record Sale*
• "Sale: 2 Biryani, 1 Lassi, ₹480, UPI, Table 3"

💸 *Record Expense*
• "Expense: Vegetables ₹3200"

_Works in Tamil, Hindi & English!_
_For full dashboard: aisoftware-ashen.vercel.app_"""


async def _handle_report(restaurant: models.Restaurant, db: Session) -> str:
    from services.ai_service import gather_daily_metrics, generate_whatsapp_summary
    try:
        metrics = gather_daily_metrics(restaurant.id, date.today(), db)
        return await generate_whatsapp_summary(metrics, restaurant.name)
    except Exception as e:
        return f"Unable to generate report right now. Error: {str(e)}"


def _handle_stock_check(restaurant: models.Restaurant, db: Session) -> str:
    ingredients = db.query(models.Ingredient).filter(
        models.Ingredient.restaurant_id == restaurant.id,
        models.Ingredient.is_active == True,
    ).all()
    critical = [i for i in ingredients if i.current_stock < i.min_stock_level * 0.5]
    low = [i for i in ingredients if i.min_stock_level * 0.5 <= i.current_stock <= i.min_stock_level]
    ok = [i for i in ingredients if i.current_stock > i.min_stock_level]

    msg = "⚠️ *Stock Status*\n\n"
    if critical:
        msg += "*🔴 CRITICAL (Reorder Now):*\n"
        for i in critical:
            msg += f"• {i.name}: {i.current_stock}{i.unit} (min: {i.min_stock_level}{i.unit})\n"
        msg += "\n"
    if low:
        msg += "*🟡 LOW (Reorder Soon):*\n"
        for i in low:
            msg += f"• {i.name}: {i.current_stock}{i.unit}\n"
        msg += "\n"
    if ok:
        msg += f"*✅ OK:* {', '.join([i.name for i in ok[:5]])}"
        if len(ok) > 5:
            msg += f" +{len(ok)-5} more"

    if not critical and not low:
        msg = "✅ *All stock levels are good!*\nNo reorders needed right now."

    return msg


async def _handle_attendance(phone: str, restaurant: models.Restaurant, db: Session) -> str:
    clean_phone = phone.lstrip("+")
    # Match staff by phone (last 10 digits)
    staff = db.query(models.StaffMember).filter(
        models.StaffMember.restaurant_id == restaurant.id,
        models.StaffMember.is_active == True,
        models.StaffMember.phone.ilike(f"%{clean_phone[-10:]}%"),
    ).first()

    if not staff:
        return (
            "❌ Your number is not registered as an employee.\n\n"
            "Ask your owner to add you in the DOVIC AI app → Staff section."
        )

    today = date.today()
    existing = db.query(models.Attendance).filter(
        models.Attendance.staff_member_id == staff.id,
        models.Attendance.date == today,
    ).first()

    if existing:
        return (
            f"✅ *{staff.name}* — Already marked Present today!\n"
            f"_{today.strftime('%d %B %Y')}, {datetime.now().strftime('%I:%M %p')}_"
        )

    attendance = models.Attendance(
        staff_member_id=staff.id,
        restaurant_id=restaurant.id,
        date=today,
        status=models.AttendanceStatus.present,
        notes=f"Marked via WhatsApp at {datetime.now().strftime('%H:%M')}",
    )
    db.add(attendance)

    total_staff = db.query(models.StaffMember).filter(
        models.StaffMember.restaurant_id == restaurant.id,
        models.StaffMember.is_active == True,
    ).count()
    present_count = db.query(models.Attendance).filter(
        models.Attendance.restaurant_id == restaurant.id,
        models.Attendance.date == today,
        models.Attendance.status == models.AttendanceStatus.present,
    ).count() + 1

    db.commit()

    # Notify owner
    owner_phone = restaurant.phone
    owner_member = db.query(models.RestaurantMember).filter(
        models.RestaurantMember.restaurant_id == restaurant.id,
        models.RestaurantMember.role == models.UserRole.owner,
    ).first()
    if owner_member:
        owner_user = db.query(models.User).filter(models.User.id == owner_member.user_id).first()
        if owner_user and owner_user.phone:
            owner_phone = owner_user.phone
    if owner_phone and clean_phone[-10:] not in (owner_phone or "").replace("+", "")[-10:]:
        notify = (
            f"👤 *{staff.name}* marked Present\n"
            f"🕐 {datetime.now().strftime('%I:%M %p')} · {today.strftime('%d %b %Y')}\n"
            f"📊 Team: {present_count}/{total_staff} present today"
        )
        import asyncio
        asyncio.create_task(send_whatsapp_message(owner_phone, notify))

    return (
        f"✅ Attendance marked!\n\n"
        f"👤 *{staff.name}*\n"
        f"🕐 {datetime.now().strftime('%I:%M %p')} · {today.strftime('%d %b %Y')}\n"
        f"📊 Team today: {present_count}/{total_staff} present"
    )


def _handle_top_items(restaurant: models.Restaurant, db: Session) -> str:
    from sqlalchemy import func, desc
    today = date.today()
    items = (
        db.query(
            models.SalesOrderItem.item_name,
            func.sum(models.SalesOrderItem.quantity).label("qty"),
            func.sum(models.SalesOrderItem.total_price).label("rev"),
        )
        .join(models.SalesOrder)
        .filter(
            models.SalesOrder.restaurant_id == restaurant.id,
            func.date(models.SalesOrder.created_at) == today,
        )
        .group_by(models.SalesOrderItem.item_name)
        .order_by(desc("qty"))
        .limit(5)
        .all()
    )
    if not items:
        return "📊 No sales recorded today yet."
    msg = f"🏆 *Top Items — Today*\n\n"
    medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
    for i, item in enumerate(items):
        msg += f"{medals[i]} {item.item_name} — {int(item.qty)} orders (₹{float(item.rev):,.0f})\n"
    return msg


def _handle_supplier_dues(restaurant: models.Restaurant, db: Session) -> str:
    suppliers = db.query(models.Supplier).filter(
        models.Supplier.restaurant_id == restaurant.id,
        models.Supplier.is_active == True,
        models.Supplier.outstanding_balance > 0,
    ).order_by(models.Supplier.outstanding_balance.desc()).all()

    if not suppliers:
        return "✅ *No outstanding dues!*\nAll suppliers are paid up."

    total = sum(s.outstanding_balance for s in suppliers)
    msg = f"💸 *Supplier Dues*\n\n"
    for s in suppliers:
        msg += f"• {s.company_name}: *₹{s.outstanding_balance:,.0f}*\n"
    msg += f"\n*Total outstanding: ₹{total:,.0f}*"
    return msg


async def _handle_sale(text: str, restaurant: models.Restaurant, db: Session, session) -> str:
    parsed = parse_sale_message(text)
    if not parsed or parsed["amount"] == 0:
        return "❌ Could not parse sale. Format:\n*Sale: 2 Biryani, 1 Lassi, ₹480, UPI, Table 3*"

    from datetime import datetime as dt
    count = db.query(models.SalesOrder).filter(
        models.SalesOrder.restaurant_id == restaurant.id,
        func.date(models.SalesOrder.created_at) == date.today(),
    ).count() if True else 0
    order_num = f"ORD-{date.today().strftime('%Y%m%d')}-{count+1:03d}"

    order = models.SalesOrder(
        restaurant_id=restaurant.id,
        order_number=order_num,
        table_number=parsed.get("table_number"),
        order_type="dine_in",
        payment_method=parsed["payment_method"],
        subtotal=parsed["amount"],
        tax=0,
        discount=0,
        total_amount=parsed["amount"],
        status=models.OrderStatus.completed,
        notes=f"Via WhatsApp: {parsed['raw'][:100]}",
    )
    db.add(order)
    db.commit()

    today_total = db.query(func.sum(models.SalesOrder.total_amount)).filter(
        models.SalesOrder.restaurant_id == restaurant.id,
        func.date(models.SalesOrder.created_at) == date.today(),
        models.SalesOrder.status == models.OrderStatus.completed,
    ).scalar() or 0

    return f"✅ *Sale Recorded!*\n\n🧾 {order_num}\n💰 ₹{parsed['amount']:,.0f} via {parsed['payment_method'].upper()}\n{'🪑 Table ' + str(parsed['table_number']) if parsed.get('table_number') else ''}\n\n📊 Today's total: ₹{today_total:,.0f}"


async def _handle_expense(text: str, restaurant: models.Restaurant, db: Session) -> str:
    parsed = parse_expense_message(text)
    if not parsed or parsed["amount"] == 0:
        return "❌ Format: *Expense: Vegetables from Fresh Farms ₹3200*"

    expense = models.Expense(
        restaurant_id=restaurant.id,
        category=parsed["category"],
        description=parsed["description"] or "Via WhatsApp",
        amount=parsed["amount"],
        payment_method=models.PaymentMethod.cash,
        expense_date=date.today(),
    )
    db.add(expense)
    db.commit()
    return f"✅ *Expense Saved!*\n\n💸 {parsed['description']}\n💰 ₹{parsed['amount']:,.0f}\n📂 Category: {parsed['category']}"


async def _handle_restock(text: str, restaurant: models.Restaurant, db: Session) -> str:
    parsed = parse_restock_message(text)
    if not parsed or parsed["quantity"] == 0:
        return "❌ Format: *Restock: Chicken 10kg*"

    ingredient = db.query(models.Ingredient).filter(
        models.Ingredient.restaurant_id == restaurant.id,
        models.Ingredient.name.ilike(f"%{parsed['ingredient_name']}%"),
    ).first()

    if not ingredient:
        return f"❌ Ingredient '{parsed['ingredient_name']}' not found. Add it from the app first."

    old_stock = ingredient.current_stock
    ingredient.current_stock += parsed["quantity"]

    txn = models.InventoryTransaction(
        ingredient_id=ingredient.id,
        restaurant_id=restaurant.id,
        transaction_type=models.TransactionType.restock,
        quantity=parsed["quantity"],
        notes="Via WhatsApp",
    )
    db.add(txn)
    db.commit()

    return f"✅ *Stock Updated!*\n\n📦 {ingredient.name}\n{old_stock}{ingredient.unit} → {ingredient.current_stock}{ingredient.unit}\n\n{'✅ Above minimum level.' if ingredient.current_stock > ingredient.min_stock_level else '⚠️ Still below minimum.'}"


async def _handle_ai_query(text: str, restaurant: models.Restaurant, db: Session) -> str:
    from services.ai_service import gather_daily_metrics, answer_query, try_llm_query
    try:
        metrics = gather_daily_metrics(restaurant.id, date.today(), db)
        llm_answer = await try_llm_query(text, metrics)
        if llm_answer:
            return llm_answer
        return answer_query(text, metrics)
    except Exception:
        return "I'm not sure about that. Try: 'Today's report', 'Stock check', 'Top items', or 'Help'."


# ─── Import fix ───────────────────────────────────────────────────────────────
from sqlalchemy import func
