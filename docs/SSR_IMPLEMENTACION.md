# Resumen: implementación SSR y SEO en Pragmatienda

Documento que describe cómo se implementó el **Server-Side Rendering (SSR)** y el **SEO** en la plataforma multi-tenant Pragmatienda, qué decisiones técnicas se tomaron y dónde está cada pieza del código.

---

## 1. Objetivo

- Renderizar en servidor las páginas públicas del escaparate (home, listado de productos, detalle de producto, categoría) para que los buscadores reciban **HTML real** y se mejore la indexación.
- Mantener la **SPA** intacta: rutas de admin, login y flujos que no son storefront siguen siendo cliente-only.
- **Multi-tenant por hostname**: cada tienda se identifica por dominio (ej. `tienda.pragmatienda.com`); el landing (`pragmatienda.com`) muestra la landing corporativa.
- **SEO**: meta tags dinámicos, canonical, Open Graph, Twitter Cards y JSON-LD para productos; sitemap y robots.txt por tenant.

---

## 2. Arquitectura general

```
Cliente (navegador)
       │
       ▼
  Express (back)  ←  app.get("*", ssrHandler)
       │
       ├── /api/*        → API REST (sin SSR)
       ├── /docs, /docs.json, /assets/*, *.js, *.css  → bypass SSR
       ├── /sitemap.xml  → sitemapHandler (multi-tenant)
       ├── /robots.txt   → robotsHandler (multi-tenant)
       └── *             → ssrHandler
              │
              ├── Resolver tenant por hostname
              ├── Detectar tipo de ruta (home, products, product, category, landing, spa)
              ├── Prefetch de datos (Prisma en back)
              ├── Cargar entry-server (front compilado)
              ├── renderToPipeableStream (React 18)
              ├── Inyectar HTML + __PRAGMATIENDA_SSR__ + scripts
              └── Respuesta 200 con HTML completo
```

- **Frontend**: React 18, Vite, React Router, Zustand, TanStack Query.
- **Backend**: Node.js, Express, Prisma (PostgreSQL). El mismo proceso Express sirve la API y el SSR.
- **Build**: el front genera dos artefactos: **client bundle** (entry-client) y **server bundle** (entry-server). El back en producción sirve los estáticos del client y ejecuta el server bundle para renderizar.

---

## 3. Dónde está implementado

### 3.1 Frontend (carpeta `front/`)

| Ubicación | Descripción |
|-----------|-------------|
| `src/entry-client.tsx` | Punto de entrada en el navegador: lee `window.__PRAGMATIENDA_SSR__`, hidrata Zustand (tenant, auth) y React Query (`HydrationBoundary`), configura `api.setTenantId` para peticiones posteriores, y usa `hydrateRoot` o `createRoot` según haya o no payload SSR. |
| `src/entry-server.tsx` | Punto de entrada en el servidor: recibe `url`, `routeKind`, `tenantState`, `authState`, `prefetch`. Rellena el QueryClient con los datos pre-cargados, llama a `buildSeo()`, devuelve el árbol React con `StaticRouter` + `AppRoutes` y el payload (incl. `reactQueryState` deshidratado). |
| `src/AppRoutes.tsx` | Definición de rutas (React Router) compartida entre cliente (`BrowserRouter`) y servidor (`StaticRouter`). |
| `src/App.tsx` | Envuelve `AppRoutes` con `ClientBootstrap`; en cliente se usa desde `entry-client.tsx`. |
| `src/components/ClientBootstrap.tsx` | Solo cliente: en `useEffect` resuelve tenant y/o hidrata auth desde cookie si no se usó bootstrap SSR (evita doble llamada cuando ya vino todo en el payload). |
| `src/lib/ssr.ts` | Tipos del payload SSR: `SsrRouteKind`, `TenantBootstrapState`, `AuthBootstrapState`, `SsrPrefetchedData`, `SsrBootstrapPayload` y declaración de `window.__PRAGMATIENDA_SSR__`. Función `getSsrBootstrapPayload()` para leerlo en cliente. |
| `src/lib/seo.ts` | Construcción de metadatos por ruta: `buildSeo()` devuelve `SeoPayload` (title, description, canonical, robots, og, twitter, jsonLd). Incluye JSON-LD tipo Product/Offer para detalle de producto. |
| `src/lib/query-client.ts` | Creación del `QueryClient` compartida entre cliente y servidor (misma configuración). |
| `src/lib/storefront-query-keys.ts` | Claves de React Query para storefront (categorías, productos, planes públicos) para prefetch y caché. |
| `src/hooks/storefront-queries.ts` | Hooks (`useStorefrontCategories`, `useStorefrontProducts`, etc.) que usan esas claves; el servidor rellena la caché con los mismos datos para evitar refetch tras hidratación. |
| `src/main.tsx` | Solo importa `entry-client.tsx` para arrancar la app en el navegador. |
| `index.html` | El script de entrada apunta al bundle generado desde `entry-client.tsx`. |
| `vite.config.ts` | Proxy de `/api` a backend (target configurable por `VITE_PROXY_API_TARGET` para Docker). Build client y SSR con salidas en `dist/client` y `dist/server`. |

