from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum, Date, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class PlanType(str, enum.Enum):
    starter = "starter"
    growth = "growth"
    pro = "pro"
    enterprise = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    trial = "trial"
    active = "active"
    suspended = "suspended"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    overdue = "overdue"
    free = "free"


class UserRole(str, enum.Enum):
    owner = "owner"
    manager = "manager"
    staff = "staff"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    upi = "upi"
    card = "card"
    online = "online"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    half_day = "half_day"
    leave = "leave"


class TransactionType(str, enum.Enum):
    restock = "restock"
    usage = "usage"
    wastage = "wastage"
    adjustment = "adjustment"


# ─── Super Admin ─────────────────────────────────────────────────────────────

class SuperAdmin(Base):
    __tablename__ = "super_admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)


# ─── Restaurant ──────────────────────────────────────────────────────────────

class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True)
    gst_number = Column(String(20), nullable=True)
    phone = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    restaurant_type = Column(String(100), default="restaurant")
    cuisine_type = Column(String(255), nullable=True)
    logo_url = Column(String(500), nullable=True)
    plan = Column(Enum(PlanType), default=PlanType.starter)
    subscription_status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.trial)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    plan_expires_at = Column(DateTime, nullable=True)
    trial_ends_at = Column(DateTime, nullable=True)
    whatsapp_number = Column(String(20), nullable=True)
    whatsapp_connected = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    members = relationship("RestaurantMember", back_populates="restaurant", cascade="all, delete")
    menu_categories = relationship("MenuCategory", back_populates="restaurant", cascade="all, delete")
    menu_items = relationship("MenuItem", back_populates="restaurant", cascade="all, delete")
    ingredients = relationship("Ingredient", back_populates="restaurant", cascade="all, delete")
    sales_orders = relationship("SalesOrder", back_populates="restaurant", cascade="all, delete")
    expenses = relationship("Expense", back_populates="restaurant", cascade="all, delete")
    suppliers = relationship("Supplier", back_populates="restaurant", cascade="all, delete")
    staff_members = relationship("StaffMember", back_populates="restaurant", cascade="all, delete")
    ai_reports = relationship("AIReport", back_populates="restaurant", cascade="all, delete")


# ─── Users ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    memberships = relationship("RestaurantMember", back_populates="user")


class RestaurantMember(Base):
    __tablename__ = "restaurant_members"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.staff)
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime, server_default=func.now())

    restaurant = relationship("Restaurant", back_populates="members")
    user = relationship("User", back_populates="memberships")


# ─── Menu ────────────────────────────────────────────────────────────────────

class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    emoji = Column(String(10), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    restaurant = relationship("Restaurant", back_populates="menu_categories")
    items = relationship("MenuItem", back_populates="category", cascade="all, delete")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("menu_categories.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=True)
    image_url = Column(String(500), nullable=True)
    is_veg = Column(Boolean, default=True)
    is_available = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    restaurant = relationship("Restaurant", back_populates="menu_items")
    category = relationship("MenuCategory", back_populates="items")
    order_items = relationship("SalesOrderItem", back_populates="menu_item")


# ─── Inventory ───────────────────────────────────────────────────────────────

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    unit = Column(String(20), nullable=False, default="kg")
    current_stock = Column(Float, default=0)
    min_stock_level = Column(Float, default=0)
    cost_per_unit = Column(Float, nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    restaurant = relationship("Restaurant", back_populates="ingredients")
    transactions = relationship("InventoryTransaction", back_populates="ingredient", cascade="all, delete")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    ingredient = relationship("Ingredient", back_populates="transactions")


# ─── Sales ───────────────────────────────────────────────────────────────────

class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    order_number = Column(String(20), nullable=False)
    table_number = Column(String(20), nullable=True)
    order_type = Column(String(50), default="dine_in")
    subtotal = Column(Float, default=0)
    tax = Column(Float, default=0)
    discount = Column(Float, default=0)
    total_amount = Column(Float, nullable=False)
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.cash)
    status = Column(Enum(OrderStatus), default=OrderStatus.completed)
    notes = Column(Text, nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    restaurant = relationship("Restaurant", back_populates="sales_orders")
    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=True)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    order = relationship("SalesOrder", back_populates="items")
    menu_item = relationship("MenuItem", back_populates="order_items")


# ─── Expenses ────────────────────────────────────────────────────────────────

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.cash)
    expense_date = Column(Date, nullable=False)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    restaurant = relationship("Restaurant", back_populates="expenses")


# ─── Suppliers ───────────────────────────────────────────────────────────────

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    contact_person = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    outstanding_balance = Column(Float, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    restaurant = relationship("Restaurant", back_populates="suppliers")


# ─── Staff ───────────────────────────────────────────────────────────────────

class StaffMember(Base):
    __tablename__ = "staff_members"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(String(100), nullable=False)
    salary = Column(Float, nullable=True)
    join_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    restaurant = relationship("Restaurant", back_populates="staff_members")
    attendance_records = relationship("Attendance", back_populates="staff_member", cascade="all, delete")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    staff_member_id = Column(Integer, ForeignKey("staff_members.id"), nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.present)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    staff_member = relationship("StaffMember", back_populates="attendance_records")


# ─── AI Reports ──────────────────────────────────────────────────────────────

class AIReport(Base):
    __tablename__ = "ai_reports"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    report_date = Column(Date, nullable=False)
    report_type = Column(String(50), default="daily")
    content = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    metrics = Column(JSON, nullable=True)
    whatsapp_sent = Column(Boolean, default=False)
    generated_at = Column(DateTime, server_default=func.now())

    restaurant = relationship("Restaurant", back_populates="ai_reports")


# ─── WhatsApp Sessions ───────────────────────────────────────────────────────

class OrderDeletionLog(Base):
    __tablename__ = "order_deletion_logs"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    order_id = Column(Integer, nullable=False)
    order_number = Column(String(30), nullable=False)
    order_total = Column(Float, nullable=False)
    order_items = Column(JSON, nullable=True)
    payment_method = Column(String(20), nullable=True)
    table_number = Column(String(20), nullable=True)
    reason = Column(Text, nullable=True)
    deleted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_by_name = Column(String(255), nullable=True)
    deleted_at = Column(DateTime, server_default=func.now())
    original_created_at = Column(DateTime, nullable=True)


class WhatsAppSession(Base):
    __tablename__ = "whatsapp_sessions"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(30), unique=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    state = Column(String(100), default="idle")
    context = Column(JSON, default=dict)
    last_activity = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())
