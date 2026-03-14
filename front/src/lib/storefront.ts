type StorefrontConfig = {
  protocol: string;
  rootDomain: string;
  port?: string;
};

const PLATFORM_HOSTNAME_SUFFIXES = ['.code.run'];

function normalizeProtocol(value?: string | null) {
  const normalized = (value ?? '').replace(/:$/, '').trim().toLowerCase();
  return normalized === 'https' ? 'https' : 'http';
}

function normalizeRootDomain(value: string) {
  const lower = value.trim().toLowerCase();
  if (!lower) return 'localhost';
  if (lower === 'www.localhost') return 'localhost';
  if (lower.startsWith('www.') && lower.split('.').length > 2) {
    return lower.slice(4);
  }
  return lower;
}

function inferRootDomain(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return 'localhost';
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return 'localhost';
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  }
  return normalized;
}

function getPublicPortSuffix({ rootDomain, port }: StorefrontConfig) {
  if (!port) return '';
  return rootDomain === 'localhost' ? `:${port}` : '';
}

export function normalizeStoreSubdomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getStorefrontConfig(): StorefrontConfig {
  const envProtocol = import.meta.env.VITE_STOREFRONT_PROTOCOL as string | undefined;
  const envRootDomain = import.meta.env.VITE_STOREFRONT_ROOT_DOMAIN as string | undefined;
  const envPort = import.meta.env.VITE_STOREFRONT_PORT as string | undefined;

  if (envProtocol && envRootDomain) {
    return {
      protocol: normalizeProtocol(envProtocol),
      rootDomain: normalizeRootDomain(envRootDomain),
      port: envPort || undefined,
    };
  }

  if (typeof window !== 'undefined') {
    return {
      protocol: normalizeProtocol(window.location.protocol),
      rootDomain: normalizeRootDomain(inferRootDomain(window.location.hostname)),
      port: window.location.port || undefined,
    };
  }

  return {
    protocol: normalizeProtocol(envProtocol),
    rootDomain: normalizeRootDomain(envRootDomain ?? 'localhost'),
    port: envPort || '3000',
  };
}

export function isLandingHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (PLATFORM_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix) || normalized === suffix.slice(1))) {
    return true;
  }
  const { rootDomain } = getStorefrontConfig();
  if (normalized === rootDomain) return true;
  if (rootDomain !== 'localhost' && normalized === `www.${rootDomain}`) return true;
  return false;
}

export function getPlatformBaseUrl() {
  const config = getStorefrontConfig();
  const { protocol, rootDomain } = config;
  const portSuffix = getPublicPortSuffix(config);
  return `${protocol}://${rootDomain}${portSuffix}`;
}

export function getStoreBaseUrl(subdomain?: string | null) {
  const normalizedSubdomain = normalizeStoreSubdomain(subdomain ?? '');
  if (!normalizedSubdomain) {
    return getPlatformBaseUrl();
  }
  const config = getStorefrontConfig();
  const { protocol, rootDomain } = config;
  const portSuffix = getPublicPortSuffix(config);
  return `${protocol}://${normalizedSubdomain}.${rootDomain}${portSuffix}`;
}

export function getLandingUrl() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (PLATFORM_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix) || hostname === suffix.slice(1))) {
      return window.location.origin;
    }
  }
  return getPlatformBaseUrl();
}
