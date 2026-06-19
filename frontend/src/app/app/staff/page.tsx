"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { staffApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function Sheet({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full rounded-t-[28px] max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
        <div className="text-[18px] font-extrabold text-gray-900 px-5 pb-4 border-b border-gray-100">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function StaffPage() {
  const { restaurant } = useAuthStore();
  const isOwner = restaurant?.role === "owner" || restaurant?.role === "manager";
  const qc = useQueryClient();
  const now = new Date();

  const [tab, setTab] = useState<"team" | "report">("team");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [expandedStaff, setExpandedStaff] = useState<number | null>(null);
  const { register, handleSubmit, reset } = useForm();

  const { data: staffList = [], isLoading } = useQuery<any[]>({
    queryKey: ["staff", restaurant?.id],
    queryFn: () => staffApi.list(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { data: todaySummary } = useQuery<any>({
    queryKey: ["staff-today", restaurant?.id],
    queryFn: () => staffApi.todaySummary(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { data: monthlyReport, isLoading: loadingReport } = useQuery<any>({
    queryKey: ["staff-monthly", restaurant?.id, selectedMonth, selectedYear],
    queryFn: () => staffApi.monthlyReport(restaurant!.id, selectedMonth, selectedYear).then((r) => r.data),
    enabled: !!restaurant?.id && tab === "report",
  });

  const { mutate: addStaff, isPending: adding } = useMutation({
    mutationFn: (data: any) => staffApi.create(restaurant!.id, data),
    onSuccess: () => { toast.success("Employee added!"); setShowAdd(false); reset(); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: () => toast.error("Failed to add employee"),
  });

  const { mutate: removeStaff } = useMutation({
    mutationFn: (id: number) => staffApi.remove(restaurant!.id, id),
    onSuccess: () => { toast.success("Employee removed"); qc.invalidateQueries({ queryKey: ["staff"] }); },
  });

  const { mutate: markPresent } = useMutation({
    mutationFn: (staffId: number) => staffApi.markAttendance(restaurant!.id, {
      staff_member_id: staffId, date: new Date().toISOString().split("T")[0], status: "present",
    }),
    onSuccess: () => { toast.success("Marked present!"); qc.invalidateQueries({ queryKey: ["staff-today"] }); },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[20px] font-extrabold text-gray-900">Staff</h1>
            {todaySummary && (
              <p className="text-xs text-gray-400 mt-0.5">Today: {todaySummary.present}/{todaySummary.total} present</p>
            )}
          </div>
          {isOwner && (
            <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm">
              + Add
            </button>
          )}
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(["team", "report"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
              {t === "team" ? "👥 Team" : "📊 Monthly Report"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll">
        {tab === "team" && (
          <div className="px-4 py-3 space-y-3">
            {isLoading ? Array(3).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl shimmer" />) :
              (staffList as any[]).length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-gray-400 text-sm">No employees added yet</p>
                  {isOwner && <button onClick={() => setShowAdd(true)} className="mt-3 text-[#128C7E] font-semibold text-sm">+ Add first employee</button>}
                </div>
              ) : (staffList as any[]).map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white text-[18px] font-extrabold flex-shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-extrabold text-gray-900 truncate">{s.name}</p>
                      <p className="text-[12px] text-gray-500 capitalize">{s.role} · {s.phone || "No phone"}</p>
                    </div>
                    {isOwner && (
                      <div className="flex gap-2 items-center">
                        <button onClick={() => markPresent(s.id)}
                          className="px-3 py-1.5 bg-green-50 text-green-700 text-[11px] font-bold rounded-xl active:bg-green-100">
                          ✅ Present
                        </button>
                        <button onClick={() => { if (confirm(`Remove ${s.name}?`)) removeStaff(s.id); }}
                          className="w-8 h-8 flex items-center justify-center text-red-400 text-xl rounded-xl active:bg-red-50">
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            }

            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mt-2">
              <p className="text-[13px] font-bold text-green-900 mb-1">📱 WhatsApp Attendance</p>
              <p className="text-[12px] text-green-700 leading-relaxed">
                Employees text <strong>"Present today"</strong> to the DOVIC WhatsApp number. Owner gets notified instantly with name + time.
              </p>
              <p className="text-[11px] text-green-600 mt-1.5">⚠️ Phone number in app must match their WhatsApp number.</p>
            </div>
          </div>
        )}

        {tab === "report" && (
          <div className="px-4 py-3">
            <div className="flex gap-2 mb-4">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#25D366]">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#25D366]">
                {[now.getFullYear() - 1, now.getFullYear()].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {loadingReport ? (
              Array(3).fill(0).map((_, i) => <div key={i} className="h-24 rounded-2xl shimmer mb-3" />)
            ) : !monthlyReport?.staff?.length ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-sm">No records for {MONTHS[selectedMonth - 1]} {selectedYear}</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-3 text-center">
                  <p className="text-xs text-gray-400">{MONTHS[selectedMonth - 1]} {selectedYear} — Working Days</p>
                  <p className="text-[24px] font-extrabold text-gray-900">{monthlyReport.working_days}</p>
                </div>
                {(monthlyReport.staff as any[]).map((s: any) => (
                  <div key={s.staff_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
                    <button onClick={() => setExpandedStaff(expandedStaff === s.staff_id ? null : s.staff_id)}
                      className="w-full flex items-center gap-3 p-4 text-left">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white font-extrabold flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-extrabold text-gray-900">{s.name}</p>
                        <p className="text-[11px] text-gray-400 capitalize">{s.role}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[15px] font-extrabold text-gray-900">{s.present_days} <span className="text-xs text-gray-400 font-normal">/ {s.working_days} days</span></p>
                        <div className="flex items-center gap-1.5 justify-end mt-1">
                          <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#25D366] rounded-full transition-all" style={{ width: `${s.attendance_pct}%` }} />
                          </div>
                          <span className={`text-[11px] font-extrabold ${s.attendance_pct >= 75 ? "text-green-600" : "text-red-500"}`}>{s.attendance_pct}%</span>
                        </div>
                      </div>
                    </button>
                    {expandedStaff === s.staff_id && s.records.length > 0 && (
                      <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                        <div className="flex flex-wrap gap-1.5">
                          {s.records.map((r: any) => (
                            <div key={r.date} title={r.date}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${r.status === "present" ? "bg-green-100 text-green-700" : "bg-red-50 text-red-400"}`}>
                              {new Date(r.date).getDate()}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-2 text-[11px] font-bold">
                          <span className="text-green-600">✅ {s.present_days} Present</span>
                          <span className="text-red-400">❌ {s.absent_days} Absent</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <Sheet open={showAdd} onClose={() => { setShowAdd(false); reset(); }} title="Add Employee">
        <form onSubmit={handleSubmit((d) => addStaff(d))} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Full Name *</label>
            <input {...register("name", { required: true })} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="e.g. Ravi Kumar" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">WhatsApp Phone Number *</label>
            <input {...register("phone", { required: true })} type="tel" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="+91 98765 43210" />
            <p className="text-[11px] text-amber-600 mt-1 font-medium">⚠️ Enter their exact WhatsApp number for attendance to work</p>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Role *</label>
            <select {...register("role", { required: true })} className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-3 text-[14px] outline-none focus:border-[#25D366]">
              <option value="cook">👨‍🍳 Cook</option>
              <option value="waiter">🧑‍🍽️ Waiter</option>
              <option value="cashier">💰 Cashier</option>
              <option value="helper">🙋 Helper</option>
              <option value="manager">📋 Manager</option>
              <option value="delivery">🛵 Delivery</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Monthly Salary ₹ (optional)</label>
            <input {...register("salary")} type="number" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="e.g. 8000" />
          </div>
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); }} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={adding} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {adding ? <Spinner /> : "Add Employee"}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
