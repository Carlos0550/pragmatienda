import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/services/api';
import type { User, Customer } from '@/types';

type AuthUser = (User | Customer) & { type: 'admin' | 'customer' };

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  billingRequired: boolean;
  setBillingRequired: (v: boolean) => void;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginCustomer: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCustomer: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  billingRequired: false,
  setBillingRequired: () => {},
  loginAdmin: async () => {},
  loginCustomer: async () => {},
  logout: () => {},
  isAdmin: false,
  isSuperAdmin: false,
  isCustomer: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingRequired, setBillingRequired] = useState(false);

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
    localStorage.removeItem('pragmatienda_user');
  }, []);

  useEffect(() => {
    api.setOnUnauthorized(() => logout());
    api.setOnBillingRequired(() => setBillingRequired(true));

    const savedUser = localStorage.getItem('pragmatienda_user');
    const savedToken = localStorage.getItem('pragmatienda_token');
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        api.setToken(savedToken);
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, [logout]);

  const loginAdmin = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/public/admin/login', { email, password });
    api.setToken(res.token);
    const authUser: AuthUser = { ...res.user, type: 'admin' };
    setUser(authUser);
    localStorage.setItem('pragmatienda_user', JSON.stringify(authUser));
  };

  const loginCustomer = async (email: string, password: string) => {
    const res = await api.post<{ token: string; customer: Customer }>('/public/login', { email, password });
    api.setToken(res.token);
    const authUser: AuthUser = { ...res.customer, type: 'customer' };
    setUser(authUser);
    localStorage.setItem('pragmatienda_user', JSON.stringify(authUser));
  };

  const isAdmin = user?.type === 'admin' && (user as User).role >= 1;
  const isSuperAdmin = user?.type === 'admin' && (user as User).role === 9;
  const isCustomer = user?.type === 'customer';

  return (
    <AuthContext.Provider value={{
      user, loading, billingRequired, setBillingRequired,
      loginAdmin, loginCustomer, logout,
      isAdmin, isSuperAdmin, isCustomer,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
