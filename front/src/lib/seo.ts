import type { Category, Product, Tenant } from "@/types";

export type SeoRouteKind = "landing" | "home" | "products" | "product" | "category" | "spa";

export type SeoPayload = {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  og: {
    type: "website" | "product";
    title: string;
    description: string;
    url: string;
    image?: string;
    siteName: string;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description: string;
    image?: string;
  };
  jsonLd?: Record<string, unknown>;
};

const DEFAULT_DESCRIPTION =
  "Sistema de control de stock, ventas y tienda online. Facil de usar para cualquier negocio.";

function ensureAbsoluteUrl(baseUrl: string, path: string) {
  const cleanedBase = baseUrl.replace(/\/+$/, "");
  const cleanedPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanedBase}${cleanedPath}`;
}

function ensureAbsoluteImageUrl(baseUrl: string, image?: string | null): string | undefined {
  if (!image) return undefined;
  if (/^https?:\/\//i.test(image)) return image;
  return ensureAbsoluteUrl(baseUrl, image.startsWith("/") ? image : `/${image}`);
}

function extractProductSeo(product?: Product | null) {
  if (!product) return { title: undefined, description: undefined };
  return {
    title: product.metaTitle || product.metadata?.title || undefined,
    description: product.metaDescription || product.metadata?.description || undefined,
  };
}

function buildProductJsonLd(args: {
  product: Product;
  tenant: Tenant | null;
  canonicalUrl: string;
}): Record<string, unknown> {
  const firstImage = args.product.images?.[0] || args.product.image;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: args.product.name,
    image: firstImage ? [firstImage] : undefined,
    description: args.product.description || undefined,
    sku: args.product.id,
    brand: {
      "@type": "Brand",
      name: args.tenant?.name || "PragmaTienda",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "ARS",
      price: args.product.price,
      availability:
        args.product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: args.canonicalUrl,
    },
  };
}

export function buildSeo(args: {
  routeKind: SeoRouteKind;
  baseUrl: string;
  path: string;
  tenant: Tenant | null;
  product?: Product | null;
  category?: Category | null;
}): SeoPayload {
  const canonicalUrl = ensureAbsoluteUrl(args.baseUrl, args.path);
  const tenantName = args.tenant?.name || "PragmaTienda";

  if (args.routeKind === "landing") {
    const title = "Pragmatienda - Tu tienda online en minutos";
    const description =
      "Crea tu ecommerce multi-tenant, gestiona productos y vende online con una plataforma simple y escalable.";
    return {
      title,
      description,
      canonicalUrl,
      robots: "index,follow",
      og: {
        type: "website",
        title,
        description,
        url: canonicalUrl,
        siteName: "Pragmatienda",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  }

  if (args.routeKind === "product" && args.product) {
    const seo = extractProductSeo(args.product);
    const title = seo.title || `${args.product.name} | ${tenantName}`;
    const description =
      seo.description ||
      args.product.description ||
      `Compra ${args.product.name} en ${tenantName}.`;
    const ogImage = ensureAbsoluteImageUrl(
      args.baseUrl,
      args.product.images?.[0] || args.product.image
    );
    return {
      title,
      description,
      canonicalUrl,
      robots: "index,follow",
      og: {
        type: "product",
        title,
        description,
        url: canonicalUrl,
        image: ogImage,
        siteName: tenantName,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        image: ogImage,
      },
      jsonLd: buildProductJsonLd({
        product: args.product,
        tenant: args.tenant,
        canonicalUrl,
      }),
    };
  }

  if (args.routeKind === "category" && args.category) {
    const title = args.category.metaTitle || `${args.category.name} | ${tenantName}`;
    const description =
      args.category.metaDescription ||
      `Explora productos de ${args.category.name} en ${tenantName}.`;
    return {
      title,
      description,
      canonicalUrl,
      robots: "index,follow",
      og: {
        type: "website",
        title,
        description,
        url: canonicalUrl,
        image: ensureAbsoluteImageUrl(args.baseUrl, args.category.image),
        siteName: tenantName,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        image: ensureAbsoluteImageUrl(args.baseUrl, args.category.image),
      },
    };
  }

  if (args.routeKind === "products") {
    const title = `Productos | ${tenantName}`;
    const description =
      args.tenant?.description?.trim() ||
      `Catálogo de productos en ${tenantName}. Comprá online con envío a domicilio.`;
    const ogImage = ensureAbsoluteImageUrl(
      args.baseUrl,
      args.tenant?.banner || args.tenant?.logo
    );
    return {
      title,
      description,
      canonicalUrl,
      robots: "index,follow",
      og: {
        type: "website",
        title,
        description,
        url: canonicalUrl,
        image: ogImage,
        siteName: tenantName,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        image: ogImage,
      },
    };
  }

  if (args.routeKind === "home") {
    const title = `${tenantName} | Tienda online`;
    const description =
      args.tenant?.description?.trim() ||
      `Comprá en ${tenantName}. Tienda online con productos de calidad, ofertas y envíos a domicilio.`;
    const ogImage = ensureAbsoluteImageUrl(
      args.baseUrl,
      args.tenant?.banner || args.tenant?.logo
    );
    return {
      title,
      description,
      canonicalUrl,
      robots: "index,follow",
      og: {
        type: "website",
        title,
        description,
        url: canonicalUrl,
        image: ogImage,
        siteName: tenantName,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        image: ogImage,
      },
    };
  }

  const fallbackTitle = `${tenantName} | Pragmatienda`;
  return {
    title: fallbackTitle,
    description: DEFAULT_DESCRIPTION,
    canonicalUrl,
    robots: "noindex,follow",
    og: {
      type: "website",
      title: fallbackTitle,
      description: DEFAULT_DESCRIPTION,
      url: canonicalUrl,
      siteName: tenantName,
    },
    twitter: {
      card: "summary_large_image",
      title: fallbackTitle,
      description: DEFAULT_DESCRIPTION,
    },
  };
}
