# Análisis completo del proyecto Pragmatienda

Este documento describe la estructura, tecnologías, rutas y arquitectura del **frontend** y **backend** del proyecto Pragmatienda (tienda online multi-tenant con administración y facturación SaaS).

---

## 1. Visión general

| Aspecto | Frontend | Backend |
|--------|----------|---------|
| **Nombre** | `vite_react_shadcn_ts` | `back` |
| **Tipo** | SPA (Single Page Application) | API REST |
| **Puerto dev** | 3000 | 3001 |
| **Proxy** | `/api` → `http://localhost:3001` | — |

El front se comunica con el back mediante **axios** usando la base URL `/api` (proxy en dev a `localhost:3001`). La API está montada bajo el prefijo `/api` y la documentación OpenAPI/Swagger en `/docs`.

---

## 2. Backend

### 2.1 Stack tecnológico

| Dependencia | Uso |
|-------------|-----|
| **Node.js** | Runtime |
| **Express** | Servidor HTTP y rutas |
| **TypeScript** | Lenguaje |
| **Prisma** | ORM + migraciones (PostgreSQL) |
| **Zod** | Validación y esquemas (integración con OpenAPI) |
| **tsx** | Ejecución/desarrollo TS (watch) |
| **dotenv** | Variables de entorno |
| **cors** | CORS |
| **helmet** | Cabeceras de seguridad |
| **multer** | Subida de archivos (multipart) |
| **jsonwebtoken** | Tokens JWT para sesiones |
| **winston** | Logs |
| **pg** + **@prisma/adapter-pg** | Driver PostgreSQL para Prisma |
| **redis** | Cache/sesiones (invalidación de tokens) |
| **minio** | Almacenamiento de objetos (imágenes, comprobantes) |
| **sharp** | Procesamiento de imágenes |
| **mercadopago** | Pagos y suscripciones (Mercado Pago) |
| **nodemailer** / **resend** | Envío de emails (resend en prod, ethereal en dev) |
| **dayjs** | Fechas |
| **@asteasolutions/zod-to-openapi** | OpenAPI 3 desde esquemas Zod |
| **swagger-ui-express** | UI de documentación en `/docs` |
| **groq-sdk** | Integración con Groq (posible uso en SEO/IA) |

### 2.2 Estructura del backend

```
back/
├── prisma/
│   ├── schema.prisma    # Modelos y enums
│   └── seed.ts          # Datos iniciales
├── src/
│   ├── server.ts        # Punto de entrada: DB, Redis, MinIO, servidor
│   ├── app.ts           # Express: CORS, JSON, rutas, Swagger, errores
│   ├── config/
│   │   ├── env.ts       # Variables de entorno (Zod)
│   │   ├── dayjs.ts     # Configuración dayjs
│   │   ├── logger.ts    # Winston
│   │   └── security.ts  # JWT, sesiones
│   ├── constants/
│   │   └── roles.ts     # SUPERADMIN_ROLE = 9
│   ├── db/
│   │   └── prisma.ts    # Cliente Prisma
│   ├── cache/
│   │   └── redis.ts    # Conexión Redis
│   ├── storage/
│   │   └── minio.ts     # Buckets MinIO
│   ├── mail/
│   │   └── mailer.ts    # Nodemailer/Resend
│   ├── middlewares/
│   │   ├── index.ts
│   │   ├── auth.middleware.ts      # requireRole, requireSuperAdmin
│   │   ├── tenant.middleware.ts    # requireTenant, x-tenant-id
│   │   ├── subscription.middleware.ts
│   │   ├── upload.middleware.ts   # Multer + Sharp
│   │   └── idempotency.middleware.ts
│   ├── routes/
│   │   ├── index.ts     # Agregador de rutas bajo /api
│   │   ├── public.routes.ts
│   │   ├── admin.routes.ts
│   │   ├── user.routes.ts
│   │   ├── cart.routes.ts
│   │   ├── payments.routes.ts
│   │   └── superadmin.routes.ts
│   ├── controllers/
│   │   ├── business.controller.ts
│   │   ├── categories.controller.ts
│   │   ├── products.controller.ts
│   │   ├── user.controller.ts
│   │   ├── cart.controller.ts
│   │   ├── payments.controller.ts
│   │   └── billing.controller.ts
│   │   └── superadmin.controller.ts
│   ├── services/
│   │   ├── Business/
│   │   ├── Categories/
│   │   ├── Products/
│   │   ├── Users/
│   │   ├── Cart/
│   │   ├── SEO/
│   │   └── ...
│   ├── billing/
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── payments/
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── superadmin/
│   │   ├── application/
│   │   └── plans.zod.ts
│   ├── docs/
│   │   └── swagger.ts   # OpenAPI registry y spec
│   ├── utils/
│   └── scripts/        # sync-mp, billing, superadmin-token
└── tests/
```

