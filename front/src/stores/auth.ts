import { create } from 'zustand';
import { api } from '@/services/api';
import { http } from '@/services/http';
import { capitalizeName } from '@/lib/utils';
import type { AuthState, AuthUser, User } from '@/types';

function toAuthUser(data: User): AuthUser {
  const type: 'admin' | 'customer' = data.role === 2 ? 'customer' : 'admin';
  const base = {
    id: data.id,
    name: capitalizeName(data.name),
    email: data.email,
    ...(data.phone && { phone: data.phone }),
  };
  if (type === 'admin') {
    return { ...base, role: data.role, type: 'admin' } as AuthUser;
  }
  return { ...base, type: 'customer' } as AuthUser;
}

async function fetchUserFromMe(): Promise<AuthUser | null> {
  const res = await http.auth.getMe();
  const data = res.result?.data;
  if (!data) return null;
  return toAuthUser(data);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  billingRequired: false,

  setBillingRequired: (v) => set({ billingRequired: v }),

  logout: () => {
    api.setToken(null);
    set({ user: null });
  },

  hydrate: async () => {
    api.setOnUnauthorized(() => get().logout());
    api.setOnBillingRequired(() => get().setBillingRequired(true));
    const token = api.getToken();
    if (token) {
      try {
        const user = await fetchUserFromMe();
        set({ user });
      } catch {
        get().logout();
      }
    }
    set({ loading: false });
  },

  loginAdmin: async (email: string, password: string) => {
    const res = await http.auth.loginAdmin({ email, password });
    const token = res.data?.token;
    if (!token) throw new Error('No se recibió token');
    api.setToken(token);
    const user = await fetchUserFromMe();
    if (!user) throw new Error('No se pudo obtener el usuario');
    set({ user });
  },

  loginCustomer: async (email: string, password: string) => {
    const res = await http.auth.loginCustomer({ email, password });
    const token = res.result?.data?.token;
    if (!token) throw new Error('No se recibió token');
    api.setToken(token);
    const user = await fetchUserFromMe();
    if (!user) throw new Error('No se pudo obtener el usuario');
    set({ user });
  },
}));

export function useIsAdmin() {
  const user = useAuthStore((s) => s.user);
  return user?.type === 'admin' && typeof user.role === 'number' && user.role >= 1;
}

export function useIsSuperAdmin() {
  const user = useAuthStore((s) => s.user);
  return user?.type === 'admin' && typeof user.role === 'number' && user.role === 9;
}

export function useIsCustomer() {
  const user = useAuthStore((s) => s.user);
  return user?.type === 'customer';
}
