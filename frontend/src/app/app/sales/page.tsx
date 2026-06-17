"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { salesApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

const PERIODS = ["today", "week", "month"] as const;

function Sheet({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full rounded-t-[28px] animate-slide-up">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-5" />
        <div className="text-[18px] font-extrabold text-gray-900 px-5 pb-4 border-b border-gray-100">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function SalesPage() {
  const { restaurant } = useAuthStore();
  const [period, setPeriod] = useState<typeof PERIODS[number]>("today");
  const [showSheet, setShowSheet] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales", restaurant?.id, period],
    queryFn: () => salesApi.orders(restaurant!.id, { period }).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { data: summary } = useQuery({
    queryKey: ["sales-summary", restaurant?.id, period],
    queryFn: () => salesApi.summary(restaurant!.id, period).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { mutate: createOrder, isPending } = useMutation({
    mutationFn: (data: any) => {
      const item = { item_name: data.items, quantity: parseInt(data.qty || 1), unit_price: parseFloat(data.amount) };
      return salesApi.createOrder(restaurant!.id, {
        table_number: data.table, payment_method: data.payment_method,
        total_amount: parseFloat(data.amount), discount: 0,
        items: [item],
      });
    },
    onSuccess: () => { toast.success("Sale recorded! ✅"); setShowSheet(false); reset(); qc.invalidateQueries({ queryKey: ["sales"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: () => toast.error("Failed to record sale"),
  });

  const payColors: any = { upi: "bg-blue-50 text-blue-700", cash: "bg-orange-50 text-orange-700", card: "bg-green-50 text-green-700" };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div><div className="text-[20px] font-extrabold text-gray-900">Sales</div><div className="text-[12px] text-gray-400">₹{summary?.total_revenue?.toLocaleString() || 0} this {period}</div></div>
          <button onClick={() => setShowSheet(true)} className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm">+ New Order</button>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${period === p ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Row */}
      <div className="flex gap-2.5 px-4 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        {[
          { label: "Revenue", value: `₹${(summary?.total_revenue || 0).toLocaleString()}` },
          { label: "Orders", value: String(summary?.total_orders || 0) },
          { label: "Avg Order", value: `₹${(summary?.avg_order_value || 0).toLocaleString()}` },
        ].map((s) => (
          <div key={s.label} className="flex-1 bg-white rounded-2xl px-3 py-3 text-center shadow-sm border border-gray-100">
            <div className="text-[17px] font-extrabold text-gray-900">{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 font-semibold">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
        {isLoading ? Array(5).fill(0).map((_, i) => <div key={i} className="h-24 rounded-2xl shimmer mb-3" />) :
          orders.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">No orders for this period</div> :
          orders.map((order: any) => {
            const pm = order.payment_method?.toLowerCase() || "cash";
            return (
              <div key={order.id} className="bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 mb-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[14px] font-extrabold text-gray-900">{order.order_number}</div>
                  <div className="text-[11px] text-gray-400">{order.created_at ? format(new Date(order.created_at), "h:mm a") : ""} · {order.table_number || "Takeaway"}</div>
                </div>
                <div className="text-[12px] text-gray-500 mb-3 leading-relaxed">
                  {order.items?.map((i: any) => `${i.item_name} ×${i.quantity}`).join(", ")}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[18px] font-extrabold text-gray-900">₹{order.total_amount?.toLocaleString()}</div>
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${payColors[pm] || "bg-gray-100 text-gray-500"}`}>{pm.toUpperCase()}</span>
                </div>
              </div>
            );
          })
        }
      </div>

      <Sheet open={showSheet} onClose={() => setShowSheet(false)} title="New Sale Order">
        <form onSubmit={handleSubmit((d) => createOrder(d))} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Table / Type</label>
              <select {...register("table")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-3 text-[14px] text-gray-900 outline-none focus:border-[#25D366]">
                {["T1","T2","T3","T4","T5","Takeaway","Delivery"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Payment</label>
              <select {...register("payment_method")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-3 text-[14px] text-gray-900 outline-none focus:border-[#25D366]">
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Items</label>
            <input {...register("items", { required: true })} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 outline-none focus:border-[#25D366]" placeholder="e.g. 2 Chicken Biryani, 1 Lassi" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Amount (₹)</label>
            <input {...register("amount", { required: true })} type="number" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 outline-none focus:border-[#25D366]" placeholder="0" />
          </div>
          <div className="bg-green-50 rounded-xl px-4 py-3 text-[12px] text-green-800">💡 Or WhatsApp: "Sale: 2 Biryani, 1 Lassi, ₹480, UPI, Table 3"</div>
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={() => setShowSheet(false)} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : "Record Sale"}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
