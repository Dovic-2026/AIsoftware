"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(params.get("mode") === "register" ? "register" : "login");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      let res;
      if (mode === "register") {
        res = await authApi.register(data);
      } else {
        res = await authApi.login(data);
      }
      const { access_token, user, restaurant } = res.data;
      localStorage.setItem("dovic_token", access_token);
      setAuth(access_token, user, restaurant);
      toast.success(`Welcome, ${user.full_name}! 👋`);
      if (!restaurant) {
        router.replace("/setup");
      } else {
        router.replace("/app");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-shell bg-white">
      <div className="h-14 flex items-end justify-between px-7 pb-2.5 flex-shrink-0">
        <span className="text-[15px] font-bold">9:41</span>
        <div className="flex gap-1.5 items-center text-lg">📶🛜🔋</div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll">
        <div className="bg-gradient-to-br from-[#075E54] to-[#25D366] px-8 py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-2xl font-black text-white mx-auto mb-4">D</div>
          <h1 className="text-xl font-extrabold text-white mb-1">DOVIC AI Restaurant OS</h1>
          <p className="text-sm text-white/75">Manage your restaurant via WhatsApp</p>
        </div>

        <div className="px-5 py-6">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === m ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  {...register("full_name", { required: "Name is required" })}
                  className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 text-[15px] text-gray-900 outline-none focus:border-[#25D366] transition-colors"
                  placeholder="Raj Sharma"
                />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{String(errors.full_name.message)}</p>}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                {...register("email", { required: "Email is required" })}
                type="email"
                className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 text-[15px] text-gray-900 outline-none focus:border-[#25D366] transition-colors"
                placeholder="owner@restaurant.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
              <input
                {...register("password", { required: "Password is required", minLength: { value: 6, message: "Min 6 characters" } })}
                type="password"
                className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 text-[15px] text-gray-900 outline-none focus:border-[#25D366] transition-colors"
                placeholder="••••••••"
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{String(errors.password.message)}</p>}
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  {...register("phone")}
                  type="tel"
                  className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 text-[15px] text-gray-900 outline-none focus:border-[#25D366] transition-colors"
                  placeholder="+91 98765 43210"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95 transition-transform disabled:opacity-70 mt-2"
            >
              {loading ? <Spinner /> : (mode === "login" ? "Sign In →" : "Create Account →")}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-5 p-4 bg-green-50 border border-green-100 rounded-2xl">
            <p className="text-xs font-bold text-green-800 mb-2">🎯 Demo Account</p>
            <p className="text-xs text-green-700">Email: <strong>owner@spicetrail.com</strong></p>
            <p className="text-xs text-green-700">Password: <strong>demo1234</strong></p>
            <button
              onClick={() => {
                const form = document.querySelector("form");
                const emailInput = form?.querySelector('input[type="email"]') as HTMLInputElement;
                const passInput = form?.querySelector('input[type="password"]') as HTMLInputElement;
                if (emailInput) emailInput.value = "owner@spicetrail.com";
                if (passInput) passInput.value = "demo1234";
                setMode("login");
                handleSubmit(onSubmit)({ email: "owner@spicetrail.com", password: "demo1234" });
              }}
              className="mt-2 w-full py-2 text-xs font-bold text-green-800 bg-green-100 rounded-xl active:bg-green-200 transition-colors"
            >
              Use Demo Account
            </button>
          </div>

          <button onClick={() => router.back()} className="w-full mt-4 text-sm text-gray-400 text-center py-2">
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="phone-shell flex items-center justify-center"><div className="text-sm text-gray-400">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
