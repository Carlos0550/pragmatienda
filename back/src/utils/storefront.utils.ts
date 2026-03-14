import { env } from "../config/env";
type StorefrontConfig = {
  protocol: string;
  rootDomain: string;
  port?: string;
};

const DEFAULT_PLATFORM_SUFFIXES = [".code.run"];

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeProtocol = (value?: string | null) => {
  const normalized = (value ?? "").replace(/:$/, "").trim().toLowerCase();
  return normalized === "http" || normalized === "https" ? normalized : "http";
};

const normalizeRootDomain = (hostname: string) => {
  const lower = hostname.trim().toLowerCase();
  if (!lower) return "localhost";
  if (lower === "www.localhost") return "localhost";
  if (lower.startsWith("www.") && lower.split(".").length > 2) {
    return lower.slice(4);
  }
  return lower;
};

const getPublicPortSuffix = ({ rootDomain, port }: StorefrontConfig) => {
  if (!port) return "";
  return rootDomain === "localhost" ? `:${port}` : "";
};

export const getStorefrontConfig = (): StorefrontConfig => {
  return {
    protocol: normalizeProtocol(env.STOREFRONT_PROTOCOL),
    rootDomain: normalizeRootDomain(env.STOREFRONT_ROOT_DOMAIN),
    port: env.STOREFRONT_PORT,
  };
};

export const normalizeStoreSubdomain = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export const getPlatformBaseUrl = () => {
  const config = getStorefrontConfig();
  const port = getPublicPortSuffix(config);
  return `${config.protocol}://${config.rootDomain}${port}`;
};

export const getStoreBaseUrl = (subdomain?: string | null) => {
  const normalizedSubdomain = normalizeStoreSubdomain(subdomain ?? "");
  if (!normalizedSubdomain) {
    return getPlatformBaseUrl();
  }
  const config = getStorefrontConfig();
  const port = getPublicPortSuffix(config);
  return `${config.protocol}://${normalizedSubdomain}.${config.rootDomain}${port}`;
};

export const getStoreUrl = (subdomain?: string | null, path = "") => {
  const baseUrl = trimTrailingSlash(getStoreBaseUrl(subdomain));
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${baseUrl}${normalizedPath}`;
};

export const getLandingHostnames = () => {
  const config = getStorefrontConfig();
  const hostnames = new Set<string>([config.rootDomain]);
  if (config.rootDomain !== "localhost") {
    hostnames.add(`www.${config.rootDomain}`);
  }
  return hostnames;
};

export const isLandingHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;
  if (getLandingHostnames().has(normalized)) return true;
  if (DEFAULT_PLATFORM_SUFFIXES.some((suffix) => normalized.endsWith(suffix) || normalized === suffix.slice(1))) {
    return true;
  }
  const extra = env.EXTRA_LANDING_HOSTNAME_SUFFIXES;
  if (!extra) return false;
  const suffixes = extra.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return suffixes.some((suffix) => normalized.endsWith(`.${suffix}`) || normalized === suffix);
};

export const getStoreSubdomainFromHostname = (hostname: string): string | null => {
  const normalizedHost = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  if (!normalizedHost || isLandingHostname(normalizedHost)) return null;

  const { rootDomain } = getStorefrontConfig();

  if (rootDomain === "localhost") {
    if (!normalizedHost.endsWith(".localhost")) return null;
    const prefix = normalizedHost.slice(0, -".localhost".length);
    if (!prefix || prefix.includes(".")) return null;
    return normalizeStoreSubdomain(prefix) || null;
  }

  const suffix = `.${rootDomain}`;
  if (!normalizedHost.endsWith(suffix)) return null;
  const prefix = normalizedHost.slice(0, -suffix.length);
  if (!prefix || prefix.includes(".")) return null;
  return normalizeStoreSubdomain(prefix) || null;
};

export const getStoreSubdomainFromInput = (rawUrl: string): string | null => {
  const input = rawUrl.trim();
  if (!input) return null;
  const withProtocol = /^https?:\/\//i.test(input)
    ? input
    : `${getStorefrontConfig().protocol}://${input}`;
  try {
    const hostname = new URL(withProtocol).hostname;
    return getStoreSubdomainFromHostname(hostname);
  } catch {
    return null;
  }
};
