"""
Super Admin API — manage users, subscriptions, and platform stats.
HTML panel at GET /admin
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional
from database import get_db
import models
from auth import hash_password
from config import settings

router = APIRouter(tags=["Admin"])

ADMIN_JWT_EXPIRE_HOURS = 24


def create_admin_token() -> str:
    expire = datetime.utcnow() + timedelta(hours=ADMIN_JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": "admin", "is_admin": True, "exp": expire}, settings.ADMIN_SECRET_KEY, algorithm="HS256")


def verify_admin_token(request: Request) -> bool:
    token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
    if not token:
        return False
    try:
        payload = jwt.decode(token, settings.ADMIN_SECRET_KEY, algorithms=["HS256"])
        return payload.get("is_admin") is True
    except JWTError:
        return False


def require_admin(request: Request):
    if not verify_admin_token(request):
        raise HTTPException(status_code=401, detail="Admin authentication required")


# ─── Admin Auth ───────────────────────────────────────────────────────────────

@router.post("/admin/login")
def admin_login(payload: dict, db: Session = Depends(get_db)):
    username = payload.get("username", "")
    password = payload.get("password", "")
    if username != settings.ADMIN_USERNAME or password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    token = create_admin_token()
    return {"token": token, "expires_in": ADMIN_JWT_EXPIRE_HOURS * 3600}


# ─── Admin Stats ─────────────────────────────────────────────────────────────

@router.get("/admin/stats")
def admin_stats(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    total_restaurants = db.query(models.Restaurant).count()
    active_restaurants = db.query(models.Restaurant).filter(models.Restaurant.is_active == True).count()
    total_users = db.query(models.User).count()
    total_orders = db.query(models.SalesOrder).count()

    by_plan = db.query(models.Restaurant.plan, func.count(models.Restaurant.id)).group_by(models.Restaurant.plan).all()
    by_status = db.query(models.Restaurant.subscription_status, func.count(models.Restaurant.id)).group_by(models.Restaurant.subscription_status).all()

    recent = db.query(models.Restaurant).order_by(models.Restaurant.created_at.desc()).limit(5).all()

    return {
        "total_restaurants": total_restaurants,
        "active_restaurants": active_restaurants,
        "total_users": total_users,
        "total_orders": total_orders,
        "by_plan": {p: c for p, c in by_plan},
        "by_status": {s: c for s, c in by_status},
        "recent_signups": [{"id": r.id, "name": r.name, "plan": r.plan, "city": r.city, "created_at": r.created_at.isoformat() if r.created_at else None} for r in recent],
    }


# ─── Manage Restaurants ───────────────────────────────────────────────────────

@router.get("/admin/restaurants")
def list_all_restaurants(request: Request, search: Optional[str] = None, db: Session = Depends(get_db)):
    require_admin(request)
    q = db.query(models.Restaurant)
    if search:
        q = q.filter(models.Restaurant.name.ilike(f"%{search}%"))
    restaurants = q.order_by(models.Restaurant.created_at.desc()).limit(200).all()
    result = []
    for r in restaurants:
        owner = db.query(models.RestaurantMember).filter(
            models.RestaurantMember.restaurant_id == r.id,
            models.RestaurantMember.role == models.UserRole.owner,
        ).first()
        owner_user = db.query(models.User).filter(models.User.id == owner.user_id).first() if owner else None
        result.append({
            "id": r.id, "name": r.name, "city": r.city, "phone": r.phone,
            "plan": r.plan, "subscription_status": r.subscription_status,
            "payment_status": r.payment_status, "is_active": r.is_active,
            "whatsapp_connected": r.whatsapp_connected,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "owner_email": owner_user.email if owner_user else None,
            "owner_name": owner_user.full_name if owner_user else None,
        })
    return result


@router.patch("/admin/restaurants/{restaurant_id}")
def update_restaurant_admin(
    restaurant_id: int, payload: dict,
    request: Request, db: Session = Depends(get_db)
):
    require_admin(request)
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    allowed = {"plan", "subscription_status", "payment_status", "is_active", "notes"}
    for k, v in payload.items():
        if k in allowed:
            # Validate enums
            if k == "plan":
                v = models.PlanType(v)
            elif k == "subscription_status":
                v = models.SubscriptionStatus(v)
            elif k == "payment_status":
                v = models.PaymentStatus(v)
            setattr(r, k, v)

    if payload.get("plan_expires_at"):
        r.plan_expires_at = datetime.fromisoformat(payload["plan_expires_at"])

    db.commit()
    db.refresh(r)
    return {"success": True, "restaurant_id": r.id, "plan": r.plan, "subscription_status": r.subscription_status}


@router.delete("/admin/restaurants/{restaurant_id}")
def suspend_restaurant(restaurant_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    r.is_active = False
    r.subscription_status = models.SubscriptionStatus.suspended
    db.commit()
    return {"success": True}


# ─── Manage Users ─────────────────────────────────────────────────────────────

@router.get("/admin/users")
def list_all_users(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    users = db.query(models.User).order_by(models.User.created_at.desc()).limit(200).all()
    return [{"id": u.id, "email": u.email, "full_name": u.full_name, "phone": u.phone, "is_active": u.is_active, "created_at": u.created_at.isoformat() if u.created_at else None} for u in users]


@router.patch("/admin/users/{user_id}/reset-password")
def reset_user_password(user_id: int, payload: dict, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_password = payload.get("password")
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user.hashed_password = hash_password(new_password)
    db.commit()
    return {"success": True}


# ─── Admin HTML Panel ─────────────────────────────────────────────────────────

ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DOVIC AI — Super Admin</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .login-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; width: 380px; }
  .logo { font-size: 24px; font-weight: 900; color: #22c55e; text-align: center; margin-bottom: 8px; }
  .sub { text-align: center; color: #64748b; font-size: 13px; margin-bottom: 32px; }
  label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
  input { width: 100%; background: #0f172a; border: 1.5px solid #334155; border-radius: 10px; padding: 12px 16px; color: #e2e8f0; font-size: 14px; outline: none; margin-bottom: 16px; }
  input:focus { border-color: #22c55e; }
  .btn { width: 100%; padding: 13px; background: #22c55e; color: #000; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
  .btn:hover { background: #16a34a; }
  .err { color: #f87171; font-size: 13px; text-align: center; margin-top: 12px; }
  /* Dashboard */
  .dash { display: none; }
  .header { background: #1e293b; border-bottom: 1px solid #334155; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
  .header .brand { font-size: 18px; font-weight: 900; color: #22c55e; }
  .header .logout { background: #334155; border: none; color: #94a3b8; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
  .main { padding: 32px; max-width: 1400px; margin: 0 auto; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 20px; }
  .stat-card .val { font-size: 32px; font-weight: 900; color: #f1f5f9; }
  .stat-card .lbl { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-top: 4px; }
  .section { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
  .section-title { font-size: 15px; font-weight: 700; color: #f1f5f9; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .search-bar { background: #0f172a; border: 1.5px solid #334155; border-radius: 10px; padding: 10px 14px; color: #e2e8f0; font-size: 13px; outline: none; width: 280px; }
  .search-bar:focus { border-color: #22c55e; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .05em; padding: 8px 12px; border-bottom: 1px solid #334155; }
  td { padding: 12px 12px; font-size: 13px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #0f172a; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .badge-active { background: #14532d; color: #4ade80; }
  .badge-trial { background: #1e3a5f; color: #60a5fa; }
  .badge-suspended { background: #450a0a; color: #f87171; }
  .badge-starter { background: #1e293b; color: #94a3b8; }
  .badge-growth { background: #1c1917; color: #fb923c; }
  .badge-pro { background: #1e1b4b; color: #a78bfa; }
  .badge-enterprise { background: #14532d; color: #4ade80; }
  .action-btn { background: #334155; border: none; color: #94a3b8; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 4px; }
  .action-btn:hover { background: #475569; color: #f1f5f9; }
  .action-btn.danger { background: #450a0a; color: #f87171; }
  .action-btn.primary { background: #14532d; color: #4ade80; }
  select.inline { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 4px 8px; border-radius: 6px; font-size: 12px; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: #22c55e; color: #000; padding: 12px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; display: none; z-index: 100; }
</style>
</head>
<body>

<!-- Login -->
<div class="login-wrap" id="loginWrap">
  <div class="login-card">
    <div class="logo">DOVIC AI</div>
    <div class="sub">Super Admin Panel</div>
    <div>
      <label>Username</label>
      <input type="text" id="username" placeholder="admin username" />
      <label>Password</label>
      <input type="password" id="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')login()" />
      <button class="btn" onclick="login()">Sign In to Admin</button>
      <div class="err" id="loginErr"></div>
    </div>
  </div>
</div>

<!-- Dashboard -->
<div class="dash" id="dashboard">
  <div class="header">
    <div class="brand">DOVIC AI — Super Admin</div>
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:12px;color:#64748b" id="headerTime"></span>
      <button class="logout" onclick="logout()">Sign Out</button>
    </div>
  </div>
  <div class="main">
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card"><div class="val" id="sTotal">—</div><div class="lbl">Total Restaurants</div></div>
      <div class="stat-card"><div class="val" id="sActive">—</div><div class="lbl">Active Now</div></div>
      <div class="stat-card"><div class="val" id="sUsers">—</div><div class="lbl">Total Users</div></div>
      <div class="stat-card"><div class="val" id="sOrders">—</div><div class="lbl">Total Orders</div></div>
    </div>

    <div class="section">
      <div class="section-title" style="justify-content:space-between">
        <span>Restaurants</span>
        <input class="search-bar" placeholder="Search by name..." oninput="filterRestaurants(this.value)" />
      </div>
      <table>
        <thead>
          <tr><th>Name</th><th>Owner</th><th>City</th><th>Plan</th><th>Status</th><th>Payment</th><th>Joined</th><th>Actions</th></tr>
        </thead>
        <tbody id="restTable"></tbody>
      </table>
    </div>
  </div>
</div>

<div class="toast" id="toast">Saved!</div>

<script>
let TOKEN = localStorage.getItem('dovic_admin_token') || '';
let ALL_RESTAURANTS = [];

function showToast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#22c55e';
  t.style.color = color ? '#fff' : '#000';
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const data = await api('POST', '/admin/login', { username, password });
    TOKEN = data.token;
    localStorage.setItem('dovic_admin_token', TOKEN);
    showDashboard();
  } catch(e) {
    document.getElementById('loginErr').textContent = 'Invalid credentials';
  }
}

function logout() {
  localStorage.removeItem('dovic_admin_token');
  TOKEN = '';
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

async function showDashboard() {
  document.getElementById('loginWrap').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  setInterval(() => {
    document.getElementById('headerTime').textContent = new Date().toLocaleString('en-IN');
  }, 1000);
  await loadStats();
  await loadRestaurants();
}

async function loadStats() {
  try {
    const d = await api('GET', '/admin/stats');
    document.getElementById('sTotal').textContent = d.total_restaurants;
    document.getElementById('sActive').textContent = d.active_restaurants;
    document.getElementById('sUsers').textContent = d.total_users;
    document.getElementById('sOrders').textContent = d.total_orders.toLocaleString();
  } catch(e) { logout(); }
}

async function loadRestaurants() {
  try {
    ALL_RESTAURANTS = await api('GET', '/admin/restaurants');
    renderRestaurants(ALL_RESTAURANTS);
  } catch(e) {}
}

function filterRestaurants(q) {
  const filtered = ALL_RESTAURANTS.filter(r =>
    r.name.toLowerCase().includes(q.toLowerCase()) ||
    (r.owner_email || '').toLowerCase().includes(q.toLowerCase()) ||
    (r.city || '').toLowerCase().includes(q.toLowerCase())
  );
  renderRestaurants(filtered);
}

function planBadge(p) {
  return `<span class="badge badge-${p}">${p}</span>`;
}
function statusBadge(s) {
  return `<span class="badge badge-${s}">${s}</span>`;
}

function renderRestaurants(list) {
  const tbody = document.getElementById('restTable');
  tbody.innerHTML = list.map(r => `
    <tr>
      <td><strong style="color:#f1f5f9">${r.name}</strong><br><span style="color:#475569;font-size:11px">${r.phone || ''}</span></td>
      <td>${r.owner_name || '—'}<br><span style="color:#475569;font-size:11px">${r.owner_email || '—'}</span></td>
      <td>${r.city || '—'}</td>
      <td>
        <select class="inline" onchange="updateRestaurant(${r.id}, 'plan', this.value)">
          ${['starter','growth','pro','enterprise'].map(p => `<option ${r.plan===p?'selected':''} value="${p}">${p}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="inline" onchange="updateRestaurant(${r.id}, 'subscription_status', this.value)">
          ${['trial','active','suspended','cancelled'].map(s => `<option ${r.subscription_status===s?'selected':''} value="${s}">${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="inline" onchange="updateRestaurant(${r.id}, 'payment_status', this.value)">
          ${['pending','paid','overdue','free'].map(s => `<option ${r.payment_status===s?'selected':''} value="${s}">${s}</option>`).join('')}
        </select>
      </td>
      <td>${r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}</td>
      <td>
        ${r.is_active
          ? `<button class="action-btn danger" onclick="toggleRestaurant(${r.id}, false)">Suspend</button>`
          : `<button class="action-btn primary" onclick="toggleRestaurant(${r.id}, true)">Activate</button>`
        }
      </td>
    </tr>
  `).join('');
}

async function updateRestaurant(id, field, value) {
  try {
    await api('PATCH', `/admin/restaurants/${id}`, { [field]: value });
    showToast('Updated!');
    const r = ALL_RESTAURANTS.find(x => x.id === id);
    if (r) r[field] = value;
  } catch(e) {
    showToast('Error: ' + e.message, '#ef4444');
  }
}

async function toggleRestaurant(id, active) {
  try {
    await api('PATCH', `/admin/restaurants/${id}`, { is_active: active, subscription_status: active ? 'active' : 'suspended' });
    showToast(active ? 'Activated!' : 'Suspended!');
    await loadRestaurants();
  } catch(e) {
    showToast('Error', '#ef4444');
  }
}

// Auto-login if token exists
if (TOKEN) showDashboard();
</script>
</body>
</html>"""


@router.get("/admin", response_class=HTMLResponse)
def admin_panel():
    return HTMLResponse(content=ADMIN_HTML)
