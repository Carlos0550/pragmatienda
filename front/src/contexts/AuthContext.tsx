// Re-exports from store for backward compatibility
import { useAuthStore, useIsAdmin, useIsCustomer, useIsSuperAdmin } from '@/stores/auth';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const billingRequired = useAuthStore((s) => s.billingRequired);
  const passwordSetupToken = useAuthStore((s) => s.passwordSetupToken);
  const setBillingRequired = useAuthStore((s) => s.setBillingRequired);
  const setPasswordSetupToken = useAuthStore((s) => s.setPasswordSetupToken);
  const loginAdmin = useAuthStore((s) => s.loginAdmin);
  const loginCustomer = useAuthStore((s) => s.loginCustomer);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useIsAdmin();
  const isSuperAdmin = useIsSuperAdmin();
  const isCustomer = useIsCustomer();
  return {
    user,
    loading,
    billingRequired,
    passwordSetupToken,
    setBillingRequired,
    setPasswordSetupToken,
    loginAdmin,
    loginCustomer,
    logout,
    isAdmin,
    isSuperAdmin,
    isCustomer,
  };
}
