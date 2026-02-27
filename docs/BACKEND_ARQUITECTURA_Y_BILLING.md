# Backend Pragmatienda: arquitectura completa (enfoque en suscripciones, planes y cobros)

## 1) Stack y propósito del backend

Este backend está construido con:
- Express + TypeScript
- Prisma 7 + PostgreSQL
- Redis (sesiones e idempotencia)
- MinIO (assets)
- Mercado Pago (dos módulos distintos: **pagos de tienda** y **billing SaaS**)
- Zod + OpenAPI/Swagger

Objetivo general:
- Servir una plataforma multitenant de tiendas.
- Gestionar autenticación de clientes/admin/superadmin.
- Gestionar catálogo, carrito, órdenes y pagos de cada tienda.
- Cobrar suscripciones mensuales a cada tienda (billing SaaS).

---

## 2) Estructura de alto nivel

En `back/src`:
- `app.ts`: middlewares globales, `/api`, swagger y manejo de errores.
- `server.ts`: bootstrap (Prisma, Redis, MinIO, listen).
- `routes/`: endpoints agrupados por dominio (`public`, `admin`, `payments`, `superadmin`, etc).
- `controllers/`: capa HTTP.
- `services/`: lógica de negocio histórica (usuarios, negocio, productos, etc).
- `billing/`: módulo dedicado a suscripciones SaaS (planes y cobro recurrente).
- `payments/`: módulo de pagos de órdenes (checkout y webhook de pagos).
- `middlewares/`: auth, tenant, idempotencia, enforcement de suscripción.

---

## 3) Cómo arranca y cómo fluye una request

### 3.1 Arranque

`src/server.ts` hace:
1. Conecta Prisma.
2. Conecta Redis.
3. Asegura buckets MinIO.
4. Levanta Express en `PORT`.

### 3.2 Pipeline HTTP

`src/app.ts` aplica:
1. `helmet`
2. `express.json / urlencoded`
3. `cors`
4. `requestLogger`
5. `app.use("/api", apiRouter)`
6. Swagger en `/docs` y `/docs.json`
7. 404 + error handler global

---

## 4) Multitenancy, autenticación y autorización

### 4.1 Tenant obligatorio por header

Middleware `requireTenant` (`src/middlewares/tenant.middleware.ts`):
- Lee `x-tenant-id`.
- Verifica que el tenant exista.
- Setea `req.tenantId`.
- Si hay usuario autenticado (`req.user`), valida:
  - Que el usuario pertenezca a ese tenant.
  - Que la suscripción del tenant permita acceso (vía `ensureTenantHasActiveSubscription`).

### 4.2 Autenticación por Bearer + sesión en Redis

`requireRole` y `requireSuperAdmin` (`auth.middleware.ts`):
- Lee `Authorization: Bearer <token>`.
- Verifica JWT.
- Verifica que la sesión exista en Redis (`isSessionActive`).
- Valida rol (admin=1, customer=2, superadmin=9).

### 4.3 Login

- Cliente: `POST /api/public/login`.
- Admin de tienda: `POST /api/public/admin/login`.
- Ambos generan token con `createSessionToken` y guardan sesión en Redis (TTL 24h).

---

## 5) Mapa de rutas del backend

`src/routes/index.ts` monta:
- `/api/public`
- `/api/admin`
- `/api/user`
- `/api/cart`
- `/api/payments`
- `/api/superadmin`

Rutas críticas de billing/pagos:
- `GET /api/public/plans` (planes públicos para landing).
- `GET /api/payments/billing/plans` (planes para UI de billing admin).
- `GET /api/payments/billing/subscriptions/current`.
- `POST /api/payments/billing/subscriptions`.
- `PATCH /api/payments/billing/subscriptions/current/plan`.
- `POST /api/payments/billing/sync`.
- `POST /api/payments/webhooks/mercadopago` (webhook global MP).

---

## 6) Modelo de datos (Prisma) relevante

Archivo: `prisma/schema.prisma`

### 6.1 Entidades SaaS

- `Plan`
  - `code` (`FREE`, `STARTER`, `PRO`)
  - `price`, `currency`, `interval`, `trialDays`
  - `mpPreapprovalPlanId`
  - `active`

- `Subscription`
  - `tenantId`
  - `planId`
  - `externalSubscriptionId` (id de MP)
  - `status` (`BillingStatus`)
  - `currentPeriodStart`, `currentPeriodEnd`
  - `cancelAtPeriodEnd`

- `SubscriptionEvent`
  - bitácora de eventos por suscripción

- `Tenant`
  - snapshot de billing para acceso rápido:
  - `plan`
  - `billingStatus`
  - `planStartsAt`, `planEndsAt`
  - `currentSubscriptionId`

### 6.2 Entidades de pagos de órdenes

