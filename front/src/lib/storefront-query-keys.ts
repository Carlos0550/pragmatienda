export const storefrontQueryKeys = {
  categories: {
    list: () => ["storefront", "categories", "list"] as const,
    bySlug: (slug: string) => ["storefront", "categories", "slug", slug] as const,
  },
  products: {
    list: (filter?: { categoryId?: string | null; categorySlug?: string | null }) =>
      [
        "storefront",
        "products",
        "list",
        filter?.categoryId ?? null,
        filter?.categorySlug ?? null,
      ] as const,
    detail: (slug: string) => ["storefront", "products", "detail", slug] as const,
  },
  billing: {
    publicPlans: () => ["storefront", "billing", "public-plans"] as const,
  },
};
