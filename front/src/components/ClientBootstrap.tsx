import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import { useTenantStore } from "@/stores/tenant";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";

type ClientBootstrapProps = PropsWithChildren<{
  skipTenantBootstrap?: boolean;
  hydrateAuthFromCookie?: boolean;
}>;

export function ClientBootstrap({
  skipTenantBootstrap = false,
  hydrateAuthFromCookie = false,
  children,
}: ClientBootstrapProps) {
  useEffect(() => {
    void (async () => {
      if (typeof window !== 'undefined') {
        const currentUrl = new URL(window.location.href);
        const sessionToken = currentUrl.searchParams.get('sessionToken')?.trim() ?? '';
        const setupPasswordToken = currentUrl.searchParams.get('setupPasswordToken')?.trim() ?? '';
        const forcePasswordSetup = currentUrl.searchParams.get('forcePasswordSetup') === '1';

        if (sessionToken) {
          api.setToken(sessionToken);
        }

        if (forcePasswordSetup && setupPasswordToken) {
          useAuthStore.getState().setPasswordSetupToken(setupPasswordToken);
        }

        if (
          sessionToken ||
          setupPasswordToken ||
          currentUrl.searchParams.has('forcePasswordSetup') ||
          currentUrl.searchParams.has('verified')
        ) {
          currentUrl.searchParams.delete('sessionToken');
          currentUrl.searchParams.delete('setupPasswordToken');
          currentUrl.searchParams.delete('forcePasswordSetup');
          currentUrl.searchParams.delete('verified');
          window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
        }
      }

      if (!skipTenantBootstrap) {
        await useTenantStore.getState().resolveTenant();
      }
      if (!skipTenantBootstrap || hydrateAuthFromCookie) {
        await useAuthStore.getState().hydrate();
      } else {
        useAuthStore.setState({ loading: false });
      }
    })();
  }, [skipTenantBootstrap, hydrateAuthFromCookie]);

  return <>{children}</>;
}
