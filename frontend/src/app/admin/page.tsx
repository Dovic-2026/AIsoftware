"use client";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function adminApi(token: string) {
  return axios.create({
    baseURL: API,
    headers: { "Content-Type": "application/json", "X-Admin-Token": token },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats { total_restaurants: number; active_restaurants: number; total_users: number; total_orders: number; }
interface Restaurant { id: number; name: string; phone: string; city: string; plan: string; subscription_status: string; payment_status: string; is_active: boolean; owner_name: string; owner_email: string; created_at: string; }
interface User { id: number; full_name: string; email: string; phone: string; created_at: string; }

// ─── Modals ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div className="text-[15px] font-bold text-white">{title}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2.5 text-[14px] text-gray-200 outline-none focus:border-[#22c55e]";
const selCls = "w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2.5 text-[14px] text-gray-200 outline-none focus:border-[#22c55e]";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"restaurants" | "users">("restaurants");
  const [stats, setStats] = useState<Stats | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [editRest, setEditRest] = useState<Restaurant | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showResetModal, setShowResetModal] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (tok: string) => {
    const client = adminApi(tok);
    try {
      const [s, r] = await Promise.all([client.get("/admin/stats"), client.get("/admin/restaurants")]);
      setStats(s.data);
      setRestaurants(r.data);
    } catch { handleLogout(); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("dovic_admin_token");
    if (saved) { setToken(saved); setLoggedIn(true); load(saved); }
  }, [load]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin/login`, { username, password });
      const tok = res.data.token;
      localStorage.setItem("dovic_admin_token", tok);
      setToken(tok);
      setLoggedIn(true);
      await load(tok);
    } catch { toast.error("Invalid credentials"); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem("dovic_admin_token");
    setToken(""); setLoggedIn(false); setStats(null); setRestaurants([]); setUsers([]);
  };

  const loadUsers = async () => {
    const res = await adminApi(token).get("/admin/users");
    setUsers(res.data);
  };

  const updateRest = async (id: number, field: string, value: any) => {
    try {
      await adminApi(token).patch(`/admin/restaurants/${id}`, { [field]: value });
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
      toast.success("Updated!");
    } catch { toast.error("Update failed"); }
  };

  const toggleRest = async (r: Restaurant) => {
    const active = !r.is_active;
    await updateRest(r.id, "is_active", active);
    await updateRest(r.id, "subscription_status", active ? "active" : "suspended");
  };

  const saveEditRest = async () => {
    if (!editRest) return;
    try {
      await adminApi(token).patch(`/admin/restaurants/${editRest.id}`, {
        plan: editRest.plan,
        subscription_status: editRest.subscription_status,
        payment_status: editRest.payment_status,
      });
      setRestaurants(prev => prev.map(r => r.id === editRest.id ? { ...r, ...editRest } : r));
      toast.success("Restaurant updated!");
      setEditRest(null);
    } catch { toast.error("Update failed"); }
  };

  const deleteRest = async (r: Restaurant) => {
    if (!confirm(`PERMANENTLY DELETE "${r.name}"?\n\nThis deletes ALL data: menu, inventory, sales, staff.\nCANNOT be undone!`)) return;
    try {
      await adminApi(token).delete(`/admin/restaurants/${r.id}`);
      setRestaurants(prev => prev.filter(x => x.id !== r.id));
      const s = await adminApi(token).get("/admin/stats");
      setStats(s.data);
      toast.success("Deleted!");
    } catch (e: any) { toast.error(e.response?.data?.detail || "Delete failed"); }
  };

  const createUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password) { toast.error("Name, email and password required"); return; }
    try {
      await adminApi(token).post("/admin/users", newUser);
      toast.success("User created!");
      setShowCreateUser(false);
      setNewUser({ full_name: "", email: "", password: "", phone: "" });
      await loadUsers();
      const s = await adminApi(token).get("/admin/stats");
      setStats(s.data);
    } catch (e: any) { toast.error(e.response?.data?.detail || "Create failed"); }
  };

  const resetPassword = async () => {
    if (!showResetModal || newPassword.length < 6) { toast.error("Min 6 characters"); return; }
    try {
      await adminApi(token).patch(`/admin/users/${showResetModal.id}/reset-password`, { password: newPassword });
      toast.success("Password reset!");
      setShowResetModal(null);
      setNewPassword("");
    } catch { toast.error("Reset failed"); }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user "${u.full_name}"? Cannot be undone.`)) return;
    try {
      await adminApi(token).delete(`/admin/users/${u.id}`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      const s = await adminApi(token).get("/admin/stats");
      setStats(s.data);
      toast.success("User deleted!");
    } catch (e: any) { toast.error(e.response?.data?.detail || "Delete failed"); }
  };

  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.owner_email || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.city || "").toLowerCase().includes(search.toLowerCase())
  );

  // ── Login Screen ─────────────────────────────────────────────────────────────
  if (!loggedIn) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-10 w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="DOVIC" className="w-14 h-14 mx-auto mb-3" />
          <div className="text-[22px] font-black text-[#22c55e]">DOVIC AI</div>
          <div className="text-[13px] text-gray-500 mt-1">Super Admin Panel</div>
        </div>
        <Field label="Username">
          <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)}
            placeholder="dovic_admin" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </Field>
        <button onClick={handleLogin} disabled={loading}
          className="w-full mt-2 py-3 bg-[#22c55e] text-black font-bold rounded-xl text-[14px] hover:bg-[#16a34a] disabled:opacity-60">
          {loading ? "Signing in..." : "Sign In to Admin"}
        </button>
      </div>
    </div>
  );

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200">
      {/* Header */}
      <div className="bg-[#1e293b] border-b border-[#334155] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="DOVIC" className="w-8 h-8" />
          <span className="text-[16px] font-black text-[#22c55e]">DOVIC AI — Super Admin</span>
        </div>
        <button onClick={handleLogout} className="text-[13px] text-gray-400 hover:text-white bg-[#334155] px-4 py-2 rounded-lg">Sign Out</button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Restaurants", val: stats?.total_restaurants ?? "—" },
            { label: "Active Now", val: stats?.active_restaurants ?? "—" },
            { label: "Total Users", val: stats?.total_users ?? "—" },
            { label: "Total Orders", val: stats?.total_orders ?? "—" },
          ].map(s => (
            <div key={s.label} className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5">
              <div className="text-[28px] font-black text-white">{s.val}</div>
              <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(["restaurants", "users"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === "users") loadUsers(); }}
              className={`px-5 py-2 rounded-xl text-[13px] font-bold transition-colors ${tab === t ? "bg-[#22c55e] text-black" : "bg-[#1e293b] text-gray-400 hover:text-white"}`}>
              {t === "restaurants" ? "🏪 Restaurants" : "👤 Users"}
            </button>
          ))}
        </div>

        {/* Restaurants Tab */}
        {tab === "restaurants" && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]">
              <span className="font-bold text-white">Restaurants ({filtered.length})</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, city..."
                className="bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2 text-[13px] text-gray-200 outline-none focus:border-[#22c55e] w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    {["Name", "Owner", "City", "Plan", "Status", "Payment", "Joined", "Actions"].map(h => (
                      <th key={h} className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-[#0f172a] hover:bg-[#0f172a]/50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white text-[13px]">{r.name}</div>
                        <div className="text-[11px] text-gray-500">{r.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px]">{r.owner_name || "—"}</div>
                        <div className="text-[11px] text-gray-500">{r.owner_email || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-[13px]">{r.city || "—"}</td>
                      <td className="px-4 py-3">
                        <select value={r.plan} onChange={e => updateRest(r.id, "plan", e.target.value)}
                          className="bg-[#0f172a] border border-[#334155] rounded-lg px-2 py-1 text-[12px] text-gray-200">
                          {["starter","growth","pro","enterprise"].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={r.subscription_status} onChange={e => updateRest(r.id, "subscription_status", e.target.value)}
                          className="bg-[#0f172a] border border-[#334155] rounded-lg px-2 py-1 text-[12px] text-gray-200">
                          {["trial","active","suspended","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={r.payment_status} onChange={e => updateRest(r.id, "payment_status", e.target.value)}
                          className="bg-[#0f172a] border border-[#334155] rounded-lg px-2 py-1 text-[12px] text-gray-200">
                          {["pending","paid","overdue","free"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-400">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => toggleRest(r)}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold ${r.is_active ? "bg-red-900/40 text-red-400" : "bg-green-900/40 text-green-400"}`}>
                            {r.is_active ? "Suspend" : "Activate"}
                          </button>
                          <button onClick={() => setEditRest({ ...r })}
                            className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-900/40 text-blue-400">Edit</button>
                          <button onClick={() => deleteRest(r)}
                            className="px-3 py-1 rounded-lg text-[11px] font-bold bg-red-900/40 text-red-400">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No restaurants found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]">
              <span className="font-bold text-white">Users ({users.length})</span>
              <button onClick={() => setShowCreateUser(true)}
                className="px-4 py-2 bg-[#22c55e] text-black rounded-xl text-[13px] font-bold hover:bg-[#16a34a]">
                + Create User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    {["Name", "Email", "Phone", "Joined", "Actions"].map(h => (
                      <th key={h} className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-[#0f172a] hover:bg-[#0f172a]/50">
                      <td className="px-4 py-3 font-bold text-white text-[13px]">{u.full_name}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-400">{u.email}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-400">{u.phone || "—"}</td>
                      <td className="px-4 py-3 text-[12px] text-gray-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setShowResetModal(u); setNewPassword(""); }}
                            className="px-3 py-1 rounded-lg text-[11px] font-bold bg-[#334155] text-gray-300">
                            Reset Password
                          </button>
                          <button onClick={() => deleteUser(u)}
                            className="px-3 py-1 rounded-lg text-[11px] font-bold bg-red-900/40 text-red-400">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Restaurant Modal */}
      {editRest && (
        <Modal title="Edit Restaurant" onClose={() => setEditRest(null)}>
          <Field label="Restaurant Name">
            <input className={inputCls + " opacity-50 cursor-not-allowed"} value={editRest.name} readOnly />
          </Field>
          <Field label="Plan">
            <select className={selCls} value={editRest.plan} onChange={e => setEditRest({ ...editRest, plan: e.target.value })}>
              {["starter","growth","pro","enterprise"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Subscription Status">
            <select className={selCls} value={editRest.subscription_status} onChange={e => setEditRest({ ...editRest, subscription_status: e.target.value })}>
              {["trial","active","suspended","cancelled"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Payment Status">
            <select className={selCls} value={editRest.payment_status} onChange={e => setEditRest({ ...editRest, payment_status: e.target.value })}>
              {["pending","paid","overdue","free"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </Field>
          <div className="flex gap-2 mt-4">
            <button onClick={saveEditRest} className="flex-1 py-2.5 bg-[#22c55e] text-black font-bold rounded-xl text-[13px]">Save Changes</button>
            <button onClick={() => setEditRest(null)} className="flex-1 py-2.5 bg-[#334155] text-gray-300 font-bold rounded-xl text-[13px]">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <Modal title="Create New User" onClose={() => setShowCreateUser(false)}>
          <Field label="Full Name *"><input className={inputCls} value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} placeholder="Raj Sharma" /></Field>
          <Field label="Email *"><input className={inputCls} type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="raj@restaurant.com" /></Field>
          <Field label="Password * (min 6)"><input className={inputCls} type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="••••••••" /></Field>
          <Field label="Phone (optional)"><input className={inputCls} value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} placeholder="+91 98765 43210" /></Field>
          <div className="flex gap-2 mt-4">
            <button onClick={createUser} className="flex-1 py-2.5 bg-[#22c55e] text-black font-bold rounded-xl text-[13px]">Create User</button>
            <button onClick={() => setShowCreateUser(false)} className="flex-1 py-2.5 bg-[#334155] text-gray-300 font-bold rounded-xl text-[13px]">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <Modal title={`Reset Password — ${showResetModal.full_name}`} onClose={() => setShowResetModal(null)}>
          <Field label="New Password (min 6 chars)">
            <input className={inputCls} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" />
          </Field>
          <div className="flex gap-2 mt-4">
            <button onClick={resetPassword} className="flex-1 py-2.5 bg-[#22c55e] text-black font-bold rounded-xl text-[13px]">Reset Password</button>
            <button onClick={() => setShowResetModal(null)} className="flex-1 py-2.5 bg-[#334155] text-gray-300 font-bold rounded-xl text-[13px]">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
