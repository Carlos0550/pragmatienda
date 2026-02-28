import fs from "fs";
import path from "path";
import { PassThrough } from "stream";
import { pathToFileURL } from "url";
import type { Request, RequestHandler, Response } from "express";
import { renderToPipeableStream } from "react-dom/server";
import { ProductsStatus } from "@prisma/client";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { billingService } from "../billing/application/billing.service";
import { categoriesService } from "../services/Categories/categories.service";
import { productsService } from "../services/Products/products.service";
import { businessService } from "../services/Business/business.service";
import { prisma } from "../db/prisma";
import { capitalizeWords, slugify } from "../utils/normalization.utils";

type SsrRouteKind = "landing" | "home" | "products" | "product" | "category" | "spa";
type FrontServerModule = {
  createServerRenderPayload: (input: {
    url: string;
    baseUrl: string;
    routeKind: SsrRouteKind;
    tenantState: {
      tenant: {
        id: string;
        name: string;
        slug: string;
        logo?: string;
        banner?: string;
        favicon?: string;
        socialLinks?: { facebook?: string; instagram?: string; whatsapp?: string };
      } | null;
      loading: boolean;
      error: string | null;
      isLandingDomain: boolean;
      storeNotFound: boolean;
    };
    authState: {
      user: null;
      loading: boolean;
      billingRequired: boolean;
      hasAuthCookie: boolean;
    };
    prefetch?: Record<string, unknown>;
  }) => Promise<{
    app: unknown;
    payload: {
      seo: {
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
      [key: string]: unknown;
    };
  }>;
};

const LANDING_HOSTNAMES = new Set(["pragmatienda.com", "www.pragmatienda.com", "localhost"]);
const FRONT_ROOT = path.resolve(process.cwd(), "../front");
const FRONT_CLIENT_DIST_DIR = path.resolve(FRONT_ROOT, "dist/client");
const FRONT_SERVER_ENTRY = path.resolve(FRONT_ROOT, "dist/server/entry-server.js");
const CLIENT_MANIFEST_PATH = path.resolve(FRONT_CLIENT_DIST_DIR, ".vite/manifest.json");
const STREAM_ABORT_DELAY_MS = 10_000;
const AUTH_TOKEN_COOKIE_KEY = "pragmatienda_token";

type ClientManifestEntry = {
  file: string;
  css?: string[];
  imports?: string[];
  isEntry?: boolean;
};

type ClientAssets = {
  scripts: string[];
  styles: string[];
  modulePreloads: string[];
};

type RouteMatch = {
  kind: SsrRouteKind;
  pathname: string;
  search: URLSearchParams;
  params?: Record<string, string>;
};

let cachedServerModule: FrontServerModule | null = null;
let cachedClientAssets: ClientAssets | null = null;

function normalizeHost(req: Request): { hostname: string; hostHeader: string } {
  const forwardedHost = req.header("x-forwarded-host");
  const rawHost = (forwardedHost ?? req.header("host") ?? req.hostname ?? "").split(",")[0].trim();
  const hostHeader = rawHost || "localhost";
  const hostname = hostHeader.replace(/:\d+$/, "").toLowerCase();
  return { hostname, hostHeader };
}

function isLandingHostname(hostname: string): boolean {
  return LANDING_HOSTNAMES.has(hostname.toLowerCase());
}

function matchRoute(req: Request): RouteMatch {
  const url = new URL(req.originalUrl || req.url, "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/") {
    return { kind: "home", pathname, search: url.searchParams };
  }
  if (pathname === "/products") {
    return { kind: "products", pathname, search: url.searchParams };
  }
  const productMatch = pathname.match(/^\/products\/([^/]+)$/);
  if (productMatch) {
    return {
      kind: "product",
      pathname,
      search: url.searchParams,
      params: { slug: decodeURIComponent(productMatch[1]) },
    };
  }
  const categoryMatch = pathname.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) {
    return {
      kind: "category",
      pathname,
      search: url.searchParams,
      params: { slug: decodeURIComponent(categoryMatch[1]) },
    };
  }
  return { kind: "spa", pathname, search: url.searchParams };
}

