"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { suppliersApi } from "@/lib/api";
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

export default function SuppliersPage() {
  const { restaurant } = useAuthStore();
  const [showAdd, setShowAdd] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();
  const { register: regPay, handleSubmit: hsPay, reset: resetPay } = useForm();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", restaurant?.id],
    queryFn: () => suppliersApi.list(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { mutate: createSupplier, isPending } = useMutation({
    mutationFn: (data: any) => suppliersApi.create(restaurant!.id, data),
    onSuccess: () => { toast.success("Supplier added!"); setShowAdd(false); reset(); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: () => toast.error("Failed to add supplier"),
  });

  const { mutate: paySupplier, isPending: payPending } = useMutation({
    mutationFn: ({ id, amount }: any) => suppliersApi.payment(restaurant!.id, id, parseFloat(amount)),
    onSuccess: () => { toast.success("Payment recorded!"); setPayingId(null); resetPay(); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: () => toast.error("Failed to record payment"),
  });

  const totalDues = suppliers.reduce((s: number, sup: any) => s + (sup.outstanding_balance || 0), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[20px] font-extrabold text-gray-900">Suppliers</div>
            <div className="text-[12px] text-red-500 font-semibold">Total dues: ₹{totalDues?.toLocaleString()}</div>
          </div>
          <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm">+ Add</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
        {isLoading ? Array(4).fill(0).map((_, i) => <div key={i} className="h-28 rounded-2xl shimmer mb-3" />) :
          suppliers.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">No suppliers added</div> :
          suppliers.map((sup: any) => (
            <div key={sup.id} className="bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 mb-3 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[15px] font-extrabold text-gray-900">{sup.name}</div>
                  <div className="text-[12px] text-gray-400">{sup.contact_person} · {sup.phone}</div>
                </div>
                {sup.outstanding_balance > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-1.5 text-right">
                    <div className="text-[10px] text-red-400 font-semibold">Dues</div>
                    <div className="text-[16px] font-extrabold text-red-500">₹{sup.outstanding_balance?.toLocaleString()}</div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-gray-100 text-gray-600 font-semibold px-2 py-1 rounded-full">{sup.category}</span>
                <div className="flex-1" />
                <button onClick={() => window.open(`tel:${sup.phone}`)} className="px-3 py-2 rounded-xl bg-gray-50 text-[12px] font-semibold text-gray-700">📞 Call</button>
                {sup.outstanding_balance > 0 && (
                  <button onClick={() => setPayingId(sup.id)} className="px-3 py-2 rounded-xl bg-green-50 text-[12px] font-semibold text-green-700">💸 Pay</button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add Supplier">
        <form onSubmit={handleSubmit((d) => createSupplier(d))} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Company Name</label>
            <input {...register("name", { required: true })} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="e.g. Fresh Farm Veggies" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Contact Person</label>
              <input {...register("contact_person")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="Name" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Phone</label>
              <input {...register("phone")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="9876543210" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Category</label>
            <select {...register("category")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-3 text-[14px] outline-none focus:border-[#25D366]">
              <option>Vegetables</option><option>Meat</option><option>Dairy</option><option>Spices</option><option>Beverages</option><option>Packaging</option><option>Other</option>
            </select>
          </div>
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : "Add Supplier"}
            </button>
          </div>
        </form>
      </Sheet>

      <Sheet open={!!payingId} onClose={() => setPayingId(null)} title="Record Payment">
        <form onSubmit={hsPay((d) => paySupplier({ id: payingId, amount: d.amount }))} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Amount Paid (₹)</label>
            <input {...regPay("amount", { required: true })} type="number" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="0" />
          </div>
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={() => setPayingId(null)} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={payPending} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {payPending ? <Spinner /> : "Confirm Payment"}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
