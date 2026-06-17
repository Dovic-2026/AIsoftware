"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function RootPage() {
  const { token, restaurant } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.replace("/onboard");
    } else if (!restaurant) {
      router.replace("/setup");
    } else {
      router.replace("/app");
    }
  }, [token, restaurant, router]);

  return (
    <div className="phone-shell flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white text-2xl font-black mx-auto mb-4">D</div>
        <div className="text-sm text-gray-400">Loading DOVIC AI...</div>
      </div>
    </div>
  );
}
