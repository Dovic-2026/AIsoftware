"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { staffApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

const ROLES = ["chef", "manager", "waiter", "cashier", "delivery", "cleaner"];
const STATUS_COLORS: any = { present: "bg-green-50 text-green-700", absent: "bg-red-50 text-red-600", half_day: "bg-yellow-50 text-yellow-700", leave: "bg-blue-50 text-blue-700" };

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

export default function StaffPage() {
  const { restaurant } = useAuthStore();
  const [tab, setTab] = useState<"staff" | "attendance">("staff");
  const [showAdd, setShowAdd] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", restaurant?.id],
    queryFn: () => staffApi.list(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { data: attendanceSummary } = useQuery({
    queryKey: ["attendance-today", restaurant?.id],
    queryFn: () => staffApi.todaySummary(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { mutate: createStaff, isPending } = useMutation({
    mutationFn: (data: any) => staffApi.create(restaurant!.id, { ...data, salary: parseFloat(data.salary || 0) }),
    onSuccess: () => { toast.success("Staff added!"); setShowAdd(false); reset(); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: () => toast.error("Failed to add staff"),
  });

  const { mutate: markAttendance } = useMutation({
    mutationFn: ({ staffId, status }: any) => staffApi.markAttendance(restaurant!.id, { staff_member_id: staffId, status, date: new Date().toISOString().split("T")[0] }),
    onSuccess: () => { toast.success("Attendance marked!"); qc.invalidateQueries({ queryKey: ["attendance-today"] }); },
    onError: () => toast.error("Failed to mark attendance"),
  });

  const presentCount = attendanceSummary?.present || 0;
  const totalCount = attendanceSummary?.total || staff.length;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[20px] font-extrabold text-gray-900">Staff</div>
            <div className="text-[12px] text-gray-400">{presentCount}/{totalCount} present today</div>
          </div>
          {tab === "staff" && <button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm">+ Add</button>}
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setTab("staff")} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${tab === "staff" ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>Team</button>
          <button onClick={() => setTab("attendance")} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${tab === "attendance" ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>Attendance</button>
        </div>
      </div>

      {tab === "staff" ? (
        <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
          {isLoading ? Array(6).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl shimmer mb-3" />) :
            staff.map((s: any) => (
              <div key={s.id} className="bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 mb-3 shadow-sm flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white text-[16px] font-extrabold flex-shrink-0">
                  {s.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-gray-900">{s.name}</div>
                  <div className="text-[12px] text-gray-400">{s.role} · {s.phone}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[13px] font-bold text-gray-700">₹{s.salary?.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">/ month</div>
                </div>
              </div>
            ))
          }
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-3 mb-3 text-[12px] text-green-800">
            💡 WhatsApp: "Present today" to mark yourself. Or "Absent: [Name]"
          </div>
          {staff.map((s: any) => {
            const todayRec = attendanceSummary?.records?.find((r: any) => r.staff_id === s.id);
            const status = todayRec?.status || "absent";
            return (
              <div key={s.id} className="bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 mb-3 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white text-[13px] font-extrabold flex-shrink-0">
                    {s.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-gray-900">{s.name}</div>
                    <div className="text-[11px] text-gray-400">{s.role}</div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[status] || "bg-gray-100 text-gray-500"}`}>
                    {status.replace("_", " ")}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {["present", "absent", "half_day", "leave"].map((st) => (
                    <button key={st} onClick={() => markAttendance({ staffId: s.id, status: st })}
                      className={`py-2 rounded-xl text-[10px] font-bold capitalize transition-all ${status === st ? "bg-[#25D366] text-white" : "bg-gray-50 text-gray-500 active:bg-gray-100"}`}>
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add Staff Member">
        <form onSubmit={handleSubmit((d) => createStaff(d))} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Full Name</label>
            <input {...register("name", { required: true })} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="Staff name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Role</label>
              <select {...register("role")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-3 text-[14px] outline-none focus:border-[#25D366]">
                {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Monthly Salary</label>
              <input {...register("salary")} type="number" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="₹0" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Phone</label>
            <input {...register("phone")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="9876543210" />
          </div>
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : "Add Staff"}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