function toTenantSocialLinks(
  socialMedia: unknown
): { facebook?: string; instagram?: string; whatsapp?: string } | undefined {
  if (!socialMedia || typeof socialMedia !== "object") return undefined;
  const record = socialMedia as Record<string, string>;
  return {
    facebook: record.facebook,
    instagram: record.instagram,
    whatsapp: record.whatsapp,
  };
}

function extractCookie(cookieHeader: string | undefined, key: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...valueParts] = part.trim().split("=");
    if (rawKey !== key) continue;
    const value = valueParts.join("=");
    try {
      return decodeURIComponent(value);
    } catch {
      return value || null;
    }
  }
  return null;
}

function safeJsonSerialize(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function collectManifestAssets(manifest: Record<string, ClientManifestEntry>, entryKey: string): ClientAssets {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  const modulePreloads = new Set<string>();
  const visited = new Set<string>();

  const walk = (key: string) => {
    if (visited.has(key)) return;
    visited.add(key);
    const current = manifest[key];
    if (!current) return;
    if (current.file) {
      const filePath = `/${current.file}`;
      if (current.isEntry) scripts.add(filePath);
      else modulePreloads.add(filePath);
    }
    for (const cssFile of current.css ?? []) {
      styles.add(`/${cssFile}`);
    }
    for (const importedKey of current.imports ?? []) {
      walk(importedKey);
    }
  };

  walk(entryKey);
  return {
    scripts: Array.from(scripts),
    styles: Array.from(styles),
    modulePreloads: Array.from(modulePreloads),
  };
}

function getClientAssets(): ClientAssets {
  if (cachedClientAssets && env.NODE_ENV === "production") {
    return cachedClientAssets;
  }

  if (fs.existsSync(CLIENT_MANIFEST_PATH)) {
    const manifestRaw = fs.readFileSync(CLIENT_MANIFEST_PATH, "utf-8");
    const manifest = JSON.parse(manifestRaw) as Record<string, ClientManifestEntry>;
    const entryKey =
      manifest["src/entry-client.tsx"] ? "src/entry-client.tsx" : Object.keys(manifest).find((key) => manifest[key]?.isEntry);
    if (entryKey) {
      const assets = collectManifestAssets(manifest, entryKey);
      if (env.NODE_ENV === "production") {
        cachedClientAssets = assets;
      }
      return assets;
    }
  }

  const frontendOrigin = env.FRONTEND_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  return {
    scripts: [`${frontendOrigin}/@vite/client`, `${frontendOrigin}/src/entry-client.tsx`],
    styles: [],
    modulePreloads: [],
  };
}

async function loadFrontServerModule(): Promise<FrontServerModule | null> {
  if (cachedServerModule && env.NODE_ENV === "production") {
    return cachedServerModule;
  }

  if (!fs.existsSync(FRONT_SERVER_ENTRY)) {
    return null;
  }

  const moduleUrl = pathToFileURL(FRONT_SERVER_ENTRY).href;
  const imported = (await import(
    env.NODE_ENV === "development" ? `${moduleUrl}?v=${Date.now()}` : moduleUrl
  )) as Partial<FrontServerModule>;

  if (!imported.createServerRenderPayload) {
    return null;
  }

  const loaded = imported as FrontServerModule;
  if (env.NODE_ENV === "production") {
    cachedServerModule = loaded;
  }
  return loaded;
}

function buildHtmlHead(args: {
  seo: {
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
  assets: ClientAssets;
}): string {
  const { seo, assets } = args;
  const styles = assets.styles.map((href) => `<link rel="stylesheet" href="${href}" />`).join("");
  const preloads = assets.modulePreloads
    .map((href) => `<link rel="modulepreload" href="${href}" />`)
    .join("");
  const jsonLdScript = seo.jsonLd
    ? `<script type="application/ld+json">${safeJsonSerialize(seo.jsonLd)}</script>`
    : "";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${escapeXml(seo.title)}</title>
    <meta name="description" content="${escapeXml(seo.description)}" />
    <meta name="robots" content="${escapeXml(seo.robots)}" />
    <link rel="canonical" href="${escapeXml(seo.canonicalUrl)}" />
    <meta property="og:type" content="${escapeXml(seo.og.type)}" />
    <meta property="og:site_name" content="${escapeXml(seo.og.siteName)}" />
    <meta property="og:title" content="${escapeXml(seo.og.title)}" />
    <meta property="og:description" content="${escapeXml(seo.og.description)}" />
    <meta property="og:url" content="${escapeXml(seo.og.url)}" />
    ${seo.og.image ? `<meta property="og:image" content="${escapeXml(seo.og.image)}" />` : ""}
    <meta name="twitter:card" content="${escapeXml(seo.twitter.card)}" />
    <meta name="twitter:title" content="${escapeXml(seo.twitter.title)}" />
    <meta name="twitter:description" content="${escapeXml(seo.twitter.description)}" />
    ${seo.twitter.image ? `<meta name="twitter:image" content="${escapeXml(seo.twitter.image)}" />` : ""}
    ${styles}
    ${preloads}
    ${jsonLdScript}
  </head>
  <body>
    <div id="root">`;
}

function buildHtmlTail(args: { assets: ClientAssets; payload: unknown }): string {
  const scripts = args.assets.scripts.map((src) => `<script type="module" src="${src}"></script>`).join("");
  return `</div>
    <script>window.__PRAGMATIENDA_SSR__=${safeJsonSerialize(args.payload)};</script>
    ${scripts}
  </body>
</html>`;
}

function shouldBypassSsr(pathname: string): boolean {
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/docs")) return true;
  if (pathname === "/docs.json") return true;
  if (pathname.startsWith("/assets/")) return true;
  if (/\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|txt|xml|map|json)$/.test(pathname)) return true;
  return false;
}

function getPagination(total: number, limit: number) {
  return {
    page: 1,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function normalizeProduct(product: Record<string, unknown>) {
  const category = (product.category as Record<string, unknown> | null) ?? null;
  const priceValue = product.price;
  const price =
    typeof priceValue === "number"
      ? priceValue
      : typeof priceValue === "string"
        ? Number(priceValue)
        : 0;

  return {
    id: String(product.id),
    name: String(product.name ?? ""),
    slug: String(product.slug ?? product.id ?? ""),
    description: String(product.description ?? ""),
    image: (product.image as string | null) ?? undefined,
    images: (product.image ? [String(product.image)] : []) as string[],
    price: Number.isFinite(price) ? price : 0,
    stock: Number(product.stock ?? 0),
    status: (product.status as string | undefined) ?? "PUBLISHED",
    active: String(product.status ?? "PUBLISHED") === "PUBLISHED",
    categoryId: (product.categoryId as string | null) ?? undefined,
    categoryName: category?.name ? String(category.name) : undefined,
    category: category
      ? {
          id: String(category.id),
          name: String(category.name),
        }
      : undefined,
    metadata: (product.metadata as Record<string, unknown> | undefined) ?? undefined,
    metaTitle: (product.metaTitle as string | null) ?? undefined,
    metaDescription: (product.metaDescription as string | null) ?? undefined,
  };
}

function normalizeCategory(category: Record<string, unknown>) {
  return {
    id: String(category.id),
    name: String(category.name ?? ""),
    slug: String(category.slug ?? category.id ?? ""),
    image: (category.image as string | null) ?? undefined,
    metaTitle: (category.metaTitle as string | null) ?? undefined,
    metaDescription: (category.metaDescription as string | null) ?? undefined,
  };
}

async function resolveTenantFromHostname(hostname: string) {
  if (isLandingHostname(hostname)) {
    return {
      tenantState: {
        tenant: null,
        loading: false,
        error: null,
        isLandingDomain: true,
        storeNotFound: false,
      },
      tenantId: null as string | null,
    };
  }

  const result = await businessService.resolveTenantIdByStoreUrl(hostname);
  if (result.status !== 200 || !result.data) {
    return {
      tenantState: {
        tenant: null,
        loading: false,
        error: null,
        isLandingDomain: false,
        storeNotFound: true,
      },
      tenantId: null as string | null,
    };
  }

  const data = result.data as {
    tenantId: string;
    businessName: string;
    logo?: string | null;
    banner?: string | null;
    favicon?: string | null;
    socialMedia?: unknown;
  };

  return {
    tenantState: {
      tenant: {
        id: data.tenantId,
        name: capitalizeWords(data.businessName),
        slug: slugify(data.businessName),
        logo: data.logo ?? undefined,
        banner: data.banner ?? undefined,
        favicon: data.favicon ?? undefined,
        socialLinks: toTenantSocialLinks(data.socialMedia),
      },
      loading: false,
      error: null,
      isLandingDomain: false,
      storeNotFound: false,
    },
    tenantId: data.tenantId,
  };
}

async function buildPrefetchData(args: {
  route: RouteMatch;
  tenantId: string | null;
}): Promise<Record<string, unknown>> {
  const { route, tenantId } = args;
  if (route.kind === "landing") {
    const publicPlans = await billingService.listPublicPlans().catch(() => []);
    return { publicPlans };
  }
  if (!tenantId) return {};

  if (route.kind === "home") {
    const [categoriesRes, productsRes] = await Promise.all([
      categoriesService.getMany(tenantId, { page: 1, limit: 100, name: undefined }),
      productsService.getMany(
        tenantId,
        {
          page: 1,
          limit: 12,
          name: undefined,
          categoryId: undefined,
          categorySlug: undefined,
          status: undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        true
      ),
    ]);

    const categoriesData = (categoriesRes.data as { items: Record<string, unknown>[] } | undefined)?.items ?? [];
    const productsData =
      (productsRes.data as {
        items: Record<string, unknown>[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      } | undefined) ?? { items: [], pagination: getPagination(0, 12) };

    return {
      categories: categoriesData.map((category) => normalizeCategory(category)),
      products: {
        items: productsData.items.map((product) => normalizeProduct(product)),
        pagination: productsData.pagination,
      },
      productsFilter: { categoryId: null, categorySlug: null },
    };
  }

  if (route.kind === "products") {
    const categoryId = route.search.get("category") || undefined;
    const categorySlug = route.search.get("categorySlug") || undefined;
    const [categoriesRes, productsRes] = await Promise.all([
      categoriesService.getMany(tenantId, { page: 1, limit: 100, name: undefined }),
      productsService.getMany(
        tenantId,
        {
          page: 1,
          limit: 30,
          name: undefined,
          categoryId,
          categorySlug: categorySlug ?? undefined,
          status: undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        true
      ),
    ]);

    const categoriesData = (categoriesRes.data as { items: Record<string, unknown>[] } | undefined)?.items ?? [];
    const productsData =
      (productsRes.data as {
        items: Record<string, unknown>[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      } | undefined) ?? { items: [], pagination: getPagination(0, 30) };

    return {
      categories: categoriesData.map((category) => normalizeCategory(category)),
      products: {
        items: productsData.items.map((product) => normalizeProduct(product)),
        pagination: productsData.pagination,
      },
      productsFilter: { categoryId: categoryId ?? null, categorySlug: categorySlug ?? null },
    };
  }

  if (route.kind === "product") {
    const slug = route.params?.slug ?? "";
    const productRes = await productsService.getOne(tenantId, slug, true);
    if (productRes.status !== 200 || !productRes.data) {
      return { product: null };
    }
    return {
      product: normalizeProduct(productRes.data as Record<string, unknown>),
    };
  }

  if (route.kind === "category") {
    const categorySlug = route.params?.slug ?? "";
    const [categoryRes, productsRes, categoriesRes] = await Promise.all([
      categoriesService.getOneBySlug(tenantId, categorySlug),
      productsService.getMany(
        tenantId,
        {
          page: 1,
          limit: 30,
          name: undefined,
          categoryId: undefined,
          categorySlug,
          status: undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        true
      ),
      categoriesService.getMany(tenantId, { page: 1, limit: 100, name: undefined }),
    ]);

    const category = categoryRes.data
      ? normalizeCategory(categoryRes.data as Record<string, unknown>)
      : null;
    const productsData =
      (productsRes.data as {
        items: Record<string, unknown>[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      } | undefined) ?? { items: [], pagination: getPagination(0, 30) };
    const categoriesData = (categoriesRes.data as { items: Record<string, unknown>[] } | undefined)?.items ?? [];

    return {
      category,
      categories: categoriesData.map((item) => normalizeCategory(item)),
      products: {
        items: productsData.items.map((item) => normalizeProduct(item)),
        pagination: productsData.pagination,
      },
      productsFilter: { categoryId: null, categorySlug },
    };
  }

  return {};
}

function renderClientShell(res: Response, args: { status: number; seo: { title: string; description: string; canonicalUrl: string; robots: string; og: { type: "website" | "product"; title: string; description: string; url: string; image?: string; siteName: string; }; twitter: { card: "summary_large_image"; title: string; description: string; image?: string; }; jsonLd?: Record<string, unknown>; }; payload: Record<string, unknown> }) {
  const assets = getClientAssets();
  const head = buildHtmlHead({ seo: args.seo, assets });
  const tail = buildHtmlTail({ assets, payload: args.payload });
  res.status(args.status).setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`${head}${tail}`);
}

export const getFrontClientDistDir = () => FRONT_CLIENT_DIST_DIR;

export const ssrHandler: RequestHandler = async (req, res, next) => {
  try {
    if (shouldBypassSsr(req.path)) {
      return next();
    }

    const route = matchRoute(req);
    const { hostname, hostHeader } = normalizeHost(req);
    const protocol = (req.header("x-forwarded-proto") ?? req.protocol ?? "http").split(",")[0].trim();
    const baseUrl = `${protocol}://${hostHeader}`;
    const hasAuthCookie = Boolean(extractCookie(req.header("cookie"), AUTH_TOKEN_COOKIE_KEY));

    if (isLandingHostname(hostname) && route.pathname !== "/") {
      return res.redirect(302, "/");
    }

    const serverModule = await loadFrontServerModule();
    if (!serverModule) {
      return renderClientShell(res, {
        status: 200,
        seo: {
          title: "Pragmatienda",
          description: "Tienda online multi-tenant",
          canonicalUrl: `${baseUrl}${route.pathname}`,
          robots: "index,follow",
          og: {
            type: "website",
            title: "Pragmatienda",
            description: "Tienda online multi-tenant",
            url: `${baseUrl}${route.pathname}`,
            siteName: "Pragmatienda",
          },
          twitter: {
            card: "summary_large_image",
            title: "Pragmatienda",
            description: "Tienda online multi-tenant",
          },
        },
        payload: {
          routeKind: "spa",
          tenantState: {
            tenant: null,
            loading: false,
            error: null,
            isLandingDomain: false,
            storeNotFound: false,
          },
          authState: {
            user: null,
            loading: false,
            billingRequired: false,
            hasAuthCookie,
          },
          reactQueryState: { mutations: [], queries: [] },
        },
      });
    }

    if (route.kind === "spa") {
      return renderClientShell(res, {
        status: 200,
        seo: {
          title: "Pragmatienda",
          description: "Tienda online multi-tenant",
          canonicalUrl: `${baseUrl}${route.pathname}`,
          robots: "noindex,follow",
          og: {
            type: "website",
            title: "Pragmatienda",
            description: "Tienda online multi-tenant",
            url: `${baseUrl}${route.pathname}`,
            siteName: "Pragmatienda",
          },
          twitter: {
            card: "summary_large_image",
            title: "Pragmatienda",
            description: "Tienda online multi-tenant",
          },
        },
        payload: {
          routeKind: "spa",
          tenantState: {
            tenant: null,
            loading: false,
            error: null,
            isLandingDomain: false,
            storeNotFound: false,
          },
          authState: {
            user: null,
            loading: false,
            billingRequired: false,
            hasAuthCookie,
          },
          reactQueryState: { mutations: [], queries: [] },
        },
      });
    }

    const effectiveRoute: SsrRouteKind = isLandingHostname(hostname) ? "landing" : route.kind;
    const tenantResolution = await resolveTenantFromHostname(hostname);
    const prefetch = await buildPrefetchData({
      route: { ...route, kind: effectiveRoute },
      tenantId: tenantResolution.tenantId,
    });

    const renderResult = await serverModule.createServerRenderPayload({
      url: req.originalUrl || req.url,
      baseUrl,
      routeKind: effectiveRoute,
      tenantState: tenantResolution.tenantState,
      authState: {
        user: null,
        loading: false,
        billingRequired: false,
        hasAuthCookie,
      },
      prefetch,
    });
    const statusCode =
      tenantResolution.tenantState.storeNotFound ||
      (effectiveRoute === "product" && (prefetch.product as unknown) == null) ||
      (effectiveRoute === "category" && (prefetch.category as unknown) == null)
        ? 404
        : 200;

    const assets = getClientAssets();
    const head = buildHtmlHead({
      seo: renderResult.payload.seo,
      assets,
    });
    const tail = buildHtmlTail({
      assets,
      payload: renderResult.payload,
    });
    const reactNode = renderResult.app as Parameters<typeof renderToPipeableStream>[0];

    let didError = false;
    const stream = new PassThrough();
    const timeout = setTimeout(() => {
      didError = true;
      stream.destroy();
    }, STREAM_ABORT_DELAY_MS);

    const { pipe, abort } = renderToPipeableStream(reactNode, {
      onShellReady() {
        res.status(didError ? 500 : statusCode);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader(
          "Cache-Control",
          didError || statusCode >= 400 ? "no-store" : "public, max-age=30, stale-while-revalidate=120"
        );
        res.write(head);
        pipe(stream);
        stream.pipe(res, { end: false });
        stream.on("end", () => {
          clearTimeout(timeout);
          res.write(tail);
          res.end();
        });
      },
      onShellError(error) {
        clearTimeout(timeout);
        logger.error("SSR shell error", { message: (error as Error).message });
        renderClientShell(res, {
          status: 500,
          seo: renderResult.payload.seo,
          payload: renderResult.payload as Record<string, unknown>,
        });
      },
      onError(error) {
        didError = true;
        logger.error("SSR stream error", { message: (error as Error).message });
      },
    });

    setTimeout(() => abort(), STREAM_ABORT_DELAY_MS);
  } catch (error) {
    const err = error as Error;
    logger.error("Error en SSR handler", { message: err.message, stack: err.stack });
    return next(error);
  }
};

export const sitemapHandler: RequestHandler = async (req, res, next) => {
  try {
    const { hostname, hostHeader } = normalizeHost(req);
    const protocol = (req.header("x-forwarded-proto") ?? req.protocol ?? "http").split(",")[0].trim();
    const baseUrl = `${protocol}://${hostHeader}`;

    if (isLandingHostname(hostname)) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeXml(baseUrl)}/</loc></url>
</urlset>`;
      res.type("application/xml").send(xml);
      return;
    }

    const tenantResolution = await resolveTenantFromHostname(hostname);
    if (!tenantResolution.tenantId) {
      res.type("application/xml").status(404).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
      return;
    }

    const [products, categories] = await Promise.all([
      prisma.products.findMany({
        where: {
          tenantId: tenantResolution.tenantId,
          status: ProductsStatus.PUBLISHED,
          stock: { gt: 0 },
          slug: { not: null },
        },
        select: { slug: true, updatedAt: true },
      }),
      prisma.productsCategory.findMany({
        where: {
          tenantId: tenantResolution.tenantId,
          slug: { not: null },
        },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const urls: Array<{ loc: string; lastmod?: string }> = [
      { loc: `${baseUrl}/` },
      { loc: `${baseUrl}/products` },
      ...products
        .filter((p) => p.slug)
        .map((p) => ({ loc: `${baseUrl}/products/${p.slug}`, lastmod: p.updatedAt.toISOString() })),
      ...categories
        .filter((c) => c.slug)
        .map((c) => ({ loc: `${baseUrl}/category/${c.slug}`, lastmod: c.updatedAt.toISOString() })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => {
    const lastmod = url.lastmod ? `<lastmod>${escapeXml(url.lastmod)}</lastmod>` : "";
    return `  <url><loc>${escapeXml(url.loc)}</loc>${lastmod}</url>`;
  })
  .join("\n")}
</urlset>`;

    res.type("application/xml").send(xml);
  } catch (error) {
    next(error);
  }
};

export const robotsHandler: RequestHandler = async (req, res, next) => {
  try {
    const { hostHeader } = normalizeHost(req);
    const protocol = (req.header("x-forwarded-proto") ?? req.protocol ?? "http").split(",")[0].trim();
    const baseUrl = `${protocol}://${hostHeader}`;
    const robots = `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
    res.type("text/plain").send(robots);
  } catch (error) {
    next(error);
  }
};