- `StorePaymentAccount`: OAuth/token MP por tienda.
- `Payment`: pagos concretos de órdenes.
- `PaymentEvent`: eventos webhook deduplicados.
- `IdempotencyKey`: idempotencia por tenant/scope/key.

---

## 7) Diferencia clave: Payments vs Billing

Hay dos integraciones de Mercado Pago:

1. **Payments (marketplace de cada tienda)**
- Usa OAuth por tienda (`MP_CLIENT_ID/SECRET/REDIRECT_URI`).
- Crea checkout para órdenes (`Preference`).
- Webhook de tipo `payment` actualiza `Payment` y `Order.paymentStatus`.

2. **Billing SaaS (suscripción de la tienda a la plataforma)**
- Usa token fijo de plataforma (`MP_BILLING_ACCESS_TOKEN`).
- Crea `PreApproval` (suscripciones recurrentes).
- Webhook de tipo `preapproval` actualiza `Subscription` y snapshot en `Tenant`.

Esta separación es correcta y evita mezclar dinero de clientes finales con el cobro SaaS a comercios.

---

## 8) Planes: creación, edición y ciclo de vida

### 8.1 Seed inicial

`prisma/seed.ts` crea o actualiza:
- `FREE` (0)
- `STARTER` (9999 ARS)
- `PRO` (24999 ARS)

### 8.2 Gestión por superadmin

Endpoints `/api/superadmin/plans` (protegidos con `requireSuperAdmin`):
- `GET /plans`
- `GET /plans/:id`
- `POST /plans`
- `PUT /plans/:id`
- `DELETE /plans/:id` (soft delete -> `active=false`)

Servicio: `src/superadmin/application/plans.service.ts`
- Al crear/editar plan pago, intenta crear/actualizar `preapproval_plan` en MP.
- Al desactivar plan, bloquea si hay suscripciones activas (`ACTIVE`, `TRIALING`, `PAST_DUE`).

---

## 9) Cobro de suscripciones SaaS (flujo completo)

### 9.1 Crear suscripción de un tenant

Endpoint:
- `POST /api/payments/billing/subscriptions`
- Requiere `Authorization` + `x-tenant-id` + rol admin.

Flujo en `BillingService.createSubscriptionForTenant`:
1. Busca tenant y owner email.
2. Busca plan solicitado.
3. Valida:
   - que exista
   - que esté activo
   - que no sea `FREE`
4. Construye `storeSuccessUrl` (idealmente `.../admin/billing`).
5. Llama a provider (`MercadoPagoBillingProvider.createSubscription`).
6. Crea `Subscription` local con estado mapeado de MP.
7. Registra `SubscriptionEvent` tipo `subscription.created`.
8. Devuelve `initPoint` para redirigir al checkout de suscripción.

### 9.2 ¿Cómo se crea en Mercado Pago?

Provider: `src/billing/infrastructure/mercadopago-billing.provider.ts`

- Si hay `mpPreapprovalPlanId`, igual crea `PreApproval` standalone con `auto_recurring`.
- Siempre incluye:
  - `external_reference = tenantId`
  - `payer_email`
  - `back_url`
- Maneja fallback si MP rechaza mezcla de usuarios test/real (intenta sin `payer_email` y luego decide el error final).

### 9.3 Webhook de suscripción

Endpoint global:
- `POST /api/payments/webhooks/mercadopago`

En controller:
- Valida firma (`verifyMercadoPagoWebhookSignature`) si `MP_WEBHOOK_SECRET` está configurado.
- Si el evento contiene `preapproval`, delega a `billingService.handlePreapprovalWebhook`.

Flujo `handlePreapprovalWebhook`:
1. Extrae `externalSubscriptionId` del payload.
2. Consulta snapshot real a MP (`getSubscription`).
3. Resuelve `tenantId` por orden:
   - `external_reference`
   - suscripción ya existente
   - email del payer -> owner/admin
4. Resuelve plan:
   - plan de suscripción actual
   - o por `preapprovalPlanId`
   - o fallback al plan de tenant
5. Hace `upsert` de `Subscription`.
6. Hace `upsert` de `PaymentEvent` para deduplicar webhook.
7. Crea `SubscriptionEvent` (`preapproval.webhook`).
8. Sincroniza snapshot en `Tenant` (`billingStatus`, `plan`, vigencia, `currentSubscriptionId`).

### 9.4 Mapeo de estados MP -> BillingStatus

`billing-status.mapper.ts`:
- `authorized` -> `ACTIVE`
- `pending` -> `TRIALING`
- `paused` -> `PAST_DUE`
- `cancelled` -> `CANCELED`
- `expired` -> `EXPIRED`
- default -> `INACTIVE`

### 9.5 Cambio de plan de una suscripción existente

Endpoint:
- `PATCH /api/payments/billing/subscriptions/current/plan`

