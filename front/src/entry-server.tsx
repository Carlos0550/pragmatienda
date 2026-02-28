import { dehydrate, HydrationBoundary, QueryClientProvider } from "@tanstack/react-query";
import { StaticRouter } from "react-router-dom/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppRoutes } from "@/AppRoutes";
import { createAppQueryClient } from "@/lib/query-client";
import { storefrontQueryKeys } from "@/lib/storefront-query-keys";
import { useTenantStore } from "@/stores/tenant";
import { useAuthStore } from "@/stores/auth";
import { buildSeo } from "@/lib/seo";
import { normalizeCategory, normalizeCategories, normalizeProduct, normalizeProducts } from "@/lib/api-utils";
import type {
  AuthBootstrapState,
  SsrBootstrapPayload,
  SsrPrefetchedData,
  SsrRouteKind,
  TenantBootstrapState,
} from "@/lib/ssr";

export type ServerRenderInput = {
  url: string;
  baseUrl: string;
  routeKind: SsrRouteKind;
  tenantState: TenantBootstrapState;
  authState: AuthBootstrapState;
  prefetch?: SsrPrefetchedData;
};

export type ServerRenderResult = {
  app: JSX.Element;
  payload: SsrBootstrapPayload;
};

export async function createServerRenderPayload(input: ServerRenderInput): Promise<ServerRenderResult> {
  const queryClient = createAppQueryClient();

  useTenantStore.setState(input.tenantState);
  const { hasAuthCookie, ...authStateForStore } = input.authState;
  useAuthStore.setState(authStateForStore);

  const normalizedCategories = input.prefetch?.categories
    ? normalizeCategories(input.prefetch.categories)
    : undefined;
  const normalizedProducts = input.prefetch?.products
    ? {
        ...input.prefetch.products,
        items: normalizeProducts(input.prefetch.products.items),
      }
    : undefined;
  const normalizedProduct = input.prefetch?.product ? normalizeProduct(input.prefetch.product) : undefined;
  const normalizedCategory = input.prefetch?.category ? normalizeCategory(input.prefetch.category) : undefined;

  if (normalizedCategories) {
    queryClient.setQueryData(storefrontQueryKeys.categories.list(), normalizedCategories);
  }
  if (normalizedProducts) {
    queryClient.setQueryData(
      storefrontQueryKeys.products.list(input.prefetch.productsFilter),
      normalizedProducts
    );
  }
  if (normalizedProduct?.slug) {
    queryClient.setQueryData(
      storefrontQueryKeys.products.detail(normalizedProduct.slug),
      normalizedProduct
    );
  }
  if (normalizedCategory?.slug) {
    queryClient.setQueryData(
      storefrontQueryKeys.categories.bySlug(normalizedCategory.slug),
      normalizedCategory
    );
  }
  if (input.prefetch?.publicPlans) {
    queryClient.setQueryData(storefrontQueryKeys.billing.publicPlans(), input.prefetch.publicPlans);
  }

  const pathname = new URL(input.url, "http://localhost").pathname;
  const seo = buildSeo({
    routeKind: input.routeKind,
    baseUrl: input.baseUrl,
    path: pathname,
    tenant: input.tenantState.tenant,
    product: normalizedProduct ?? null,
    category: normalizedCategory ?? null,
  });

  const dehydratedState = dehydrate(queryClient);
  const payload: SsrBootstrapPayload = {
    routeKind: input.routeKind,
    tenantState: input.tenantState,
    authState: input.authState,
    reactQueryState: dehydratedState,
    seo,
  };

  const app = (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <TooltipProvider>
          <StaticRouter location={input.url}>
            <AppRoutes />
          </StaticRouter>
        </TooltipProvider>
      </HydrationBoundary>
    </QueryClientProvider>
  );

  return { app, payload };
}
