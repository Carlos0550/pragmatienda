import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import { useTenantStore } from "@/stores/tenant";
import { useAuthStore } from "@/stores/auth";

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
