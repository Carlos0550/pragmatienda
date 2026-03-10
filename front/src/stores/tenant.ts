import { create } from 'zustand';
import { api } from '@/services/api';
import { http } from '@/services/http';
import { normalizeResolvedTenant } from '@/lib/api-utils';
import type { TenantState } from '@/types';

const LANDING_HOSTNAMES = ['pragmatienda.com', 'www.pragmatienda.com', 'localhost'];
/** Sufijos para URLs de despliegue (Northflank *.code.run, etc.) que se tratan como landing. */
const LANDING_HOSTNAME_SUFFIXES = ['.code.run'];

function isLandingHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (LANDING_HOSTNAMES.includes(lower)) return true;
  return LANDING_HOSTNAME_SUFFIXES.some((s) => lower.endsWith(s) || lower === s.slice(1));
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  loading: true,
  error: null,
  isLandingDomain: false,
  storeNotFound: false,

  resolveTenantByHostname: async (hostnameInput: string) => {
    set({ loading: true, error: null, isLandingDomain: false, storeNotFound: false });
    const hostname = hostnameInput.toLowerCase();

    // Dominio raíz del sistema: siempre mostrar landing, no llamar al resolve
    if (isLandingHostname(hostname)) {
      api.setTenantId(null);
      set({ tenant: null, loading: false, error: null, isLandingDomain: true, storeNotFound: false });
      return;
    }

    try {
      const res = await http.tenant.resolveByUrl(hostname);
      const tenant = normalizeResolvedTenant(res);
      if (tenant) {
        api.setTenantId(tenant.id);
        set({ tenant, loading: false, error: null, isLandingDomain: false, storeNotFound: false });
      } else {
        api.setTenantId(null);
        set({ tenant: null, loading: false, error: null, isLandingDomain: false, storeNotFound: true });
      }
    } catch {
      api.setTenantId(null);
      set({ tenant: null, loading: false, error: null, isLandingDomain: false, storeNotFound: true });
    }
  },

  resolveTenant: async () => {
    if (typeof window === 'undefined') {
      set({ loading: false });
      return;
    }
    await useTenantStore.getState().resolveTenantByHostname(window.location.hostname);
  },
}));
