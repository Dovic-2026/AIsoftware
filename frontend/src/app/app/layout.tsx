"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import BottomNav from "@/components/layout/BottomNav";
import InstallBanner from "@/components/InstallBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token, restaurant, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Wait for Zustand to rehydrate from localStorage before redirecting
    if (!_hasHydrated) return;
    if (!token) router.replace("/login");
    else if (!restaurant) router.replace("/setup");
  }, [token, restaurant, _hasHydrated, router]);

  // Show spinner while store is hydrating — prevents flash-redirect to /login
  if (!_hasHydrated) {
    return (
      <div className="phone-shell bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center shadow-lg">
            <span className="text-3xl">🍽️</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!token || !restaurant) return null;

  return (
    <div className="phone-shell bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {children}
      </div>
      <div className="flex-shrink-0">
        <InstallBanner />
        <BottomNav />
      </div>
    </div>
  );
}