### 3.2 Backend (carpeta `back/`)

| Ubicación | Descripción |
|-----------|-------------|
| `src/ssr/renderer.ts` | Lógica central del SSR: normalización de host, detección de ruta (`matchRoute`), resolución de tenant por hostname (`resolveTenantFromHostname`), prefetch por tipo de ruta (`buildPrefetchData`), carga del módulo `entry-server` del front, generación de HTML (head con meta + tail con script del payload y bundles), `renderToPipeableStream`, y handlers `ssrHandler`, `sitemapHandler`, `robotsHandler`. Incluye normalización de productos (precio Decimal de Prisma) y categorías para el payload. |
| `src/app.ts` | Monta rutas: `express.static` para `front/dist/client`, `get("/sitemap.xml", sitemapHandler)`, `get("/robots.txt", robotsHandler)`, `get("*", ssrHandler)`. Configuración de Helmet (CSP con img/connect-src para MinIO y frontend). |
| `src/config/env.ts` | Variables de entorno (DATABASE_URL, REDIS_URL, MINIO_*, FRONTEND_URL, JWT_SECRET, etc.). |
| Servicios existentes | `businessService.resolveTenantIdByStoreUrl`, `categoriesService`, `productsService`, `billingService.listPublicPlans` se reutilizan para el prefetch; no se duplica lógica. |

### 3.3 Base de datos y API

| Ubicación | Descripción |
|-----------|-------------|
| `back/prisma/schema.prisma` | En modelos de productos y categorías: campos `slug`, `metaTitle`, `metaDescription`; `@@unique([tenantId, slug])` y `@@index([slug])` para URLs y SEO. |
| Migraciones | Migración que añade slug/meta y rellena slugs existentes. |
| `back/src/services/Categories/` | `getOneBySlug`, generación de slug en create/update. |
| `back/src/services/Products/` | Filtro por `categorySlug` en listado; persistencia de metaTitle/metaDescription. |
| `back/src/routes/public.routes.ts` | Ruta pública `GET /public/categories/:slug` para categoría por slug. |

---

## 4. Flujo de una petición SSR

1. **Llega** `GET https://tienda.pragmatienda.com/products/argollas-huggie`.
2. **Express** no matchea `/api`, `/docs`, ni estáticos → pasa a `ssrHandler`.
3. **Host** se normaliza (incl. `x-forwarded-host` en producción).
4. **Ruta**: `matchRoute` devuelve `{ kind: "product", params: { slug: "argollas-huggie" } }`.
5. **Tenant**: `resolveTenantFromHostname("tienda.pragmatienda.com")` → tenantId y tenantState.
6. **Prefetch**: `buildPrefetchData` con `kind: "product"` y tenantId → categorías, producto por slug (servicios Prisma en back).
7. **Entry-server**: se carga el bundle compilado del front (`dist/server/entry-server.js`); se llama a `createServerRenderPayload({ url, baseUrl, routeKind, tenantState, authState, prefetch })`.
8. **En entry-server**: se rellenan Zustand (tenant, auth) y QueryClient con los datos del prefetch; `buildSeo()` genera title, description, canonical, og, twitter, jsonLd; se renderiza el árbol con `StaticRouter` y `AppRoutes`; se deshidrata el QueryClient.
9. **En renderer**: se construye el HTML (doctype, head con meta y estilos/preloads, body con `<div id="root">`), se hace **renderToPipeableStream** al root, se cierra el div y se inyecta `<script>window.__PRAGMATIENDA_SSR__ = { ... };</script>` y los scripts del client bundle.
10. **Respuesta**: 200, HTML completo. El navegador ejecuta el client bundle; `entry-client.tsx` lee `__PRAGMATIENDA_SSR__`, rellena tenant/auth y `api.setTenantId`, hidrata React Query y hace `hydrateRoot` del árbol. No se vuelven a pedir categorías/producto para esa ruta porque ya están en caché.

---

