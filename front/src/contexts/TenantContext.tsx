// Re-exports from store for backward compatibility
import { useTenantStore } from '@/stores/tenant';

export function useTenant() {
  const tenant = useTenantStore((s) => s.tenant);
  const loading = useTenantStore((s) => s.loading);
  const error = useTenantStore((s) => s.error);
  const isLandingDomain = useTenantStore((s) => s.isLandingDomain);
  const storeNotFound = useTenantStore((s) => s.storeNotFound);
  return { tenant, loading, error, isLandingDomain, storeNotFound };
}
