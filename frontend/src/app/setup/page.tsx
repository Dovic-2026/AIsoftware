"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

const STEPS = ["Restaurant Info", "WhatsApp Setup", "Ready!"];

export default function SetupPage() {
  const router = useRouter();
  const { user, restaurant, setRestaurant } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const onRestaurantSubmit = async (data: any) => {
    setLoading(true);
    try {
      const res = await authApi.setupRestaurant(data);
      setRestaurantData(res.data);
      setRestaurant({ id: res.data.id, name: res.data.name, slug: res.data.slug, plan: res.data.plan, role: "owner" });
      toast.success("Restaurant created! 🎉");
      setStep(1);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  const goToApp = () => router.replace("/app");

  return (
    <div className="phone-shell bg-white">
      <div className="h-14 flex items-end justify-between px-7 pb-2.5 flex-shrink-0">
        <span className="text-[15px] font-bold">9:41</span>
        <div className="flex gap-1.5 items-center text-lg">📶🛜🔋</div>
      </div>

      {/* Progress */}
      <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i <= step ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-400"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-semibold ${i === step ? "text-gray-900" : "text-gray-400"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? "bg-[#25D366]" : "bg-gray-100"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll px-5 py-6">
        {step === 0 && (
          <form onSubmit={handleSubmit(onRestaurantSubmit)} className="space-y-4 animate-fade-in">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">Set up your restaurant</h2>
              <p className="text-sm text-gray-500">Tell us about your restaurant</p>
            </div>

            {[
              { name: "name", label: "Restaurant Name", placeholder: "Spice Trail", required: true },
              { name: "phone", label: "Phone Number", placeholder: "+91 80123 45678", required: true },
              { name: "email", label: "Email (optional)", placeholder: "info@restaurant.com" },
              { name: "address", label: "Address", placeholder: "12, 5th Cross, Koramangala" },
              { name: "city", label: "City", placeholder: "Bangalore" },
              { name: "gst_number", label: "GST Number (optional)", placeholder: "29ABCDE1234F1Z5" },
            ].map((f) => (
              <div key={f.name}>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{f.label}</label>
                <input
                  {...register(f.name, f.required ? { required: `${f.label} is required` } : {})}
                  className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 text-[15px] text-gray-900 outline-none focus:border-[#25D366] transition-colors"
                  placeholder={f.placeholder}
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Restaurant Type</label>
              <select {...register("restaurant_type")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 text-[15px] text-gray-900 outline-none focus:border-[#25D366]">
                <option value="restaurant">Full Service Restaurant</option>
                <option value="qsr">Quick Service Restaurant (QSR)</option>
                <option value="cafe">Cafe / Bakery</option>
                <option value="cloud_kitchen">Cloud Kitchen</option>
                <option value="dhaba">Dhaba</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95 transition-transform disabled:opacity-70 mt-2">
              {loading ? <Spinner /> : "Continue →"}
            </button>
          </form>
        )}

        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">Connect WhatsApp</h2>
            <p className="text-sm text-gray-500 mb-6">Your team will manage the restaurant through WhatsApp messages</p>

            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 mb-5">
              <div className="flex gap-3 items-center mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-lg">📱</div>
                <div>
                  <div className="text-sm font-bold text-green-900">DOVIC AI WhatsApp Bot</div>
                  <div className="text-xs text-green-700">Save this number to get started</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-[#128C7E]">+91 80-DOVIC-AI</div>
                <div className="text-xs text-gray-500 mt-1">(Replace with your Twilio number)</div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { num: 1, title: "Save the DOVIC AI number", desc: "Add +91 80-DOVIC-AI to your contacts as 'DOVIC AI'" },
                { num: 2, title: 'Send "Hi" to activate', desc: "Open WhatsApp and send 'Hi' to the DOVIC AI number" },
                { num: 3, title: "Your team is set up!", desc: "Staff can now record sales, check stock, and more via WhatsApp" },
              ].map((s) => (
                <div key={s.num} className="flex gap-3 items-start bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.num}</div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{s.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setStep(2)} className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-base font-bold shadow-lg shadow-green-200 active:scale-95 transition-transform">
              I've sent "Hi" — Continue →
            </button>
            <button onClick={() => setStep(2)} className="w-full py-3 mt-2 text-sm text-gray-400 text-center">
              Set up later
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="text-center animate-bounce-in pt-8">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-3">You're all set!</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              <strong className="text-gray-900">{restaurantData?.name || "Your restaurant"}</strong> is ready.<br />
              Your team can now manage everything via WhatsApp.
            </p>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 mb-8 text-left space-y-2">
              <div className="text-xs font-bold text-green-800 mb-3">✅ What your team can do now:</div>
              {["Record sales by WhatsApp message", "Check stock levels instantly", "Mark attendance with one message", "Get AI daily reports every morning", "Ask questions in Tamil, Hindi, or English"].map((f) => (
                <div key={f} className="text-xs text-green-700 flex items-center gap-2">
                  <span className="text-green-500">✓</span>{f}
                </div>
              ))}
            </div>
            <button onClick={goToApp} className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-base font-bold shadow-lg shadow-green-200 active:scale-95 transition-transform">
              Open Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
