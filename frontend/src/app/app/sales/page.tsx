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

function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-5 animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full rounded-[24px] shadow-xl animate-slide-up">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="text-[16px] font-extrabold text-gray-900">{title}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

const TABS = ["Orders", "Deletion Log"] as const;

export default function SalesPage() {
  const { restaurant } = useAuthStore();
  const [period, setPeriod] = useState<typeof PERIODS[number]>("today");
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Orders");
  const [showSheet, setShowSheet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();
  const isOwner = restaurant?.role === "owner" || restaurant?.role === "manager";

  const today = format(new Date(), "yyyy-MM-dd");
  const [logDate, setLogDate] = useState(today);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales", restaurant?.id, period],
    queryFn: () => salesApi.orders(restaurant!.id, { period }).then((r) => r.data),
    enabled: !!restaurant?.id && activeTab === "Orders",
  });

  const { data: summary } = useQuery({
    queryKey: ["sales-summary", restaurant?.id, period],
    queryFn: () => salesApi.summary(restaurant!.id, period).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { data: deletionLog = [], isLoading: logLoading } = useQuery({
    queryKey: ["deletion-log", restaurant?.id, logDate],
    queryFn: () => salesApi.deletionLog(restaurant!.id, logDate).then((r) => r.data),
    enabled: !!restaurant?.id && activeTab === "Deletion Log",
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

  const { mutate: deleteOrder, isPending: isDeleting } = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason: string }) =>
      salesApi.deleteOrder(restaurant!.id, orderId, reason),
    onSuccess: () => {
      toast.success("Order deleted & logged");
      setDeleteTarget(null);
      setDeleteReason("");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["deletion-log"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Failed to delete order"),
  });

  const payColors: any = { upi: "bg-blue-50 text-blue-700", cash: "bg-orange-50 text-orange-700", card: "bg-green-50 text-green-700" };

  const handleDownloadPdf = () => {
    const url = salesApi.deletionLogPdfUrl(restaurant!.id, logDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("dovic_token") : null;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `deletion_log_${logDate}.pdf`;
        a.click();
      })
      .catch(() => toast.error("Failed to download PDF"));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[20px] font-extrabold text-gray-900">Sales</div>
            <div className="text-[12px] text-gray-400">₹{summary?.total_revenue?.toLocaleString() || 0} this {period}</div>
          </div>
          {activeTab === "Orders" && (
            <button onClick={() => setShowSheet(true)} className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm">+ New</button>
          )}
          {activeTab === "Deletion Log" && isOwner && (
            <button onClick={handleDownloadPdf} className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-[12px] font-bold border border-red-100">📥 PDF</button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${activeTab === t ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>
              {t}
            </button>
          ))}
        </div>

        {activeTab === "Orders" && (
          <div className="flex bg-gray-100 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${period === p ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}

        {activeTab === "Deletion Log" && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500">Date:</span>
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} max={today}
              className="flex-1 border-[1.5px] border-gray-200 rounded-xl px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[#25D366]" />
          </div>
        )}
      </div>

      {/* Summary Row */}
      {activeTab === "Orders" && (
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
      )}

      {/* Orders List */}
      {activeTab === "Orders" && (
        <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
          {isLoading ? Array(5).fill(0).map((_, i) => <div key={i} className="h-24 rounded-2xl shimmer mb-3" />) :
            orders.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">No orders for this period</div> :
            orders.map((order: any) => {
              const pm = order.payment_method?.toLowerCase() || "cash";
              return (
                <div key={order.id} className="bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 mb-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[14px] font-extrabold text-gray-900">{order.order_number}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-gray-400">{order.created_at ? format(new Date(order.created_at), "h:mm a") : ""} · {order.table_number || "Takeaway"}</div>
                      {isOwner && (
                        <button onClick={() => { setDeleteTarget(order); setDeleteReason(""); }}
                          className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 text-[14px] hover:bg-red-100 active:scale-95 transition-all">
                          🗑️
                        </button>
                      )}
                    </div>
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
      )}

      {/* Deletion Log Tab */}
      {activeTab === "Deletion Log" && (
        <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
          {!isOwner ? (
            <div className="text-center py-16 text-gray-400 text-sm">Owner access only</div>
          ) : logLoading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-28 rounded-2xl shimmer mb-3" />)
          ) : deletionLog.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No deleted orders for {logDate}</div>
          ) : (
            <>
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-3 flex items-center gap-3">
                <span className="text-2xl">🗑️</span>
                <div>
                  <div className="text-[13px] font-extrabold text-red-700">{deletionLog.length} order{deletionLog.length !== 1 ? "s" : ""} deleted</div>
                  <div className="text-[11px] text-red-500">Total: ₹{deletionLog.reduce((a: number, l: any) => a + l.order_total, 0).toLocaleString()}</div>
                </div>
              </div>
              {deletionLog.map((log: any) => (
                <div key={log.id} className="bg-white border-[1.5px] border-red-100 rounded-[18px] p-4 mb-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[13px] font-extrabold text-gray-900">{log.order_number}</div>
                    <div className="text-[11px] text-gray-400">{log.deleted_at ? format(new Date(log.deleted_at), "h:mm a") : ""}</div>
                  </div>
                  <div className="text-[11px] text-gray-500 mb-2 leading-relaxed">
                    {log.order_items?.map((i: any) => `${i.name} ×${i.qty}`).join(", ") || "-"}
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[16px] font-extrabold text-red-600">₹{log.order_total?.toLocaleString()}</div>
                    <span className="text-[11px] text-gray-400">{log.table_number || "Takeaway"} · {(log.payment_method || "").toUpperCase()}</span>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Reason</div>
                    <div className="text-[12px] text-gray-700">{log.reason || "No reason given"}</div>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-2">Deleted by: {log.deleted_by || "Unknown"}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* New Order Sheet */}
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

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Order?">
        <div className="px-5 py-4 space-y-4">
          <div className="bg-red-50 rounded-2xl px-4 py-3">
            <div className="text-[14px] font-extrabold text-red-700">{deleteTarget?.order_number}</div>
            <div className="text-[12px] text-red-500 mt-0.5">₹{deleteTarget?.total_amount?.toLocaleString()} · {deleteTarget?.items?.map((i: any) => `${i.item_name} ×${i.quantity}`).join(", ")}</div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Reason for deletion</label>
            <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={3}
              className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 outline-none focus:border-red-400 resize-none"
              placeholder="e.g. Customer cancelled, Wrong order entered..." />
          </div>
          <div className="flex gap-3 pb-1">
            <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button onClick={() => deleteOrder({ orderId: deleteTarget!.id, reason: deleteReason || "No reason given" })}
              disabled={isDeleting}
              className="flex-1 py-3.5 rounded-xl bg-red-500 text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {isDeleting ? <Spinner /> : "🗑️ Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
