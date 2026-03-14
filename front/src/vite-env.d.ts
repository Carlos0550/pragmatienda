/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_STOREFRONT_PROTOCOL?: "http" | "https";
  readonly VITE_STOREFRONT_ROOT_DOMAIN?: string;
  readonly VITE_STOREFRONT_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
