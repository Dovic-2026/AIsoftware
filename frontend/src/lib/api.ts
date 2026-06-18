import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("dovic_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("dovic_token");
      localStorage.removeItem("dovic_user");
      localStorage.removeItem("dovic_restaurant");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: any) => api.post("/auth/register", data),
  login: (data: any) => api.post("/auth/login", data),
  setupRestaurant: (data: any) => api.post("/auth/restaurant/setup", data),
  me: () => api.get("/auth/me"),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: (restaurantId: number) => api.get(`/restaurants/${restaurantId}/dashboard/stats`),
};

// ─── Restaurant ──────────────────────────────────────────────────────────────
export const restaurantApi = {
  get: (id: number) => api.get(`/restaurants/${id}`),
  update: (id: number, data: any) => api.put(`/restaurants/${id}`, data),
  connectWhatsapp: (id: number, phone: string) => api.post(`/restaurants/${id}/connect-whatsapp?whatsapp_number=${phone}`),
  members: (id: number) => api.get(`/restaurants/${id}/members`),
  invite: (id: number, email: string, role: string) => api.post(`/restaurants/${id}/invite-member?email=${email}&role=${role}`),
};

// ─── Menu ────────────────────────────────────────────────────────────────────
export const menuApi = {
  categories: (rid: number) => api.get(`/restaurants/${rid}/menu/categories`),
  createCategory: (rid: number, data: any) => api.post(`/restaurants/${rid}/menu/categories`, data),
  items: (rid: number, params?: any) => api.get(`/restaurants/${rid}/menu/items`, { params }),
  createItem: (rid: number, data: any) => api.post(`/restaurants/${rid}/menu/items`, data),
  updateItem: (rid: number, id: number, data: any) => api.put(`/restaurants/${rid}/menu/items/${id}`, data),
  toggleItem: (rid: number, id: number) => api.patch(`/restaurants/${rid}/menu/items/${id}/toggle`),
  deleteItem: (rid: number, id: number) => api.delete(`/restaurants/${rid}/menu/items/${id}`),
  uploadImage: (rid: number, id: number, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return api.post(`/restaurants/${rid}/menu/items/${id}/image`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

// ─── Inventory ───────────────────────────────────────────────────────────────
export const inventoryApi = {
  ingredients: (rid: number, params?: any) => api.get(`/restaurants/${rid}/inventory/ingredients`, { params }),
  createIngredient: (rid: number, data: any) => api.post(`/restaurants/${rid}/inventory/ingredients`, data),
  updateIngredient: (rid: number, id: number, data: any) => api.put(`/restaurants/${rid}/inventory/ingredients/${id}`, data),
  transaction: (rid: number, data: any) => api.post(`/restaurants/${rid}/inventory/transactions`, data),
  transactions: (rid: number, params?: any) => api.get(`/restaurants/${rid}/inventory/transactions`, { params }),
  alerts: (rid: number) => api.get(`/restaurants/${rid}/inventory/alerts`),
};

// ─── Sales ───────────────────────────────────────────────────────────────────
export const salesApi = {
  orders: (rid: number, params?: any) => api.get(`/restaurants/${rid}/sales/orders`, { params }),
  createOrder: (rid: number, data: any) => api.post(`/restaurants/${rid}/sales/orders`, data),
  summary: (rid: number, period?: string) => api.get(`/restaurants/${rid}/sales/summary`, { params: { period } }),
  topItems: (rid: number, days?: number) => api.get(`/restaurants/${rid}/sales/top-items`, { params: { days } }),
  revenueChart: (rid: number, days?: number) => api.get(`/restaurants/${rid}/sales/revenue-chart`, { params: { days } }),
};

// ─── Expenses ────────────────────────────────────────────────────────────────
export const expensesApi = {
  list: (rid: number, params?: any) => api.get(`/restaurants/${rid}/expenses/`, { params }),
  create: (rid: number, data: any) => api.post(`/restaurants/${rid}/expenses/`, data),
  update: (rid: number, id: number, data: any) => api.put(`/restaurants/${rid}/expenses/${id}`, data),
  delete: (rid: number, id: number) => api.delete(`/restaurants/${rid}/expenses/${id}`),
  summary: (rid: number, month?: number, year?: number) => api.get(`/restaurants/${rid}/expenses/summary`, { params: { month, year } }),
};

// ─── Suppliers ───────────────────────────────────────────────────────────────
export const suppliersApi = {
  list: (rid: number) => api.get(`/restaurants/${rid}/suppliers/`),
  create: (rid: number, data: any) => api.post(`/restaurants/${rid}/suppliers/`, data),
  update: (rid: number, id: number, data: any) => api.put(`/restaurants/${rid}/suppliers/${id}`, data),
  payment: (rid: number, id: number, amount: number) => api.post(`/restaurants/${rid}/suppliers/${id}/payment?amount=${amount}`),
};

// ─── Staff ───────────────────────────────────────────────────────────────────
export const staffApi = {
  list: (rid: number) => api.get(`/restaurants/${rid}/staff/`),
  create: (rid: number, data: any) => api.post(`/restaurants/${rid}/staff/`, data),
  attendance: (rid: number, params?: any) => api.get(`/restaurants/${rid}/staff/attendance`, { params }),
  markAttendance: (rid: number, data: any) => api.post(`/restaurants/${rid}/staff/attendance`, data),
  bulkAttendance: (rid: number, data: any) => api.post(`/restaurants/${rid}/staff/attendance/bulk`, data),
  todaySummary: (rid: number) => api.get(`/restaurants/${rid}/staff/attendance/today-summary`),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  generate: (rid: number) => api.post(`/restaurants/${rid}/reports/generate`),
  list: (rid: number) => api.get(`/restaurants/${rid}/reports/`),
  getByDate: (rid: number, d: string) => api.get(`/restaurants/${rid}/reports/${d}`),
  query: (rid: number, data: any) => api.post(`/restaurants/${rid}/reports/query`, data),
};

// ─── WhatsApp ────────────────────────────────────────────────────────────────
export const waApi = {
  test: (phone: string, message: string) => api.post(`/webhook/whatsapp/test?phone=${phone}&message=${encodeURIComponent(message)}`),
};
