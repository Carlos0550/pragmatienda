import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/services/api';
import type { Tenant } from '@/types';

interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  error: null,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveTenant = async () => {
      try {
        const currentDomain = window.location.hostname;
        const data = await api.get<Tenant>('/public/tenant/resolve', { url: currentDomain });
        setTenant(data);
        api.setTenantId(data.id);
      } catch {
        setError('No se pudo resolver la tienda');
      } finally {
        setLoading(false);
      }
    };
    resolveTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
