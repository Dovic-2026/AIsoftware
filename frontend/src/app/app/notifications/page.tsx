"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { inventoryApi } from "@/lib/api";

export default function NotificationsPage() {
  const { restaurant } = useAuthStore();

  const { data: alerts } = useQuery({
    queryKey: ["inventory-alerts", restaurant?.id],
    queryFn: () => inventoryApi.alerts(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const critical = alerts?.critical || [];
  const low = alerts?.low || [];

  const notifications = [
    ...critical.map((i: any) => ({ type: "critical", icon: "🚨", title: `Critical: ${i.name}`, body: `Only ${i.current_stock} ${i.unit} left (min: ${i.min_stock_level})`, color: "border-red-100 bg-red-50" })),
    ...low.map((i: any) => ({ type: "low", icon: "⚠️", title: `Low Stock: ${i.name}`, body: `${i.current_stock} ${i.unit} remaining`, color: "border-yellow-100 bg-yellow-50" })),
    { type: "info", icon: "🤖", title: "AI Report Ready", body: "Your daily summary has been generated", color: "border-blue-100 bg-blue-50" },
    { type: "success", icon: "✅", title: "WhatsApp Connected", body: "Your team can manage via WhatsApp", color: "border-green-100 bg-green-50" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="text-[20px] font-extrabold text-gray-900">Notifications</div>
        <div className="text-[12px] text-gray-400">{notifications.length} alerts</div>
      </div>
      <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
        {notifications.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <div className="text-3xl mb-2">🎉</div>
            <div>All clear! No alerts.</div>
          </div>
        ) : notifications.map((n, i) => (
          <div key={i} className={`border-[1.5px] ${n.color} rounded-[18px] p-4 mb-3 flex items-start gap-3`}>
            <span className="text-2xl flex-shrink-0">{n.icon}</span>
            <div>
              <div className="text-[14px] font-bold text-gray-900">{n.title}</div>
              <div className="text-[12px] text-gray-500 mt-0.5">{n.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
