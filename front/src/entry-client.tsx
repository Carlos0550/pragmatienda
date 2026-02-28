import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HydrationBoundary, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sileo";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppRoutes } from "@/AppRoutes";
import { createAppQueryClient } from "@/lib/query-client";
import { getSsrBootstrapPayload } from "@/lib/ssr";
import { useTenantStore } from "@/stores/tenant";
import { useAuthStore } from "@/stores/auth";
import { ClientBootstrap } from "@/components/ClientBootstrap";
import "./index.css";

const queryClient = createAppQueryClient();
const ssrPayload = getSsrBootstrapPayload();
const shouldUseSsrBootstrap = Boolean(ssrPayload && ssrPayload.routeKind !== "spa");

let shouldHydrateAuthFromCookie = false;
if (ssrPayload && shouldUseSsrBootstrap) {
  useTenantStore.setState(ssrPayload.tenantState);
  const { hasAuthCookie, ...authStateForStore } = ssrPayload.authState;
  shouldHydrateAuthFromCookie = hasAuthCookie && !authStateForStore.user;
  useAuthStore.setState(authStateForStore);
}

const app = (
  <QueryClientProvider client={queryClient}>
    <HydrationBoundary state={shouldUseSsrBootstrap ? ssrPayload?.reactQueryState : undefined}>
      <TooltipProvider>
        <Toaster
          position="top-right"
          options={{
            fill: "#1a1a1a",
            styles: {
              title: "text-white font-semibold opacity-100!",
              description: "text-white opacity-90!",
            },
            duration: 2500,
          }}
        />
        <BrowserRouter>
          <ClientBootstrap
            skipTenantBootstrap={shouldUseSsrBootstrap}
            hydrateAuthFromCookie={shouldHydrateAuthFromCookie}
          >
            <AppRoutes />
          </ClientBootstrap>
        </BrowserRouter>
      </TooltipProvider>
    </HydrationBoundary>
  </QueryClientProvider>
);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("No se encontro el contenedor root para iniciar la app.");
}

if (shouldUseSsrBootstrap && rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
