import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
}

interface Restaurant {
  id: number;
  name: string;
  slug: string;
  plan: string;
  role: string;
  whatsapp_connected?: boolean;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  address?: string;
  gst_number?: string;
  restaurant_type?: string;
  cuisine_type?: string;
  whatsapp_number?: string;
  subscription_status?: string;
  payment_status?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  restaurant: Restaurant | null;
  _hasHydrated: boolean;
  setAuth: (token: string, user: User, restaurant?: Restaurant) => void;
  setRestaurant: (restaurant: Restaurant) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      restaurant: null,
      _hasHydrated: false,
      setAuth: (token, user, restaurant) => set({ token, user, restaurant: restaurant ?? null }),
      setRestaurant: (restaurant) => set({ restaurant }),
      logout: () => set({ token: null, user: null, restaurant: null }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "dovic_auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
