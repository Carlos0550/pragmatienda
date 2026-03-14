import { create } from 'zustand';
import { api } from '@/services/api';
import { http } from '@/services/http';
import { normalizeResolvedTenant } from '@/lib/api-utils';
import { isLandingHostname } from '@/lib/storefront';
import type { TenantState } from '@/types';

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
