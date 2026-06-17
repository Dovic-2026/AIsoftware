"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import BottomNav from "@/components/layout/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token, restaurant } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!token) router.replace("/login");
    else if (!restaurant) router.replace("/setup");
  }, [token, restaurant, router]);

  if (!token || !restaurant) return null;

  return (
    <div className="phone-shell bg-gray-50 flex flex-col">
      {/* Status Bar */}
      <div className="h-14 bg-white flex items-end justify-between px-7 pb-2.5 flex-shrink-0 border-b border-gray-100">
        <span className="text-[15px] font-bold" id="status-time">9:41</span>
        <div className="flex gap-1.5 items-center text-lg">📶🛜🔋</div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
