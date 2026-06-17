"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { dashboardApi } from "@/lib/api";
import { format } from "date-fns";
import { WhatsAppIcon } from "@/components/ui/icons";

function KPICard({ icon, label, value, change, changeUp }: any) {
  return (
    <div className="bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 min-w-[140px] flex-shrink-0 shadow-sm">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[22px] font-extrabold text-gray-900">{value}</div>
      {change && <div className={`text-[11px] font-semibold mt-1 ${changeUp ? "text-green-500" : "text-red-500"}`}>{change}</div>}
    </div>
  );
}

function ActivityCard({ order }: { order: any }) {
  const payIcons: any = { upi: "📱", cash: "💵", card: "💳" };
  const payColors: any = { upi: "bg-blue-50 text-blue-700", cash: "bg-orange-50 text-orange-700", card: "bg-green-50 text-green-700" };
  const pm = order.payment_method?.toLowerCase() || "cash";
  return (
    <div className="bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 flex items-center gap-3 mx-4 mb-3 shadow-sm active:bg-gray-50 transition-colors cursor-pointer">
      <div className={`w-11 h-11 rounded-[13px] flex items-center justify-center text-xl flex-shrink-0 ${payColors[pm] || "bg-gray-50"}`}>{payIcons[pm] || "💰"}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-gray-900">{order.order_number} · {order.table_number || "Takeaway"}</div>
        <div className="text-[11px] text-gray-400 mt-0.5 truncate">{order.created_at ? format(new Date(order.created_at), "h:mm a") : ""}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[14px] font-extrabold text-gray-900">₹{order.total_amount?.toLocaleString()}</div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${payColors[pm] || "bg-gray-100 text-gray-500"}`}>{pm.toUpperCase()}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { restaurant, user, logout } = useAuthStore();
  const router = useRouter();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard", restaurant?.id],
    queryFn: () => dashboardApi.stats(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
    refetchInterval: 60000,
  });

  const formatCurrency = (v: number) => `₹${v?.toLocaleString() || 0}`;

  return (
    <div className="flex flex-col h-full">
      {/* App Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white text-sm font-black">
            {restaurant?.name?.[0] || "R"}
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-gray-900">{restaurant?.name}</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              WhatsApp Connected
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/app/notifications")} className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-lg relative">
            🔔
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">3</span>
          </button>
          <button onClick={() => router.push("/app/settings")} className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-lg">⚙️</button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scroll">
        {/* Greeting */}
        <div className="px-5 pt-4 pb-3 bg-white border-b border-gray-50">
          <div className="text-[22px] font-extrabold text-gray-900">Good morning, {user?.full_name?.split(" ")[0]} 👋</div>
          <div className="text-[13px] text-gray-400 mt-0.5">{format(new Date(), "EEEE, d MMMM yyyy")}</div>
        </div>

        {/* WhatsApp Banner */}
        <div className="mx-4 mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border-[1.5px] border-green-100 rounded-[20px] p-4 flex items-center gap-3 cursor-pointer active:scale-95 transition-transform" onClick={() => router.push("/app/whatsapp")}>
          <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center flex-shrink-0">
            <WhatsAppIcon className="w-7 h-7" fill="white" />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-bold text-green-900">WhatsApp is Active</div>
            <div className="text-[12px] text-green-700 mt-0.5 leading-snug">Your team can manage the restaurant by messaging DOVIC AI</div>
          </div>
          <div className="text-green-600 text-xl font-bold">›</div>
        </div>

        {/* KPI Cards */}
        <div className="flex gap-3 px-4 mt-4 overflow-x-auto hide-scroll pb-1">
          <KPICard icon="💵" label="Today's Revenue" value={isLoading ? "—" : formatCurrency(stats?.today_revenue || 0)} change={`${stats?.today_orders || 0} orders`} changeUp />
          <KPICard icon="🧾" label="Avg Order" value={isLoading ? "—" : formatCurrency(stats?.avg_order_value || 0)} change="per order" changeUp />
          <KPICard icon="⚠️" label="Low Stock" value={isLoading ? "—" : String(stats?.low_stock_count || 0)} change={stats?.low_stock_count ? "needs reorder" : "all ok"} changeUp={!stats?.low_stock_count} />
          <KPICard icon="👥" label="Staff Present" value={isLoading ? "—" : `${stats?.staff_present || 0}/${stats?.staff_total || 0}`} change={stats?.staff_present === stats?.staff_total ? "Full team!" : `${(stats?.staff_total || 0) - (stats?.staff_present || 0)} absent`} changeUp={stats?.staff_present === stats?.staff_total} />
        </div>

        {/* AI Insight */}
        <div className="mx-4 mt-4">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-[1.5px] border-indigo-100 rounded-[20px] p-4 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-[80px] opacity-5 font-black">AI</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl animate-pulse">🧠</div>
              <div>
                <div className="text-[14px] font-bold text-indigo-900">DOVIC AI · Daily Summary</div>
                <div className="text-[11px] text-indigo-600">Generated at 6:00 AM today</div>
              </div>
            </div>
            {stats ? (
              <div className="text-[13px] text-indigo-900 leading-relaxed">
                Revenue is <strong>₹{stats.today_revenue?.toLocaleString()}</strong> today.{" "}
                {stats.top_items?.[0] && <><strong>{stats.top_items[0].name}</strong> is your bestseller with {stats.top_items[0].quantity} orders. </>}
                {stats.low_stock_count > 0 && <><strong className="text-orange-700">{stats.low_stock_count} items</strong> need restocking.</>}
              </div>
            ) : (
              <div className="text-[13px] text-indigo-900 leading-relaxed">Analyzing your restaurant data...</div>
            )}
            <button onClick={() => router.push("/app/whatsapp")} className="mt-3 w-full py-2.5 text-xs font-bold text-indigo-800 bg-indigo-100 rounded-xl active:bg-indigo-200 transition-colors">
              Ask AI anything via WhatsApp →
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[16px] font-extrabold text-gray-900">Quick Actions</div>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scroll pb-1">
            {[
              { icon: "📲", label: "WA Sale", bg: "bg-green-50", onClick: () => router.push("/app/whatsapp") },
              { icon: "➕", label: "New Order", bg: "bg-blue-50", onClick: () => router.push("/app/sales?new=1") },
              { icon: "💸", label: "Expense", bg: "bg-orange-50", onClick: () => router.push("/app/expenses?new=1") },
              { icon: "📦", label: "Stock", bg: "bg-yellow-50", onClick: () => router.push("/app/stock") },
              { icon: "✅", label: "Attendance", bg: "bg-emerald-50", onClick: () => router.push("/app/staff?attendance=1") },
              { icon: "🤖", label: "AI Report", bg: "bg-purple-50", onClick: () => router.push("/app/reports") },
            ].map((qa) => (
              <div key={qa.label} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer" onClick={qa.onClick}>
                <div className={`w-14 h-14 rounded-[18px] ${qa.bg} flex items-center justify-center text-2xl active:scale-90 transition-transform`}>{qa.icon}</div>
                <span className="text-[10px] font-semibold text-gray-500 text-center whitespace-nowrap">{qa.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="mt-5">
          <div className="flex items-center justify-between px-4 mb-3">
            <div className="text-[16px] font-extrabold text-gray-900">Recent Orders</div>
            <button onClick={() => router.push("/app/sales")} className="text-[13px] text-[#128C7E] font-semibold">See all</button>
          </div>
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="mx-4 mb-3 h-16 rounded-[18px] shimmer" />
            ))
          ) : stats?.recent_orders?.length ? (
            stats.recent_orders.map((order: any) => <ActivityCard key={order.id} order={order} />)
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">No orders today yet</div>
          )}
        </div>

        {/* Supplier Dues */}
        {stats?.supplier_dues?.length > 0 && (
          <div className="mx-4 mt-4 mb-4">
            <div className="text-[16px] font-extrabold text-gray-900 mb-3">Supplier Dues</div>
            <div className="bg-white border-[1.5px] border-gray-100 rounded-[18px] divide-y divide-gray-50 shadow-sm overflow-hidden">
              {stats.supplier_dues.map((s: any) => (
                <div key={s.name} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-[13px] font-bold text-gray-900">{s.name}</div>
                    <div className="text-[11px] text-gray-400">{s.phone}</div>
                  </div>
                  <div className="text-[16px] font-extrabold text-red-500">₹{s.balance?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-5" />
      </div>
    </div>
  );
}