## 5. Decisiones técnicas

- **React 18 `renderToPipeableStream`**: streaming del HTML; el payload de bootstrap se inyecta después del root para no bloquear.
- **Un solo proceso Express** para API y SSR: despliegue sencillo; el SSR solo se aplica a rutas no excluidas (`shouldBypassSsr`).
- **Tenant por hostname**: mismo mecanismo que en cliente; en SSR se usa `businessService.resolveTenantIdByStoreUrl(hostname)`.
- **Prefetch en back**: los datos los obtiene el servidor con Prisma/servicios; el front solo recibe datos ya normalizados y rellena el QueryClient con las mismas claves que usan los hooks. Así no hay doble petición ni “parpadeo” al hidratar.
- **Entry client vs server**: el cliente usa `BrowserRouter` y `hydrateRoot`/`createRoot`; el servidor usa `StaticRouter` y no monta Toaster ni lógica solo-cliente. Las rutas son las mismas (`AppRoutes`).
- **Cookie de auth en SSR**: se lee la cookie en el request y se pasa `hasAuthCookie` en el payload; el cliente puede decidir si hidratar auth en segundo plano sin bloquear la primera pintura.
- **`react-dom/server` del front**: el renderer del back carga `react-dom/server` desde `front/node_modules` cuando existe, para evitar conflictos de versión con el React del front.
- **Precio Decimal (Prisma)**: en el payload SSR los productos se normalizan en el back (incl. en `renderer.ts`) manejando `Decimal` (toNumber/toString/valueOf) para que el precio no llegue como 0 al cliente.
- **Header `x-tenant-id`**: tras la hidratación, en `entry-client.tsx` se llama a `api.setTenantId(tenant?.id ?? null)` para que las peticiones posteriores al API lleven el tenant correcto y no fallen con “Tenant requerido”.
- **Sitemap y robots**: por hostname; el sitemap incluye `/`, `/products`, `/products/:slug`, `/category/:slug` del tenant; robots.txt referencia la URL del sitemap.
- **Landing**: en `pragmatienda.com` (y localhost) la ruta efectiva es `landing`; en cualquier path que no sea `/` se redirige a `/`. El resto de dominios son tiendas (o 404 si no hay tenant).

---

## 6. Rutas que tienen SSR (storefront)

- `landing`: `/` en dominio landing → datos de planes públicos.
- `home`: `/` en subdominio de tienda → categorías + productos destacados.
- `products`: `/products` → listado (con filtros en query).
- `product`: `/products/:slug` → detalle + JSON-LD Product/Offer.
- `category`: `/category/:slug` → productos de esa categoría.

Cualquier otra ruta (admin, login, cart, etc.) se considera `spa`: se sirve el shell HTML con payload mínimo y `routeKind: "spa"`; el cliente hace el enrutado y no se prefetchan datos de storefront.

---

## 7. Build y ejecución

- **Solo front (estático)**: `npm run build` en `front/` → `dist/client`. Sirve solo si no usas SSR (ej. otro host que no sea el back).
- **SSR (producción)**: en `back/`: `npm run build:ssr` → construye `front` (client + server) y luego compila el back. Al arrancar, el back sirve `front/dist/client` como estáticos y usa `front/dist/server/entry-server.js` para el SSR.
- **Desarrollo**: en local, `npm run dev` en front (Vite, puerto 3000) y `npm run dev` en back (tsx watch, puerto 3001); el SSR en dev puede usar los bundles de front si se han generado (`build:client` + `build:server` o watch equivalente).
- **Docker**: el `Dockerfile` en la raíz construye front (client+server) y back en una sola imagen; en runtime el servicio que expone la web debe ser el back (Express con SSR). El front estático por separado no aplica SSR.

---

## 8. SEO implementado

- **Meta tags**: title y description por página (landing, home, producto, categoría), con fallbacks.
- **Canonical**: URL canónica por ruta y host.
- **Robots**: `index,follow` en storefront; `noindex,follow` en rutas SPA.
- **Open Graph** y **Twitter Card**: type, title, description, url, image (producto/categoría cuando aplica).
- **JSON-LD**: tipo Product con Offer (precio, disponibilidad, URL) en la página de detalle de producto.
- **Sitemap.xml**: por tenant, con las URLs públicas anteriores.
- **Robots.txt**: por tenant, con `Sitemap:` apuntando al sitemap del host.

Todo lo anterior se genera en servidor (en `buildSeo` y en los handlers de sitemap/robots) y se inyecta en el HTML o se sirve en las rutas correspondientes.
