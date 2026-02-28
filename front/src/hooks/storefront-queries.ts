import { useQuery } from "@tanstack/react-query";
import { http } from "@/services/http";
import { storefrontQueryKeys } from "@/lib/storefront-query-keys";

export function useStorefrontCategories() {
  return useQuery({
    queryKey: storefrontQueryKeys.categories.list(),
    queryFn: () => http.categories.listPublic({ limit: 100 }),
    staleTime: 1000 * 60 * 10,
  });
}

export function useStorefrontCategoryBySlug(slug?: string) {
  return useQuery({
    queryKey: storefrontQueryKeys.categories.bySlug(slug ?? ""),
    queryFn: () => http.categories.getPublicBySlug(slug ?? ""),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 10,
  });
}

export function useStorefrontProducts(filter?: { categoryId?: string | null; categorySlug?: string | null }) {
  return useQuery({
    queryKey: storefrontQueryKeys.products.list(filter),
    queryFn: () =>
      http.products.listPublic({
        ...(filter?.categoryId ? { categoryId: filter.categoryId } : {}),
        ...(filter?.categorySlug ? { categorySlug: filter.categorySlug } : {}),
      }),
    staleTime: 1000 * 60 * 5,
  });
}

export function useStorefrontProductDetail(slug?: string) {
  return useQuery({
    queryKey: storefrontQueryKeys.products.detail(slug ?? ""),
    queryFn: () => http.products.getPublicBySlug(slug ?? ""),
    enabled: Boolean(slug && slug !== "undefined"),
    staleTime: 1000 * 60 * 5,
  });
}

export function usePublicPlans() {
  return useQuery({
    queryKey: storefrontQueryKeys.billing.publicPlans(),
    queryFn: () => http.billing.listPublicPlans(),
    staleTime: 1000 * 60 * 10,
  });
}
