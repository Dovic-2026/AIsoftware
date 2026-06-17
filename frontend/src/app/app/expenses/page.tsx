"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { expensesApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

const CATEGORIES = ["Ingredients", "Utilities", "Rent", "Staff", "Equipment", "Marketing", "Maintenance", "Other"];
const CAT_ICONS: any = { Ingredients: "🥬", Utilities: "💡", Rent: "🏠", Staff: "👥", Equipment: "🔧", Marketing: "📢", Maintenance: "🛠️", Other: "📦" };

function Sheet({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full rounded-t-[28px] max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-5 sticky top-3" />
        <div className="text-[18px] font-extrabold text-gray-900 px-5 pb-4 border-b border-gray-100">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const { restaurant } = useAuthStore();
  const [showSheet, setShowSheet] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const now = new Date();
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", restaurant?.id, now.getMonth() + 1, now.getFullYear()],
    queryFn: () => expensesApi.list(restaurant!.id, { month: now.getMonth() + 1, year: now.getFullYear() }).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { data: summary } = useQuery({
    queryKey: ["expenses-summary", restaurant?.id, now.getMonth() + 1, now.getFullYear()],
    queryFn: () => expensesApi.summary(restaurant!.id, now.getMonth() + 1, now.getFullYear()).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { mutate: createExpense, isPending } = useMutation({
    mutationFn: (data: any) => expensesApi.create(restaurant!.id, { ...data, amount: parseFloat(data.amount) }),
    onSuccess: () => { toast.success("Expense recorded!"); setShowSheet(false); reset(); qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: () => toast.error("Failed to record expense"),
  });

  const filtered = filterCat ? expenses.filter((e: any) => e.category === filterCat) : expenses;
  const total = summary?.total || expenses.reduce((s: number, e: any) => s + e.amount, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[20px] font-extrabold text-gray-900">Expenses</div>
            <div className="text-[12px] text-gray-400">₹{total?.toLocaleString()} this month</div>
          </div>
          <button onClick={() => setShowSheet(true)} className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm">+ Add</button>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scroll">
          <button onClick={() => setFilterCat("")} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold ${!filterCat ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-500"}`}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setFilterCat(c === filterCat ? "" : c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap ${filterCat === c ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-500"}`}>
              {CAT_ICONS[c]} {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
        {isLoading ? Array(5).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl shimmer mb-3" />) :
          filtered.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">No expenses recorded</div> :
          filtered.map((exp: any) => (
            <div key={exp.id} className="bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 mb-3 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-[13px] bg-orange-50 flex items-center justify-center text-xl flex-shrink-0">
                {CAT_ICONS[exp.category] || "📦"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-gray-900">{exp.description}</div>
                <div className="text-[11px] text-gray-400">{exp.category} · {exp.created_at ? format(new Date(exp.created_at), "d MMM") : ""}</div>
              </div>
              <div className="text-[18px] font-extrabold text-red-500 flex-shrink-0">₹{exp.amount?.toLocaleString()}</div>
            </div>
          ))
        }
      </div>

      <Sheet open={showSheet} onClose={() => setShowSheet(false)} title="Record Expense">
        <form onSubmit={handleSubmit((d) => createExpense(d))} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input {...register("category", { required: true })} type="radio" value={c} className="sr-only peer" />
                  <div className="flex flex-col items-center gap-1 p-2 rounded-xl border-[1.5px] border-gray-200 peer-checked:border-[#25D366] peer-checked:bg-green-50 transition-all">
                    <span className="text-lg">{CAT_ICONS[c]}</span>
                    <span className="text-[9px] font-bold text-center text-gray-600 leading-tight">{c}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Description</label>
            <input {...register("description", { required: true })} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="e.g. Vegetables from market" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Amount (₹)</label>
            <input {...register("amount", { required: true })} type="number" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="0" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Payment Method</label>
            <select {...register("payment_method")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-3 text-[14px] outline-none focus:border-[#25D366]">
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
          <div className="bg-green-50 rounded-xl px-4 py-3 text-[12px] text-green-800">💡 Or WhatsApp: "Expense: Vegetables ₹3200"</div>
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={() => setShowSheet(false)} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : "Record"}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
