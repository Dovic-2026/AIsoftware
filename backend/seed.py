"""
Seed script — creates demo restaurant with realistic data.
Run: python seed.py
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from database import SessionLocal, engine, Base
import models
from auth import hash_password
from datetime import date, datetime, timedelta
import random

Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("Seeding DOVIC AI Restaurant OS demo data...")

# 1. User (Owner)
user = db.query(models.User).filter(models.User.email == "owner@spicetrail.com").first()
if not user:
    user = models.User(
        email="owner@spicetrail.com",
        full_name="Raj Sharma",
        phone="+919876543210",
        hashed_password=hash_password("demo1234"),
        is_active=True,
        is_verified=True,
        whatsapp_number="919876543210",
    )
    db.add(user)
    db.flush()

# 2. Restaurant
restaurant = db.query(models.Restaurant).filter(models.Restaurant.slug == "spice-trail").first()
if not restaurant:
    restaurant = models.Restaurant(
        name="Spice Trail",
        slug="spice-trail",
        phone="+918012345678",
        email="info@spicetrail.com",
        address="12, 5th Cross, Koramangala",
        city="Bangalore",
        state="Karnataka",
        pincode="560034",
        gst_number="29ABCDE1234F1Z5",
        restaurant_type="Full Service Restaurant",
        cuisine_type="North Indian, Mughlai",
        plan=models.PlanType.pro,
        whatsapp_number="919876543210",
        whatsapp_connected=True,
    )
    db.add(restaurant)
    db.flush()

    member = models.RestaurantMember(restaurant_id=restaurant.id, user_id=user.id, role=models.UserRole.owner)
    db.add(member)
    db.flush()
else:
    print("  Restaurant already exists, skipping...")
    db.close()
    print("✅ Done.")
    exit()

# 3. Menu Categories
cats = {}
for name, emoji, order in [
    ("Biryani", "🍛", 1), ("Starters", "🍢", 2), ("Main Course", "🫕", 3),
    ("Breads", "🫓", 4), ("Beverages", "🥤", 5), ("Desserts", "🍮", 6),
]:
    cat = models.MenuCategory(restaurant_id=restaurant.id, name=name, emoji=emoji, sort_order=order)
    db.add(cat)
    db.flush()
    cats[name] = cat

# 4. Menu Items
menu_items_data = [
    ("Chicken Biryani", 200, 80, "Biryani", False),
    ("Veg Biryani", 160, 60, "Biryani", True),
    ("Mutton Biryani", 260, 110, "Biryani", False),
    ("Prawn Biryani", 280, 120, "Biryani", False),
    ("Chicken Tikka", 220, 90, "Starters", False),
    ("Paneer Tikka", 180, 65, "Starters", True),
    ("Veg Seekh Kebab", 160, 55, "Starters", True),
    ("Chicken 65", 200, 80, "Starters", False),
    ("Paneer Butter Masala", 180, 60, "Main Course", True),
    ("Dal Tadka", 120, 30, "Main Course", True),
    ("Chicken Curry", 200, 75, "Main Course", False),
    ("Mutton Rogan Josh", 280, 120, "Main Course", False),
    ("Garlic Naan", 40, 10, "Breads", True),
    ("Butter Roti", 25, 6, "Breads", True),
    ("Paratha", 35, 10, "Breads", True),
    ("Mango Lassi", 80, 20, "Beverages", True),
    ("Masala Chai", 30, 8, "Beverages", True),
    ("Cold Coffee", 90, 25, "Beverages", True),
    ("Gulab Jamun", 60, 15, "Desserts", True),
    ("Kheer", 70, 18, "Desserts", True),
]
menu_items = {}
for name, price, cost, cat_name, is_veg in menu_items_data:
    item = models.MenuItem(
        restaurant_id=restaurant.id,
        category_id=cats[cat_name].id,
        name=name, price=price, cost_price=cost,
        is_veg=is_veg, is_available=True,
    )
    db.add(item)
    db.flush()
    menu_items[name] = item

# 5. Suppliers
suppliers_data = [
    ("Fresh Farms Co.", "Arun Kumar", "9811100001", "Vegetables & Fruits", 12400),
    ("Star Poultry", "Suresh Nair", "9811100002", "Meat & Poultry", 8200),
    ("Dairy Direct", "Priya Singh", "9811100003", "Dairy Products", 3600),
    ("Spice World", "Mohan Das", "9811100004", "Spices & Masala", 1800),
    ("Oil Masters", "Ramesh Patel", "9811100005", "Edible Oils", 5200),
    ("Bakery Supply", "Kavitha Rao", "9811100006", "Flour & Grains", 3000),
]
suppliers = {}
for name, contact, phone, cat, balance in suppliers_data:
    s = models.Supplier(
        restaurant_id=restaurant.id,
        company_name=name, contact_person=contact, phone=phone,
        category=cat, outstanding_balance=balance,
    )
    db.add(s)
    db.flush()
    suppliers[name] = s

# 6. Ingredients
ingredients_data = [
    ("Chicken", "Meat", 2, 10, "kg", 250),
    ("Basmati Rice", "Grains", 5, 15, "kg", 90),
    ("Cooking Oil", "Oil", 3, 10, "L", 180),
    ("Tomatoes", "Vegetables", 8, 5, "kg", 40),
    ("Onions", "Vegetables", 12, 10, "kg", 30),
    ("Paneer", "Dairy", 3, 5, "kg", 320),
    ("Butter", "Dairy", 4, 3, "kg", 480),
    ("Garam Masala", "Spices", 2, 1, "kg", 800),
    ("Turmeric", "Spices", 1.5, 1, "kg", 200),
    ("Wheat Flour", "Grains", 20, 10, "kg", 45),
    ("Mutton", "Meat", 3, 8, "kg", 650),
    ("Cream", "Dairy", 2, 3, "L", 220),
    ("Garlic", "Vegetables", 3, 2, "kg", 120),
    ("Ginger", "Vegetables", 2, 2, "kg", 100),
    ("Cumin", "Spices", 1, 0.5, "kg", 300),
]
for name, cat, stock, min_stock, unit, cost in ingredients_data:
    ing = models.Ingredient(
        restaurant_id=restaurant.id,
        name=name, category=cat,
        current_stock=stock, min_stock_level=min_stock,
        unit=unit, cost_per_unit=cost,
    )
    db.add(ing)

# 7. Staff
staff_data = [
    ("Ravi Kumar", "9820001111", "Head Chef", 35000),
    ("Priya Nair", "9820002222", "Waiter", 18000),
    ("Suresh Das", "9820003333", "Waiter", 18000),
    ("Anita Singh", "9820004444", "Cashier", 22000),
    ("Manoj Pillai", "9820005555", "Cook", 28000),
    ("Deepa Rao", "9820006666", "Waiter", 18000),
    ("Kiran Mehta", "9820007777", "Delivery", 20000),
    ("Sanjay Gupta", "9820008888", "Manager", 40000),
]
staff_members = []
for name, phone, role, salary in staff_data:
    s = models.StaffMember(
        restaurant_id=restaurant.id,
        full_name=name, phone=phone,
        whatsapp_number=phone,
        role=role, monthly_salary=salary,
        join_date=date(2025, 1, 1),
    )
    db.add(s)
    db.flush()
    staff_members.append(s)

# 8. Attendance (last 7 days)
for days_ago in range(7):
    d = date.today() - timedelta(days=days_ago)
    for i, staff in enumerate(staff_members):
        status = models.AttendanceStatus.present
        if days_ago == 0 and i == 1:
            status = models.AttendanceStatus.absent
        att = models.Attendance(
            staff_member_id=staff.id, restaurant_id=restaurant.id,
            date=d, status=status,
            check_in_time="09:00", marked_via="app",
        )
        db.add(att)

# 9. Sales (last 7 days)
items_for_sale = [
    ("Chicken Biryani", 200), ("Veg Biryani", 160), ("Mutton Biryani", 260),
    ("Paneer Butter Masala", 180), ("Dal Tadka", 120), ("Chicken Tikka", 220),
    ("Garlic Naan", 40), ("Mango Lassi", 80), ("Masala Chai", 30),
]
payments = [models.PaymentMethod.cash, models.PaymentMethod.upi, models.PaymentMethod.card]
order_types = ["dine_in", "dine_in", "dine_in", "takeaway"]

for days_ago in range(7):
    d = date.today() - timedelta(days=days_ago)
    num_orders = random.randint(30, 55)
    for j in range(num_orders):
        order_time = datetime.combine(d, datetime.min.time()) + timedelta(hours=random.randint(10, 22), minutes=random.randint(0, 59))
        num_items = random.randint(1, 4)
        selected = random.choices(items_for_sale, k=num_items)
        subtotal = sum(price * random.randint(1, 3) for _, price in selected)
        order = models.SalesOrder(
            restaurant_id=restaurant.id,
            order_number=f"ORD-{d.strftime('%Y%m%d')}-{j+1:03d}",
            table_number=f"T{random.randint(1, 10)}" if random.random() > 0.2 else None,
            order_type=random.choice(order_types),
            payment_method=random.choice(payments),
            subtotal=subtotal,
            tax=round(subtotal * 0.05, 2),
            discount=0,
            total_amount=round(subtotal * 1.05, 2),
            status=models.OrderStatus.completed,
            created_at=order_time,
        )
        db.add(order)
        db.flush()
        for item_name, item_price in selected:
            qty = random.randint(1, 3)
            mi = menu_items.get(item_name)
            oi = models.SalesOrderItem(
                order_id=order.id,
                menu_item_id=mi.id if mi else None,
                item_name=item_name,
                quantity=qty,
                unit_price=item_price,
                total_price=item_price * qty,
            )
            db.add(oi)

# 10. Expenses (last 7 days)
expense_data = [
    ("Raw Materials", "Vegetables from Fresh Farms", 3200),
    ("Raw Materials", "Chicken from Star Poultry", 4500),
    ("Utilities", "Electricity bill", 3800),
    ("Staff Salary", "Ravi Kumar advance", 5000),
    ("Maintenance", "Gas cylinder refill", 3200),
    ("Marketing", "Instagram ads", 1500),
    ("Raw Materials", "Rice and spices", 2100),
]
for days_ago in range(7):
    d = date.today() - timedelta(days=days_ago)
    for i, (cat, desc, amount) in enumerate(random.choices(expense_data, k=random.randint(2, 4))):
        exp = models.Expense(
            restaurant_id=restaurant.id,
            category=cat, description=desc,
            amount=amount + random.randint(-200, 200),
            payment_method=models.PaymentMethod.cash,
            expense_date=d,
        )
        db.add(exp)

db.commit()
db.close()
print("✅ Seeding complete!")
print("\n🔐 Demo Login:")
print("  Email: owner@spicetrail.com")
print("  Password: demo1234")
print("\n🚀 Start server: uvicorn main:app --reload")
print("📚 API Docs: http://localhost:8000/docs")
