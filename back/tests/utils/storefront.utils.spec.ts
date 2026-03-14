import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env";
import {
  getStoreBaseUrl,
  getStoreSubdomainFromInput,
  getStoreUrl,
  normalizeStoreSubdomain,
} from "../../src/utils/storefront.utils";

const ORIGINAL_CONFIG = {
  protocol: env.STOREFRONT_PROTOCOL,
  rootDomain: env.STOREFRONT_ROOT_DOMAIN,
  port: env.STOREFRONT_PORT,
};

afterEach(() => {
  env.STOREFRONT_PROTOCOL = ORIGINAL_CONFIG.protocol;
  env.STOREFRONT_ROOT_DOMAIN = ORIGINAL_CONFIG.rootDomain;
  env.STOREFRONT_PORT = ORIGINAL_CONFIG.port;
});

describe("storefront utils", () => {
  it("normalizes store subdomains and builds localhost URLs", () => {
    env.STOREFRONT_PROTOCOL = "http";
    env.STOREFRONT_ROOT_DOMAIN = "localhost";
    env.STOREFRONT_PORT = "3000";

    expect(normalizeStoreSubdomain("Mi Tienda")).toBe("mi-tienda");
    expect(getStoreBaseUrl("mi-tienda")).toBe("http://mi-tienda.localhost:3000");
    expect(getStoreUrl("mi-tienda", "/admin/billing")).toBe("http://mi-tienda.localhost:3000/admin/billing");
    expect(getStoreSubdomainFromInput("mi-tienda.localhost:3000")).toBe("mi-tienda");
  });

  it("supports custom root domains", () => {
    env.STOREFRONT_PROTOCOL = "https";
    env.STOREFRONT_ROOT_DOMAIN = "cualquierdominio.com";
    env.STOREFRONT_PORT = "";

    expect(getStoreBaseUrl("tienda1")).toBe("https://tienda1.cualquierdominio.com");
    expect(getStoreSubdomainFromInput("https://tienda1.cualquierdominio.com/products")).toBe("tienda1");
  });

  it("ignores configured ports for non-local public domains", () => {
    env.STOREFRONT_PROTOCOL = "https";
    env.STOREFRONT_ROOT_DOMAIN = "pragmatienda-testing.up.railway.app";
    env.STOREFRONT_PORT = "3000";

    expect(getStoreBaseUrl("tienda1")).toBe("https://tienda1.pragmatienda-testing.up.railway.app");
    expect(getStoreUrl(undefined, "/api/public/verify")).toBe("https://pragmatienda-testing.up.railway.app/api/public/verify");
  });
});
