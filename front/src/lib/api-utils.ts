import { capitalizeName } from '@/lib/utils';
import type { ApiFieldErrors, Category, FormErrors, Product, Tenant, TenantResolveResponse } from '@/types';

export function toFormErrors(errors?: ApiFieldErrors): FormErrors {
  if (!errors) return {};
  const next: FormErrors = {};
  for (const key of Object.keys(errors)) {
    const first = errors[key]?.[0];
    if (first) next[key] = first;
  }
  return next;
}

export function normalizeProduct(product: Product): Product {
  const rawPrice = typeof product.price === 'string' ? Number(product.price) : product.price;
  const rawCompareAtPrice =
    typeof product.compareAtPrice === 'string'
      ? Number(product.compareAtPrice)
      : product.compareAtPrice;
  const imageList = product.images && product.images.length > 0
    ? product.images
    : product.image
      ? [product.image]
      : [];
  return {
    ...product,
    slug: product.slug || product.id,
    description: product.description || '',
    price: Number.isFinite(rawPrice) ? rawPrice : 0,
    ...(rawCompareAtPrice != null && Number.isFinite(rawCompareAtPrice) ? { compareAtPrice: rawCompareAtPrice } : {}),
    images: imageList,
    categoryName: product.categoryName ?? product.category?.name,
    active: product.status ? product.status === 'PUBLISHED' : product.active,
    metaTitle: product.metaTitle ?? product.metadata?.title,
    metaDescription: product.metaDescription ?? product.metadata?.description,
  };
}

export function normalizeProducts(products: Product[]): Product[] {
  return products.map(normalizeProduct);
}

export function normalizeCategory(category: Category): Category {
  return {
    ...category,
    slug: category.slug || category.id,
  };
}

export function normalizeCategories(categories: Category[]): Category[] {
  return categories.map(normalizeCategory);
}

export function normalizeResolvedTenant(response: TenantResolveResponse): Tenant | null {
  const tenantId = response.data?.tenantId;
  if (!tenantId) return null;
  const businessName = response.data.businessName || 'Tienda';
  const normalizedName = capitalizeName(businessName);
  const slug = businessName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  return {
    id: tenantId,
    name: normalizedName,
    slug,
    description: response.data.description ?? undefined,
    logo: response.data.logo ?? undefined,
    banner: response.data.banner ?? undefined,
    favicon: response.data.favicon ?? undefined,
    socialLinks: response.data.socialMedia ?? undefined,
  };
}