### 2.3 Base de datos (Prisma)

- **Provider:** PostgreSQL.
- **Enums:** `PlanType`, `UserStatus`, `ProductsStatus`, `OrderStatus`, `PaymentStatus`, `FulfillmentStatus`, `PaymentProvider`, `BillingStatus`.
- **Modelos principales:** `Tenant`, `User`, `BusinessData`, `ProductsCategory`, `Products`, `Cart`, `CartItem`, `Order`, `OrderItem`, `PaymentEvent`, `IdempotencyKey`, `StorePaymentAccount`, `Payment`, `Plan`, `Subscription`, `SubscriptionEvent`.

Multi-tenant: la mayoría de tablas tienen `tenantId` y las consultas se filtran por tenant (header `x-tenant-id`).

### 2.4 Roles

- **1** = Admin del negocio (tenant).
- **2** = Cliente (customer).
- **9** = Superadmin (plataforma).

Los middlewares `requireRole([1])`, `requireRole([2])`, `requireRole([1, 2])` y `requireSuperAdmin` restringen el acceso por rol.

### 2.5 Rutas del backend (prefijo base: `/api`)

Todas las rutas están documentadas en OpenAPI y servidas en `/docs` y `/docs.json`.

#### Public (`/api/public`) — sin JWT

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/public/health` | Health check |
| GET | `/public/tenant/resolve` | Resolver tenant por hostname (store URL) |
| GET | `/public/plans` | Planes públicos (billing) |
| GET | `/public/categories` | Categorías (requiere `x-tenant-id`) |
| GET | `/public/products` | Listado productos públicos |
| GET | `/public/products/:id` | Detalle producto (por id) |
| POST | `/public/platform/businesses` | Crear negocio + tenant |
| POST | `/public/register` | Registro cliente |
| POST | `/public/login` | Login cliente |
| POST | `/public/password/recovery` | Recuperar contraseña cliente |
| GET | `/public/verify` | Verificar cuenta |
| POST | `/public/admin/login` | Login admin negocio |
| POST | `/public/admin/password/recovery` | Recuperar contraseña admin |

#### Admin (`/api/admin`) — JWT + rol admin (1) + tenant

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/business` | Datos del negocio |
| PUT | `/admin/business/manage` | Actualizar negocio (multipart) |
| PUT | `/admin/me/password` | Cambiar contraseña admin |
| GET | `/admin/mercadopago/status` | Estado conexión MP |
| GET | `/admin/mercadopago/connect-url` | URL para conectar MP |
| GET/POST/PUT/DELETE | `/admin/categories` | CRUD categorías |
| GET/POST/PUT | `/admin/products` | Listar, crear, actualizar productos |
| DELETE | `/admin/products/bulk` | Eliminar productos en lote |
| PATCH | `/admin/products/bulk/status` | Cambiar estado en lote |

#### User (`/api/user`) — JWT + rol 1 o 2 + tenant

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/user/me` | Usuario actual |
| PUT | `/user/me` | Actualizar perfil |
| PUT | `/user/me/password` | Cambiar contraseña |
| PUT | `/user/me/avatar` | Subir avatar (multipart) |

#### Cart (`/api/cart`) — JWT + rol cliente (2) + tenant

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/cart` | Obtener carrito |
| PATCH | `/cart/items` | Modificar cantidades |
| DELETE | `/cart/items` | Eliminar ítems |
| POST | `/cart/checkout` | Checkout con comprobante (multipart, idempotency) |

#### Payments (`/api/payments`) — mezcla público/admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/payments/mercadopago/connect/:storeId` | Iniciar OAuth MP (admin) |
| GET | `/payments/mercadopago/callback` | Callback OAuth MP |
| GET | `/payments/billing/subscriptions/current` | Suscripción actual (admin) |
| GET | `/payments/billing/plans` | Planes para billing (admin) |
| POST | `/payments/checkout/:orderId` | Crear checkout MP (idempotency) |
| POST | `/payments/billing/subscriptions` | Crear suscripción (admin) |
| PATCH | `/payments/billing/subscriptions/current/plan` | Cambiar plan (admin) |
| POST | `/payments/billing/sync` | Sincronizar suscripciones (admin) |
| POST | `/payments/webhooks/mercadopago` | Webhook Mercado Pago |

