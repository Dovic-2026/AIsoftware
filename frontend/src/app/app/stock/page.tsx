"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { inventoryApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

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

function StockBar({ current, min, max }: { current: number; min: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = current <= min ? "bg-red-500" : current <= min * 2 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StockPage() {
  const { restaurant } = useAuthStore();
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ["ingredients", restaurant?.id, showLowOnly],
    queryFn: () => inventoryApi.ingredients(restaurant!.id, { low_stock_only: showLowOnly || undefined }).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { data: alerts } = useQuery({
    queryKey: ["inventory-alerts", restaurant?.id],
    queryFn: () => inventoryApi.alerts(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { mutate: restock, isPending } = useMutation({
    mutationFn: (data: any) => inventoryApi.transaction(restaurant!.id, {
      ingredient_id: parseInt(data.ingredient_id),
      type: "restock", quantity: parseFloat(data.quantity),
      unit_cost: data.cost ? parseFloat(data.cost) : undefined,
      notes: data.notes,
    }),
    onSuccess: () => { toast.success("Stock updated! ✅"); setShowSheet(false); reset(); qc.invalidateQueries({ queryKey: ["ingredients"] }); },
    onError: () => toast.error("Failed to update stock"),
  });

  const lowCount = alerts?.critical?.length + alerts?.low?.length || 0;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[20px] font-extrabold text-gray-900">Inventory</div>
            {lowCount > 0 && <div className="text-[12px] text-red-500 font-semibold">{lowCount} items need reorder</div>}
          </div>
          <button onClick={() => setShowSheet(true)} className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm">+ Restock</button>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setShowLowOnly(false)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${!showLowOnly ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>All Items</button>
          <button onClick={() => setShowLowOnly(true)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center gap-1 ${showLowOnly ? "bg-white shadow text-red-600" : "text-gray-400"}`}>
            ⚠️ Low Stock {lowCount > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{lowCount}</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
        {isLoading ? Array(8).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl shimmer mb-3" />) :
          ingredients.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">No inventory items</div> :
          ingredients.map((item: any) => {
            const isCritical = item.current_stock <= item.min_stock_level;
            const isLow = item.current_stock <= item.min_stock_level * 2;
            return (
              <div key={item.id} className={`bg-white border-[1.5px] rounded-[18px] p-4 mb-3 shadow-sm ${isCritical ? "border-red-100" : isLow ? "border-yellow-100" : "border-gray-100"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[14px] font-bold text-gray-900">{item.name}</div>
                  <div className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isCritical ? "bg-red-50 text-red-600" : isLow ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700"}`}>
                    {isCritical ? "Critical" : isLow ? "Low" : "OK"}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px] text-gray-500">
                  <span>{item.current_stock} {item.unit} <span className="text-gray-300">/ min {item.min_stock_level}</span></span>
                  <span className="text-gray-400">{item.supplier_name || "No supplier"}</span>
                </div>
                <StockBar current={item.current_stock} min={item.min_stock_level} max={item.min_stock_level * 5} />
              </div>
            );
          })
        }
      </div>

      <Sheet open={showSheet} onClose={() => setShowSheet(false)} title="Add Stock">
        <form onSubmit={handleSubmit((d) => restock(d))} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Ingredient</label>
            <select {...register("ingredient_id", { required: true })} className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-3 text-[14px] outline-none focus:border-[#25D366]">
              <option value="">Select ingredient...</option>
              {ingredients.map((i: any) => <option key={i.id} value={i.id}>{i.name} (current: {i.current_stock} {i.unit})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Quantity Added</label>
              <input {...register("quantity", { required: true })} type="number" step="0.1" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="0" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Cost (₹, optional)</label>
              <input {...register("cost")} type="number" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Notes</label>
            <input {...register("notes")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="Supplier, batch number..." />
          </div>
          <div className="bg-green-50 rounded-xl px-4 py-3 text-[12px] text-green-800">💡 Or WhatsApp: "Restock: Chicken 10kg"</div>
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={() => setShowSheet(false)} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : "Update Stock"}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
