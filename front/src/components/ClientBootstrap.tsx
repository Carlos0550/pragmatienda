import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import { sileo } from "sileo";
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
      let shouldShowVerifiedWelcome = false;
      let shouldPromptPasswordSetup = false;

      if (typeof window !== 'undefined') {
        const currentUrl = new URL(window.location.href);
        const sessionToken = currentUrl.searchParams.get('sessionToken')?.trim() ?? '';
        const setupPasswordToken = currentUrl.searchParams.get('setupPasswordToken')?.trim() ?? '';
        const forcePasswordSetup = currentUrl.searchParams.get('forcePasswordSetup') === '1';
        const verified = currentUrl.searchParams.get('verified') === '1';

        shouldShowVerifiedWelcome = verified;
        shouldPromptPasswordSetup = forcePasswordSetup;

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

      if (shouldShowVerifiedWelcome) {
        const tenantName = useTenantStore.getState().tenant?.name?.trim();
        sileo.success({
          title: tenantName ? `Bienvenido a ${tenantName}` : '¡Bienvenido a tu tienda online!',
          description: shouldPromptPasswordSetup
            ? 'Tu cuenta ya fue verificada. Ahora definí tu contraseña para completar la activación.'
            : 'Tu cuenta ya fue verificada y ya podés empezar a configurar tu tienda.',
        });
      }
    })();
  }, [skipTenantBootstrap, hydrateAuthFromCookie]);

  return <>{children}</>;
}