#### Superadmin (`/api/superadmin`) — JWT + rol 9

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/superadmin/plans` | Listar planes |
| GET | `/superadmin/plans/:id` | Plan por id |
| POST | `/superadmin/plans` | Crear plan |
| PUT | `/superadmin/plans/:id` | Actualizar plan |
| DELETE | `/superadmin/plans/:id` | Desactivar plan |

### 2.6 Variables de entorno (backend)

- `NODE_ENV`, `PORT`, `LOG_LEVEL`
- `DATABASE_URL`, `REDIS_URL`
- `CORS_ORIGIN`
- `MINIO_*` (endpoint, puerto, SSL, credenciales, `MINIO_PUBLIC_URL`)
- `MAIL_PROVIDER`, `RESEND_API_KEY`, `MAIL_FROM`
- `SECURITY_ENCRYPTION_KEY`, `JWT_SECRET`
- `FRONTEND_URL`, `BACKEND_URL`
- `GROQ_API_KEY`
- `MP_*` (Mercado Pago: client, secret, redirect, webhook, billing, etc.)
- `BILLING_ALLOW_PAST_DUE`

---

## 3. Frontend

### 3.1 Stack tecnológico

| Dependencia | Uso |
|-------------|-----|
| **React 18** | UI |
| **TypeScript** | Lenguaje |
| **Vite 5** | Build y dev server |
| **@vitejs/plugin-react-swc** | React + SWC |
| **react-router-dom 6** | Rutas SPA |
| **axios** | Cliente HTTP hacia `/api` |
| **Zustand** | Estado global (auth, tenant, carrito) |
| **@tanstack/react-query** | Cache y estado servidor (queries/mutations) |
| **Tailwind CSS 3** | Estilos |
| **tailwindcss-animate** | Animaciones |
| **@tailwindcss/typography** | Prose (dev) |
| **Radix UI** (varios paquetes) | Componentes accesibles (accordion, dialog, dropdown, tabs, etc.) |
| **shadcn/ui** (vía components.json) | Sistema de componentes (slate, CSS variables) |
| **class-variance-authority**, **clsx**, **tailwind-merge** | Clases y variantes |
| **lucide-react** | Iconos |
| **framer-motion** | Animaciones |
| **react-hook-form** + **@hookform/resolvers** + **zod** | Formularios y validación |
| **date-fns**, **react-day-picker** | Fechas y calendario |
| **recharts** | Gráficos |
| **sileo** | Toasts (usado en `App.tsx`) |
| **cmdk**, **vaul**, **embla-carousel-react**, **input-otp**, **react-resizable-panels** | Componentes adicionales |
| **next-themes** | Tema claro/oscuro (config Tailwind `darkMode: ["class"]`) |

### 3.2 Estructura del frontend

```
front/
├── index.html
├── vite.config.ts         # Puerto 3000, proxy /api → 3001, alias @
├── tailwind.config.ts      # Tema, colores HSL, animaciones
├── postcss.config.js
├── components.json        # shadcn: default, tsx, slate, cssVariables
├── src/
│   ├── main.tsx           # createRoot + App + index.css
│   ├── App.tsx            # QueryClient, Toaster, BrowserRouter, rutas
│   ├── App.css
│   ├── index.css          # Tailwind + variables CSS
│   ├── vite-env.d.ts
│   ├── types/
│   │   └── index.ts        # Tipos compartidos
│   ├── lib/
│   │   ├── utils.ts       # cn() (clsx + tailwind-merge)
│   │   ├── cookies.ts     # Token en cookie
│   │   └── api-utils.ts   # Normalización respuestas API
│   ├── services/
│   │   ├── api.ts         # Cliente axios: tenant, token, interceptores
│   │   └── http.ts        # Capa de llamadas por dominio (tenant, auth, business, categories, products, cart, billing, payments, superadmin)
│   ├── stores/
│   │   ├── auth.ts        # Zustand: user, login/logout, hydrate
│   │   ├── tenant.ts      # Zustand: tenant, resolveTenant por hostname
│   │   └── cart.ts        # Estado del carrito
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── TenantContext.tsx
│   │   └── CartContext.tsx
│   ├── components/
│   │   ├── ProtectedRoute.tsx   # requiredRole: admin | customer | superadmin
│   │   ├── NavLink.tsx
│   │   ├── StorefrontLoader.tsx
│   │   ├── BillingRequired.tsx
│   │   └── ui/               # shadcn: alert, button, card, dialog, input, table, etc.
│   ├── layouts/
│   │   ├── StorefrontLayout.tsx
│   │   ├── AdminLayout.tsx
│   │   └── SuperAdminLayout.tsx
│   ├── pages/
│   │   ├── Index.tsx
│   │   ├── NotFound.tsx
│   │   ├── ForbiddenPage.tsx
│   │   ├── landing/
│   │   │   └── LandingPage.tsx
│   │   ├── storefront/
│   │   │   ├── Home.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── Cart.tsx
│   │   │   ├── Checkout.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── CustomerLogin.tsx
│   │   │   ├── CustomerRegister.tsx
│   │   │   └── StoreNotFoundFallback.tsx
│   │   ├── admin/
│   │   │   ├── AdminLogin.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Business.tsx
│   │   │   ├── Categories.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── Billing.tsx
│   │   │   └── MercadoPago.tsx
│   │   └── superadmin/
│   │       └── Plans.tsx
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   └── use-mobile.tsx
│   └── test/
│       ├── setup.ts
│       ├── test-utils.tsx
│       └── example.test.ts
└── vitest.config.ts
```

### 3.3 Rutas del frontend (React Router)

- **Storefront** (layout `StorefrontLayout`): `/`, `/products`, `/products/:slug`, `/cart`, `/checkout`, `/profile`, `/login`, `/register`.
- **Admin**: `/admin/login` (sin layout), `/admin` con layout y rutas: index → Dashboard, `business`, `categories`, `products`, `billing`.
- **SuperAdmin**: `/superadmin` con layout, índice redirige a `/superadmin/plans`.
- **Errores**: `/403` (Forbidden), `*` (NotFound).

`/checkout` y `/profile` exigen rol `customer`; `/admin` exige `admin`; `/superadmin` exige `superadmin`. Si no hay usuario se redirige a `/admin/login` o `/login` según el rol requerido.

### 3.4 Autenticación y tenant en el frontend

- **api.ts**: Cliente axios con `baseURL` `/api`, interceptores que añaden `x-tenant-id` y `Authorization: Bearer <token>`. Token en cookie; manejo de 401 (logout) y 402 (billing required).
- **tenant**: Se resuelve al cargar la app por `window.location.hostname`. En `pragmatienda.com` / `www.pragmatienda.com` / `localhost` se considera landing y no se llama a resolve; en otros dominios se llama a `GET /api/public/tenant/resolve` y se guarda el tenant en Zustand y en el cliente API.
- **auth**: Zustand + contexto; `hydrate()` lee token, llama a `GET /api/user/me` y guarda usuario; `loginAdmin` / `loginCustomer` guardan token y refrescan usuario.

### 3.5 Variables de entorno (frontend)

- `VITE_API_BASE_URL`: base URL del API (por defecto `/api`).

---

## 4. Flujo resumido

1. **Landing**: Usuario entra por dominio raíz (pragmatienda.com) → landing. Por subdominio/dominio de tienda → resolve tenant → storefront de esa tienda.
2. **Cliente**: Registro/login vía `/api/public/*`; JWT en cookie; acceso a productos, carrito, checkout (comprobante), perfil.
3. **Admin**: Login en `/api/public/admin/login`; gestión de negocio, categorías, productos, billing, Mercado Pago; suscripciones vía `/api/payments/billing/*`.
4. **Superadmin**: Token con rol 9; CRUD de planes en `/api/superadmin/plans`.
5. **Pagos**: Mercado Pago para checkout de órdenes y para suscripciones SaaS; webhooks en `/api/payments/webhooks/mercadopago`; idempotencia en checkout y en creación de checkout MP.

---

## 5. Resumen de tecnologías

| Capa | Tecnologías principales |
|------|-------------------------|
| **Frontend** | React 18, TypeScript, Vite, React Router 6, Zustand, TanStack Query, Tailwind, shadcn/Radix, Axios, React Hook Form, Zod |
| **Backend** | Node.js, Express, TypeScript, Prisma (PostgreSQL), Zod, JWT, Redis, MinIO, Mercado Pago, Resend/Nodemailer, OpenAPI/Swagger |
| **Infra** | PostgreSQL, Redis, MinIO (S3-compatible) |

El documento OpenAPI está disponible en **`/docs`** (y el JSON en **`/docs.json`**) una vez el backend está en marcha.
