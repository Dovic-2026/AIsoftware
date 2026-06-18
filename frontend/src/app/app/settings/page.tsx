"use client";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { WhatsAppIcon } from "@/components/ui/icons";

const PLANS = [
  { name: "Starter", price: "₹199", desc: "1 branch, WhatsApp AI, Basic reports" },
  { name: "Growth", price: "₹599", desc: "3 branches, Advanced AI, Staff management" },
  { name: "Pro", price: "₹999", desc: "5 branches, Full AI, Priority support", current: true },
  { name: "Enterprise", price: "₹1,999", desc: "Unlimited, Custom AI, Dedicated manager" },
];

export default function SettingsPage() {
  const { user, restaurant, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => { logout(); router.replace("/login"); };

  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scroll">
      {/* Header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="text-[20px] font-extrabold text-gray-900">Settings</div>
        <div className="text-[12px] text-gray-400">Restaurant profile & account</div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Restaurant Info */}
        <div className="bg-white border-[1.5px] border-gray-100 rounded-[20px] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white text-2xl font-black">
              {restaurant?.name?.[0] || "R"}
            </div>
            <div>
              <div className="text-[17px] font-extrabold text-gray-900">{restaurant?.name}</div>
              <div className="text-[12px] text-gray-400">{restaurant?.city}, {restaurant?.state}</div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: "Phone", value: restaurant?.phone || "Not set" },
              { label: "Address", value: restaurant?.address || "Not set" },
              { label: "GST Number", value: restaurant?.gst_number || "Not set" },
            ].map((f) => (
              <div key={f.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-[12px] text-gray-400 font-semibold">{f.label}</span>
                <span className="text-[13px] font-semibold text-gray-700">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp Status */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-[1.5px] border-green-100 rounded-[20px] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center flex-shrink-0">
              <WhatsAppIcon className="w-6 h-6" fill="white" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-green-900">WhatsApp Connected</div>
              <div className="text-[11px] text-green-700">{restaurant?.whatsapp_number || "Business number active"}</div>
            </div>
            <div className="flex items-center gap-1 bg-green-100 rounded-full px-2.5 py-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-bold text-green-700">Active</span>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="bg-white border-[1.5px] border-gray-100 rounded-[20px] p-4 shadow-sm">
          <div className="text-[13px] font-extrabold text-gray-900 mb-3">Account</div>
          <div className="space-y-2">
            {[
              { label: "Name", value: user?.full_name },
              { label: "Email", value: user?.email },
              { label: "Role", value: restaurant?.role || "Owner" },
            ].map((f) => (
              <div key={f.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-[12px] text-gray-400 font-semibold">{f.label}</span>
                <span className="text-[13px] font-semibold text-gray-700 truncate ml-4 max-w-[55%] text-right">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription */}
        <div>
          <div className="text-[15px] font-extrabold text-gray-900 mb-3">Subscription Plans</div>
          <div className="space-y-2">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`border-[1.5px] rounded-[18px] p-4 flex items-center justify-between transition-all ${plan.current ? "border-[#25D366] bg-green-50" : "border-gray-100 bg-white"} shadow-sm`}>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-[14px] font-extrabold text-gray-900">{plan.name}</div>
                    {plan.current && <span className="text-[10px] bg-[#25D366] text-white font-bold px-2 py-0.5 rounded-full">CURRENT</span>}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{plan.desc}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[16px] font-extrabold text-gray-900">{plan.price}</div>
                  <div className="text-[10px] text-gray-400">/month</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full py-4 rounded-[18px] border-[1.5px] border-red-100 bg-red-50 text-red-600 text-[14px] font-bold">
          Sign Out
        </button>

        <div className="text-center text-[11px] text-gray-300 pb-2">DOVIC AI Restaurant OS v1.0</div>
      </div>
    </div>
  );
}