Flujo:
1. Valida plan destino (activo y no `FREE`).
2. Toma suscripción actual del tenant.
3. Llama `changeSubscriptionPlanAmount` en MP (update de `auto_recurring.transaction_amount`).
4. Actualiza `Subscription.planId` local por upsert.
5. Registra `SubscriptionEvent` (`subscription.plan_changed`).

### 9.6 Sincronización batch (job)

`BillingService.syncActiveSubscriptionsJob`:
- Consulta en MP suscripciones por estado (`authorized`, `pending`).
- Upsertea en DB.
- Registra evento `subscription.sync`.
- Actualiza snapshot de `Tenant`.

Scripts útiles:
- `npm run billing:sync-plans`
- `npm run billing:sync-subscriptions`

---

## 10) Enforcements de suscripción sobre la API

Middleware: `ensureTenantHasActiveSubscription`.

Regla general:
- Si tenant está `ACTIVE` o `TRIALING`, permite.
- Si `PAST_DUE`, depende de `BILLING_ALLOW_PAST_DUE`.
- Si `CANCELED/EXPIRED`, permite sólo hasta `planEndsAt`.
- Si no, responde `402`.

Bypass de enforcement para rutas críticas:
- `/api/public`
- `/api/payments/mercadopago/callback`
- `/api/payments/webhooks/mercadopago`
- `/api/payments/billing`
- `/api/superadmin`

Esto evita bloquear login, webhook o la propia gestión de billing.

---

## 11) Cobro de órdenes (resumen)

Aunque tu foco es suscripciones, esto convive y comparte webhook:

1. Tienda conecta MP por OAuth (`StorePaymentAccount`).
2. Admin/customer crea checkout (`/api/payments/checkout/:orderId`) con idempotencia.
3. MP manda webhook `payment`.
4. `MercadoPagoProvider.handleWebhook`:
   - deduplica evento (`PaymentEvent`)
   - upsert en `Payment`
   - actualiza `Order.paymentStatus`.

---

## 12) Variables de entorno más importantes para billing y cobros

En `src/config/env.ts`:

Para payments (OAuth tienda):
- `MP_CLIENT_ID`
- `MP_CLIENT_SECRET`
- `MP_REDIRECT_URI`
- `MP_SITE_ID`
- `MP_MARKETPLACE_FEE`

Para billing SaaS:
- `MP_BILLING_ACCESS_TOKEN`
- `MP_BILLING_SUCCESS_URL`
- `MP_BILLING_REASON_PREFIX`
- `BILLING_ALLOW_PAST_DUE`

Webhooks/URLs:
- `MP_WEBHOOK_SECRET`
- `BACKEND_URL`
- `FRONTEND_URL`

Core:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `SECURITY_ENCRYPTION_KEY`

---

## 13) Riesgos operativos y puntos a vigilar

1. Si falta `MP_BILLING_ACCESS_TOKEN`, billing SaaS no funciona (error de config).
2. Si no configuras webhook correctamente, el estado local de suscripción puede quedar desactualizado.
3. Si el `x-tenant-id` del frontend no está listo al hidratar sesión, puede romper flujo auth (tenant-first en frontend ayuda).
4. La validación de firma depende de `MP_WEBHOOK_SECRET`; si está vacío, la firma se omite.
5. Debes distinguir siempre incidencias de `payment` (órdenes) vs `preapproval` (billing).

---

## 14) Checklist de diagnóstico rápido para “no se está cobrando la suscripción”

1. Verificar plan:
- `active=true`
- `price > 0`
- `mpPreapprovalPlanId` correcto (si aplica)

2. Verificar creación de suscripción:
- endpoint devuelve `initPoint`
- existe fila en `Subscription`

3. Verificar webhook:
- llega `preapproval` a `/api/payments/webhooks/mercadopago`
- no falla firma (`x-signature`)
- se crea/actualiza `PaymentEvent` + `SubscriptionEvent`

4. Verificar snapshot final tenant:
- `Tenant.billingStatus`
- `Tenant.plan`
- `Tenant.planEndsAt`
- `Tenant.currentSubscriptionId`

5. Correr sync manual:
- `npm run billing:sync-subscriptions`

---

## 15) Archivos clave (lectura recomendada)

- `back/src/billing/application/billing.service.ts`
- `back/src/billing/infrastructure/mercadopago-billing.provider.ts`
- `back/src/billing/infrastructure/prisma-billing.repository.ts`
- `back/src/payments/infrastructure/mercadopago.provider.ts`
- `back/src/payments/infrastructure/prisma-payments.repository.ts`
- `back/src/controllers/billing.controller.ts`
- `back/src/controllers/payments.controller.ts`
- `back/src/routes/payments.routes.ts`
- `back/src/middlewares/tenant.middleware.ts`
- `back/src/middlewares/subscription.middleware.ts`
- `back/prisma/schema.prisma`

