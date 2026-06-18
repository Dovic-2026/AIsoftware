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
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
