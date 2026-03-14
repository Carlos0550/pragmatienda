import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env";
import { buildWelcomeUserEmailHtml } from "../../src/utils/template.utils";

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

describe("template utils", () => {
  it("builds the welcome verification link on the store subdomain", async () => {
    env.STOREFRONT_PROTOCOL = "https";
    env.STOREFRONT_ROOT_DOMAIN = "pragmatienda-testing.up.railway.app";
    env.STOREFRONT_PORT = "3000";

    const html = await buildWelcomeUserEmailHtml({
      user: {
        id: "user-1",
        email: "cliente@example.com",
        name: "Carlos",
        tenantId: "tenant-1"
      },
      business: {
        name: "Cinnamon Makeup",
        website: "cinnamon-makeup"
      }
    });

    expect(html).toContain("https://cinnamon-makeup.pragmatienda-testing.up.railway.app/api/public/verify?token=");
  });
});
