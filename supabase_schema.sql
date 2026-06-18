-- DOVIC AI Restaurant OS â€” Complete Schema
-- Run this in Supabase SQL Editor

-- Enums
CREATE TYPE plan_type AS ENUM ('starter', 'growth', 'pro', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'free');
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card', 'online');
CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'half_day', 'leave');
CREATE TYPE transaction_type AS ENUM ('restock', 'usage', 'wastage', 'adjustment');

-- Super Admins
CREATE TABLE IF NOT EXISTS super_admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Restaurants
CREATE TABLE IF NOT EXISTS restaurants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    gst_number VARCHAR(20),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    restaurant_type VARCHAR(100) DEFAULT 'restaurant',
    cuisine_type VARCHAR(255),
    logo_url VARCHAR(500),
    plan plan_type DEFAULT 'starter',
    subscription_status subscription_status DEFAULT 'trial',
    payment_status payment_status DEFAULT 'pending',
    plan_expires_at TIMESTAMP,
    trial_ends_at TIMESTAMP,
    whatsapp_number VARCHAR(20),
    whatsapp_connected BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Restaurant Members
CREATE TABLE IF NOT EXISTS restaurant_members (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'staff',
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP DEFAULT NOW()
);

-- Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    emoji VARCHAR(10),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price FLOAT NOT NULL,
    cost_price FLOAT,
    image_url VARCHAR(500),
    is_veg BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    category VARCHAR(100),
    outstanding_balance FLOAT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ingredients / Inventory
CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    current_stock FLOAT DEFAULT 0,
    min_stock_level FLOAT DEFAULT 0,
    cost_per_unit FLOAT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    transaction_type transaction_type NOT NULL,
    quantity FLOAT NOT NULL,
    unit_cost FLOAT,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sales Orders
CREATE TABLE IF NOT EXISTS sales_orders (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_number VARCHAR(20) NOT NULL,
    table_number VARCHAR(20),
    order_type VARCHAR(50) DEFAULT 'dine_in',
    subtotal FLOAT DEFAULT 0,
    tax FLOAT DEFAULT 0,
    discount FLOAT DEFAULT 0,
    total_amount FLOAT NOT NULL,
    payment_method payment_method DEFAULT 'cash',
    status order_status DEFAULT 'completed',
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sales Order Items
CREATE TABLE IF NOT EXISTS sales_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price FLOAT NOT NULL,
    total_price FLOAT NOT NULL
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount FLOAT NOT NULL,
    payment_method payment_method DEFAULT 'cash',
    expense_date DATE NOT NULL,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Staff Members
CREATE TABLE IF NOT EXISTS staff_members (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(100) NOT NULL,
    salary FLOAT,
    join_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    staff_member_id INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- AI Reports
CREATE TABLE IF NOT EXISTS ai_reports (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    report_type VARCHAR(50) DEFAULT 'daily',
    content TEXT NOT NULL,
    summary TEXT,
    metrics JSONB,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMP DEFAULT NOW()
);

-- WhatsApp Sessions
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(30) UNIQUE NOT NULL,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    state VARCHAR(100) DEFAULT 'idle',
    context JSONB DEFAULT '{}',
    last_activity TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_restaurant ON sales_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created ON sales_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_restaurant ON expenses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_ingredients_restaurant ON ingredients(restaurant_id);

-- Test user (Enterprise plan, 1 year)
INSERT INTO users (email, phone, hashed_password, full_name, is_active, is_verified)
VALUES (
    'test@dovic.ai',
    '+919999999999',
    '$2b$12$KhvTLyBvmyWbMNR8Kx5jqe2D4jznvATBgKLwq2U7MP24oRzjJ2a3G',
    'DOVIC Test User',
    TRUE,
    TRUE
) ON CONFLICT (email) DO NOTHING;

INSERT INTO restaurants (name, slug, phone, email, city, state, restaurant_type, plan, subscription_status, payment_status, plan_expires_at, is_active, notes)
VALUES (
    'DOVIC Test Restaurant',
    'dovic-test-restaurant',
    '+919999999999',
    'test@dovic.ai',
    'Chennai',
    'Tamil Nadu',
    'restaurant',
    'enterprise',
    'active',
    'free',
    NOW() + INTERVAL '365 days',
    TRUE,
    'Test account â€” Enterprise plan for real user testing'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO restaurant_members (restaurant_id, user_id, role, is_active)
SELECT r.id, u.id, 'owner', TRUE
FROM restaurants r, users u
WHERE r.slug = 'dovic-test-restaurant' AND u.email = 'test@dovic.ai'
ON CONFLICT DO NOTHING;
