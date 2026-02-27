import { create } from 'zustand';
import { api } from '@/services/api';
import { capitalizeName } from '@/lib/utils';
import type { Tenant } from '@/types';

const LANDING_HOSTNAMES = ['pragmatienda.com', 'www.pragmatienda.com', 'localhost'];

function isLandingHostname(hostname: string): boolean {
  return LANDING_HOSTNAMES.includes(hostname.toLowerCase());
}

/** Backend resolve returns { status, message, data?: { tenantId, businessName } } */
function normalizeResolveResponse(res: unknown): Tenant | null {
  if (!res || typeof res !== 'object') return null;
  const data = (res as { data?: { tenantId?: string; businessName?: string } }).data;
  if (!data?.tenantId) return null;
  const rawName = data.businessName ?? 'Tienda';
  const name = capitalizeName(rawName);
  const slug = rawName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return {
    id: data.tenantId,
    name,
    slug,
  };
}

interface TenantState {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  isLandingDomain: boolean;
  storeNotFound: boolean;
  resolveTenant: () => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  loading: true,
  error: null,
  isLandingDomain: false,
  storeNotFound: false,

  resolveTenant: async () => {
    set({ loading: true, error: null, isLandingDomain: false, storeNotFound: false });
    const hostname = window.location.hostname;

    // Dominio raíz del sistema: siempre mostrar landing, no llamar al resolve
    if (isLandingHostname(hostname)) {
      set({ tenant: null, loading: false, error: null, isLandingDomain: true, storeNotFound: false });
      return;
    }

    try {
      const res = await api.get<unknown>('/public/tenant/resolve', { url: hostname });
      const tenant = normalizeResolveResponse(res);
      if (tenant) {
        api.setTenantId(tenant.id);
        set({ tenant, loading: false, error: null, isLandingDomain: false, storeNotFound: false });
      } else {
        set({ tenant: null, loading: false, error: null, isLandingDomain: false, storeNotFound: true });
      }
    } catch {
      set({ tenant: null, loading: false, error: null, isLandingDomain: false, storeNotFound: true });
    }
  },
}));
