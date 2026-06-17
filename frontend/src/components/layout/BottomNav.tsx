"use client";
import { usePathname, useRouter } from "next/navigation";
import { WhatsAppIcon } from "@/components/ui/icons";

const TABS = [
  { href: "/app", label: "Home", emoji: "🏠" },
  { href: "/app/whatsapp", label: "WhatsApp", emoji: "💬", wa: true },
  { href: "/app/menu", label: "Menu", emoji: "🍽️" },
  { href: "/app/sales", label: "Sales", emoji: "💰" },
  { href: "/app/stock", label: "Stock", emoji: "📦" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="h-[72px] bg-white border-t border-gray-100 flex items-center px-2 pb-2 flex-shrink-0">
      {TABS.map((tab) => {
        const active = tab.href === "/app" ? pathname === "/app" : pathname.startsWith(tab.href);
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl transition-all ${active ? "bg-green-50" : "active:bg-gray-50"}`}
          >
            {tab.wa ? (
              <WhatsAppIcon className="w-6 h-6" fill={active ? "#128C7E" : "#9CA3AF"} />
            ) : (
              <span className="text-[22px] leading-none">{tab.emoji}</span>
            )}
            <span className={`text-[10px] font-semibold ${active ? "text-[#128C7E]" : "text-gray-400"}`}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
