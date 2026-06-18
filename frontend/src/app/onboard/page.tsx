"use client";
import { useRouter } from "next/navigation";
import { WhatsAppIcon } from "@/components/ui/icons";

const FEATURES = [
  { icon: "📲", bg: "bg-green-50", title: "Already on WhatsApp? You're ready.", desc: "Your team uses WhatsApp daily. Now record sales, check stock, and get AI reports — all by sending a message." },
  { icon: "🤖", bg: "bg-purple-50", title: "AI reports in plain language", desc: 'Ask "How much did we earn today?" or "What\'s running low?" and get instant answers in Tamil, Hindi, or English.' },
  { icon: "⚡", bg: "bg-yellow-50", title: "Works for your whole team", desc: "Chef records usage. Waiter records orders. Owner gets daily AI summary — each role has their own WhatsApp commands." },
  { icon: "📊", bg: "bg-pink-50", title: "Full dashboard when you need it", desc: "View charts, manage menu, and handle settings through this app for more detailed control." },
];

const TIERS = [
  { name: "Starter", price: "₹199", desc: "Menu & Sales · Basic Reports" },
  { name: "Growth", price: "₹599", desc: "+ Inventory · Suppliers · Staff" },
  { name: "Pro", price: "₹999", desc: "+ AI Reports · Analytics", highlight: true },
  { name: "Enterprise", price: "₹1,999", desc: "Multi-branch · White-label" },
];

export default function OnboardPage() {
  const router = useRouter();

  return (
    <div className="phone-shell bg-white">
      <div className="flex-1 overflow-y-auto hide-scroll">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] px-8 py-14 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -left-8 w-44 h-44 rounded-full bg-white/4" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="DOVIC AI" className="w-20 h-20 mx-auto mb-5 relative z-10 drop-shadow-xl" />
          <h1 className="text-2xl font-extrabold text-white leading-tight mb-3 relative z-10">Restaurant Management<br />through WhatsApp</h1>
          <p className="text-sm text-white/80 leading-relaxed relative z-10">DOVIC AI connects to your WhatsApp. Manage your entire restaurant by just sending messages — no new app to learn.</p>
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-2 mt-4 text-xs text-white font-semibold relative z-10">
            <WhatsAppIcon className="w-5 h-5" fill="white" />
            WhatsApp Powered · Zero Learning Curve
          </div>
        </div>

        {/* Features */}
        <div className="px-5 py-6 space-y-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex gap-3.5 items-start">
              <div className={`w-11 h-11 rounded-2xl ${f.bg} flex items-center justify-center text-2xl flex-shrink-0`}>{f.icon}</div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-1">{f.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tiers */}
        <div className="px-5 pb-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Choose Your Plan</div>
          <div className="grid grid-cols-2 gap-2.5">
            {TIERS.map((t) => (
              <div key={t.name} className={`rounded-2xl p-4 border-[1.5px] ${t.highlight ? "border-[#25D366] bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${t.highlight ? "text-[#128C7E]" : "text-gray-400"}`}>{t.name}</div>
                <div className={`text-xl font-extrabold mb-1 ${t.highlight ? "text-[#128C7E]" : "text-gray-900"}`}>{t.price}<span className="text-xs font-normal text-gray-400">/mo</span></div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="px-5 pb-8">
          <button
            onClick={() => router.push("/login?mode=register")}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-base font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-green-200 active:scale-95 transition-transform"
          >
            <WhatsAppIcon className="w-6 h-6" fill="white" />
            Get Started with WhatsApp
          </button>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3.5 rounded-2xl border-[1.5px] border-gray-200 text-gray-900 text-sm font-semibold mt-3 active:bg-gray-50 transition-colors"
          >
            Sign In to Existing Account
          </button>
          <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy.<br />
            Your WhatsApp data is end-to-end encrypted.
          </p>
        </div>
      </div>
    </div>
  );
}
