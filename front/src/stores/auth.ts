import { create } from 'zustand';
import { api } from '@/services/api';
import { capitalizeName } from '@/lib/utils';
import type { User, Customer } from '@/types';

export type AuthUser = (User | Customer) & { type: 'admin' | 'customer' };

type UserMeData = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: number;
};

function toAuthUser(data: UserMeData): AuthUser {
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
  const res = await api.get<{ result?: { data?: UserMeData } }>('/user/me');
  const data = res.result?.data;
  if (!data) return null;
  return toAuthUser(data);
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  billingRequired: boolean;
  setBillingRequired: (v: boolean) => void;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginCustomer: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
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
    const res = await api.post<{ data?: { token?: string }; token?: string }>('/public/admin/login', { email, password });
    const token = res.data?.token ?? res.token;
    if (!token) throw new Error('No se recibió token');
    api.setToken(token);
    const user = await fetchUserFromMe();
    if (!user) throw new Error('No se pudo obtener el usuario');
    set({ user });
  },

  loginCustomer: async (email: string, password: string) => {
    const res = await api.post<{ result?: { data?: { token?: string } } }>('/public/login', { email, password });
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
  return user?.type === 'admin' && (user as User).role >= 1;
}

export function useIsSuperAdmin() {
  const user = useAuthStore((s) => s.user);
  return user?.type === 'admin' && (user as User).role === 9;
}

export function useIsCustomer() {
  const user = useAuthStore((s) => s.user);
  return user?.type === 'customer';
}
