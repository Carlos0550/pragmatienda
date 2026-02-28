import { capitalizeName } from '@/lib/utils';
import type { ApiFieldErrors, FormErrors, Product, Tenant, TenantResolveResponse } from '@/types';

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
  const imageList = product.images && product.images.length > 0
    ? product.images
    : product.image
      ? [product.image]
      : [];
  return {
    ...product,
    images: imageList,
    categoryName: product.categoryName ?? product.category?.name,
    active: product.status ? product.status === 'PUBLISHED' : product.active,
  };
}

export function normalizeProducts(products: Product[]): Product[] {
  return products.map(normalizeProduct);
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
    logo: response.data.logo ?? undefined,
    banner: response.data.banner ?? undefined,
    favicon: response.data.favicon ?? undefined,
    socialLinks: response.data.socialMedia ?? undefined,
  };
}
