import type { DehydratedState } from "@tanstack/react-query";
import type { Category, Product, Tenant } from "@/types";
import type { SeoPayload } from "@/lib/seo";

export type SsrRouteKind = "landing" | "home" | "products" | "product" | "category" | "spa";

export type TenantBootstrapState = {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  isLandingDomain: boolean;
  storeNotFound: boolean;
};

export type AuthBootstrapState = {
  user: null;
  loading: boolean;
  billingRequired: boolean;
  hasAuthCookie: boolean;
};

export type SsrPrefetchedData = {
  categories?: Category[];
  productsFilter?: { categoryId?: string | null; categorySlug?: string | null };
  products?: { items: Product[]; pagination?: { page: number; limit: number; total: number; totalPages: number } };
  product?: Product | null;
  category?: Category | null;
  publicPlans?: unknown;
};

export type SsrBootstrapPayload = {
  routeKind: SsrRouteKind;
  tenantState: TenantBootstrapState;
  authState: AuthBootstrapState;
  reactQueryState: DehydratedState;
  seo: SeoPayload;
};

declare global {
  interface Window {
    __PRAGMATIENDA_SSR__?: SsrBootstrapPayload;
  }
}

export function getSsrBootstrapPayload(): SsrBootstrapPayload | null {
  if (typeof window === "undefined") return null;
  return window.__PRAGMATIENDA_SSR__ ?? null;
}
