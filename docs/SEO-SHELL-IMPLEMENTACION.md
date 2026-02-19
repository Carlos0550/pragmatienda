# SEO Shell – Guía de implementación futura

> Documento de referencia para implementar SEO dinámico en el storefront multitenant sin migrar a Next.js ni usar SSR completo.

---

## 1. Contexto

- **Frontend:** Vite + React (SPA) en `front/`
- **Backend:** Express en `back/`
- **Multitenant:** Subdominios tipo `mix24.pragmatienda.com`, `joyascapitio.pragmatienda.com`
- **Problema:** El SPA sirve siempre el mismo HTML; crawlers no ven meta dinámicos por tienda/producto.

---

## 2. Enfoque: Shell de SEO

El backend inyecta meta tags dinámicos en el `<head>` del HTML antes de enviarlo. El SPA sigue ejecutándose 100% en el cliente (shadcn-ui, Framer Motion, etc. sin cambios).

```
Request → Backend lee Host + path → Resuelve tenant/producto → Inyecta meta en index.html → Envía HTML
```

---

## 3. Flujo técnico

```
GET https://mix24.pragmatienda.com/products/aceite-oliva-1l
    │
    ├─ Host: mix24.pragmatienda.com  → resolver tenant "mix24"
    ├─ Path: /products/aceite-oliva-1l → obtener producto por slug
    │
    └─ HTML generado:
       <head>
         <title>Aceite Oliva 1L | Mix24 - PragmaTienda</title>
         <meta name="description" content="...">
         <meta property="og:title" content="...">
         <meta property="og:image" content="...">
         <meta property="og:url" content="https://mix24.pragmatienda.com/products/aceite-oliva-1l">
       </head>
       <body>
         <div id="root"></div>   ← vacío, React hidrata en cliente
         <script src="/assets/main.js"></script>
       </body>
```

---

## 4. Rutas que reciben SEO shell

| Ruta | Meta dinámicos |
|------|----------------|
| `/` | Tenant (nombre, descripción, logo) |
| `/products` | Tenant |
| `/products/:slug` | Tenant + Producto (title, description, image) |
| `/cart`, `/login`, `/register` | Tenant (opcional) |

---

## 5. Requisitos en el backend

### 5.1 Ya existe

- `GET /api/public/tenant/resolve?url=hostname` → Resuelve tenant por subdominio
- `businessService.resolveTenantIdByStoreUrl(url)` → Lógica de resolución
- Productos con `metadata` (title, description, keywords) generados por Groq

### 5.2 Falta crear

| Pieza | Ubicación sugerida | Descripción |
|-------|-------------------|-------------|
| `getProductBySlug(tenantId, slug)` | `back/src/services/Products/products.service.ts` | Obtener producto público por slug. El modelo `Products` usa `name`; slug puede derivarse (normalizar nombre) o agregar campo `slug` en Prisma. |
| Endpoint `GET /api/public/products/:slug` | `back/src/routes/public.routes.ts` | Opcional si el SEO shell se hace en el mismo proceso; si no, el handler de SEO puede llamar al service directamente. |
| `resolveTenant` con datos completos | `business.service.ts` | Actualmente devuelve `{ tenantId, businessName }`. Para SEO se necesita: `name`, `logo`, `banner`, `favicon`, `description`, `socialLinks`. |
| Handler de SEO shell | `back/src/` (ej. `seo-shell.ts` o middleware) | Recibe request, resuelve tenant/producto, inyecta meta en HTML, responde. |
| Orden de rutas | `back/src/app.ts` | API primero, luego SEO shell para rutas storefront, luego static. |

### 5.3 Estructura del handler de SEO

```
back/src/
├── seo-shell/
│   ├── seo-shell.middleware.ts   # Handler que inyecta meta
│   ├── seo-meta.utils.ts         # buildMetaTags(tenant, product, path)
│   └── index.ts
```

---

## 6. Requisitos en el frontend

### 6.1 Cambios mínimos

- **index.html:** Añadir placeholders en `<head>` para que el backend los reemplace:

```html
<title>__SEO_TITLE__</title>
<meta name="description" content="__SEO_DESCRIPTION__">
<meta property="og:title" content="__OG_TITLE__">
<meta property="og:description" content="__OG_DESCRIPTION__">
<meta property="og:image" content="__OG_IMAGE__">
<meta property="og:url" content="__OG_URL__">
<meta property="og:type" content="__OG_TYPE__">
```

- **Build:** El output de `vite build` debe generar `index.html` con esos placeholders. El backend lee ese archivo en producción y hace los reemplazos.

### 6.2 Sin cambios

- React, React Router, shadcn-ui, Framer Motion, contextos, páginas.
- Todo sigue ejecutándose en el cliente.

---

## 7. Orden de rutas en Express (app.ts)

```ts
// 1. API
app.use("/api", apiRouter);

// 2. Docs, etc.
app.use("/docs", ...);

// 3. SEO shell para storefront (ANTES de static)
app.get(["/", "/products", "/products/*", "/cart", "/login", "/register"], seoShellHandler);

// 4. Static del front (SPA)
app.use(express.static(path.join(__dirname, "../front/dist")));

// 5. Fallback SPA (React Router maneja rutas)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../front/dist/index.html"));
});
```

---

## 8. Despliegue

- El backend debe poder servir el HTML del storefront (o un proxy debe enviar esas rutas al backend).
- En desarrollo: Vite dev server sirve el front; el SEO shell solo aplica en producción cuando Express sirve el build.

---

## 9. Checklist para retomar

- [ ] Backend: Ampliar `resolveTenantIdByStoreUrl` para devolver datos completos del tenant (logo, descripción, etc.)
- [ ] Backend: Crear `getProductBySlug` o equivalente (slug/name normalizado)
- [ ] Backend: Crear `seo-shell` handler + `buildMetaTags`
- [ ] Backend: Registrar rutas SEO shell en `app.ts` antes del static
- [ ] Frontend: Añadir placeholders `__SEO_*__` en `index.html`
- [ ] Probar con subdominio real (mix24.pragmatienda.com) que los meta cambien por tienda/producto

---

## 10. Referencias en el codebase

| Archivo | Relevancia |
|---------|------------|
| `back/src/services/Business/business.service.ts` | `resolveTenantIdByStoreUrl` (líneas ~155-230) |
| `back/src/services/Products/products.service.ts` | Lógica de productos, metadata |
| `back/src/services/SEO/seo.service.ts` | Generación de metadata con Groq |
| `back/src/app.ts` | Orden de middlewares y rutas |
| `front/index.html` | Donde irán los placeholders |
| `front/src/contexts/TenantContext.tsx` | Cómo el front resuelve tenant hoy |

---

*Documento creado para retomar la implementación del SEO shell en el futuro.*
