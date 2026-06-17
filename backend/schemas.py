from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from models import PlanType, UserRole, PaymentMethod, OrderStatus, AttendanceStatus, TransactionType, SubscriptionStatus, PaymentStatus


# ─── Auth ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    created_at: datetime
    class Config: from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    restaurant: Optional[dict] = None


# ─── Restaurant ──────────────────────────────────────────────────────────────

class RestaurantCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    restaurant_type: Optional[str] = "restaurant"
    cuisine_type: Optional[str] = None
    gst_number: Optional[str] = None
    whatsapp_number: Optional[str] = None

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    restaurant_type: Optional[str] = None
    cuisine_type: Optional[str] = None
    gst_number: Optional[str] = None
    whatsapp_number: Optional[str] = None

class RestaurantOut(BaseModel):
    id: int
    name: str
    slug: str
    phone: str
    email: Optional[str]
    address: Optional[str]
    city: Optional[str]
    plan: PlanType
    subscription_status: SubscriptionStatus
    payment_status: PaymentStatus
    whatsapp_number: Optional[str]
    whatsapp_connected: bool
    restaurant_type: Optional[str]
    cuisine_type: Optional[str]
    gst_number: Optional[str]
    is_active: bool
    created_at: datetime
    class Config: from_attributes = True


# ─── Menu Category ───────────────────────────────────────────────────────────

class MenuCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    emoji: Optional[str] = None
    sort_order: int = 0

class MenuCategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    emoji: Optional[str]
    sort_order: int
    is_active: bool
    class Config: from_attributes = True


# ─── Menu Item ───────────────────────────────────────────────────────────────

class MenuItemCreate(BaseModel):
    name: str
    price: float
    category_id: Optional[int] = None
    description: Optional[str] = None
    cost_price: Optional[float] = None
    is_veg: bool = True
    is_available: bool = True
    is_featured: bool = False
    sort_order: int = 0

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    cost_price: Optional[float] = None
    is_veg: Optional[bool] = None
    is_available: Optional[bool] = None
    is_featured: Optional[bool] = None

class MenuItemOut(BaseModel):
    id: int
    name: str
    price: float
    cost_price: Optional[float]
    description: Optional[str]
    is_veg: bool
    is_available: bool
    is_featured: bool
    category_id: Optional[int]
    image_url: Optional[str]
    created_at: datetime
    class Config: from_attributes = True


# ─── Inventory ───────────────────────────────────────────────────────────────

class IngredientCreate(BaseModel):
    name: str
    category: Optional[str] = None
    unit: str = "kg"
    current_stock: float = 0
    min_stock_level: float = 0
    cost_per_unit: Optional[float] = None
    supplier_id: Optional[int] = None

class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    current_stock: Optional[float] = None
    min_stock_level: Optional[float] = None
    cost_per_unit: Optional[float] = None

class IngredientOut(BaseModel):
    id: int
    name: str
    category: Optional[str]
    unit: str
    current_stock: float
    min_stock_level: float
    cost_per_unit: Optional[float]
    supplier_id: Optional[int]
    is_active: bool
    class Config: from_attributes = True

class InventoryTransactionCreate(BaseModel):
    ingredient_id: int
    transaction_type: TransactionType
    quantity: float
    unit_cost: Optional[float] = None
    notes: Optional[str] = None

class InventoryTransactionOut(BaseModel):
    id: int
    ingredient_id: int
    transaction_type: TransactionType
    quantity: float
    unit_cost: Optional[float]
    notes: Optional[str]
    created_at: datetime
    class Config: from_attributes = True


# ─── Sales ───────────────────────────────────────────────────────────────────

class SalesOrderItemCreate(BaseModel):
    menu_item_id: Optional[int] = None
    item_name: str
    quantity: int
    unit_price: float

class SalesOrderCreate(BaseModel):
    table_number: Optional[str] = None
    order_type: str = "dine_in"
    payment_method: PaymentMethod = PaymentMethod.cash
    discount: float = 0
    notes: Optional[str] = None
    items: List[SalesOrderItemCreate]

class SalesOrderItemOut(BaseModel):
    id: int
    item_name: str
    quantity: int
    unit_price: float
    total_price: float
    class Config: from_attributes = True

class SalesOrderOut(BaseModel):
    id: int
    order_number: str
    table_number: Optional[str]
    order_type: str
    subtotal: float
    tax: float
    discount: float
    total_amount: float
    payment_method: PaymentMethod
    status: OrderStatus
    items: List[SalesOrderItemOut]
    created_at: datetime
    class Config: from_attributes = True


# ─── Expenses ────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: float
    payment_method: PaymentMethod = PaymentMethod.cash
    expense_date: date

class ExpenseOut(BaseModel):
    id: int
    category: str
    description: str
    amount: float
    payment_method: PaymentMethod
    expense_date: date
    created_at: datetime
    class Config: from_attributes = True


# ─── Suppliers ───────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    outstanding_balance: Optional[float] = None

class SupplierOut(BaseModel):
    id: int
    name: str
    contact_person: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    category: Optional[str]
    outstanding_balance: float
    is_active: bool
    class Config: from_attributes = True


# ─── Staff ───────────────────────────────────────────────────────────────────

class StaffMemberCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    role: str
    salary: Optional[float] = None
    join_date: Optional[date] = None

class StaffMemberUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    salary: Optional[float] = None
    is_active: Optional[bool] = None

class StaffMemberOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    role: str
    salary: Optional[float]
    join_date: Optional[date]
    is_active: bool
    created_at: datetime
    class Config: from_attributes = True

class AttendanceCreate(BaseModel):
    staff_member_id: int
    date: date
    status: AttendanceStatus = AttendanceStatus.present
    notes: Optional[str] = None

class AttendanceBulkCreate(BaseModel):
    date: date
    records: List[AttendanceCreate]

class AttendanceOut(BaseModel):
    id: int
    staff_member_id: int
    date: date
    status: AttendanceStatus
    notes: Optional[str]
    created_at: datetime
    class Config: from_attributes = True


# ─── AI Reports ──────────────────────────────────────────────────────────────

class AIReportOut(BaseModel):
    id: int
    report_date: date
    report_type: str
    content: str
    summary: Optional[str]
    metrics: Optional[dict]
    whatsapp_sent: bool
    generated_at: datetime
    class Config: from_attributes = True

class AIQueryRequest(BaseModel):
    query: str
    language: str = "english"


# ─── Dashboard ───────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    today_revenue: float
    today_orders: int
    avg_order_value: float
    low_stock_count: int
    staff_present: int
    staff_total: int
    monthly_revenue: float
    monthly_expenses: float
    top_items: List[dict]
    revenue_chart: List[dict]
    expense_breakdown: List[dict]
    recent_orders: List[dict]
    low_stock_items: List[dict]
    supplier_dues: List[dict]
