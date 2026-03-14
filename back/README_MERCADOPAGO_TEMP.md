# README TEMP - Mercado Pago Setup (Pragmatienda)

Este documento es temporal y está pensado como checklist de implementación.

## 1) Qué módulos usan Mercado Pago

- `Marketplace payments` (cuenta de cada tienda via OAuth):
  - checkout de órdenes de la tienda
  - webhook de pagos (`topic/type = payment`)
- `Billing SaaS` (cuenta de plataforma):
  - suscripciones mensuales de tenants (`preapproval`)
  - webhook de suscripciones (`topic/type = preapproval`)

## 2) Variables de entorno que debes completar

En tu `.env` del backend:

```env
# Storefront / dominio público
STOREFRONT_PROTOCOL=https
STOREFRONT_ROOT_DOMAIN=pragmatienda.com
STOREFRONT_PORT=

# Marketplace OAuth (cada tienda conecta su cuenta)
MP_CLIENT_ID=
MP_CLIENT_SECRET=

# Webhook global MP (si configuras firma, recomendado)
MP_WEBHOOK_SECRET=

# Opcional: comisión marketplace (si aplica)
MP_MARKETPLACE_FEE=

# Sandbox / producción
MP_ENV=sandbox

# Billing SaaS (cuenta plataforma)
MP_BILLING_ACCESS_TOKEN=
MP_BILLING_REASON_PREFIX=Pragmatienda
MP_BILLING_SEND_PAYER_EMAIL=

# Política de acceso para estados past_due
BILLING_ALLOW_PAST_DUE=false
```

Notas:
- `STOREFRONT_*` -> define la URL pública de plataforma y tiendas. Desde ahí el backend deriva:
  - callback OAuth: `${platformUrl}/api/payments/mercadopago/callback`
  - webhook: `${platformUrl}/api/payments/webhooks/mercadopago`
  - success URL de billing por tenant: `${storeUrl}/admin/billing`
- `MP_CLIENT_ID/SECRET` -> OAuth marketplace.
- `MP_BILLING_ACCESS_TOKEN` -> token fijo de la cuenta plataforma para billing.
- `MP_BILLING_SEND_PAYER_EMAIL` -> opcional. Si no se define, en `MP_ENV=sandbox` se envía `false` y en `MP_ENV=production` se envía `true`.
- `MP_BILLING_SEND_PAYER_EMAIL=false` -> útil en sandbox para no forzar que el pagador use el mismo email del owner del tenant.
- `MP_WEBHOOK_SECRET` -> valida firma `x-signature` (si está vacío, no valida).

## 3) Qué traer de Mercado Pago (panel)

## 3.1 Marketplace (OAuth por tienda)

Necesitas una aplicación MP para OAuth con:

1. `Client ID`
2. `Client Secret`
3. Redirect URI permitido (debe coincidir exacto con la URL derivada desde `STOREFRONT_*`)

Redirect URI que usa el backend:
- `GET /api/payments/mercadopago/callback`

Ejemplo completo:
- `https://pragmatienda.com/api/payments/mercadopago/callback`

## 3.2 Billing SaaS (cuenta plataforma)

Necesitas del usuario plataforma:

1. `Access Token` de la app/cuenta que cobrará suscripciones SaaS
2. Confirmar que puede usar `preapproval` y `preapproval_plan`

Ese token va en:
- `MP_BILLING_ACCESS_TOKEN`

## 3.3 Webhooks

Configurar en MP un webhook hacia:
- `POST /api/payments/webhooks/mercadopago`

Ejemplo completo:
- `https://api.tudominio.com/api/payments/webhooks/mercadopago`

Debe recibir eventos al menos de:
- `payment`
- `preapproval`

Si MP te entrega secreto de firma:
- guardarlo en `MP_WEBHOOK_SECRET`

## 4) Endpoints del sistema involucrados

## Marketplace OAuth

- `GET /api/payments/mercadopago/connect/:storeId`
- `GET /api/payments/mercadopago/callback`
- `POST /api/payments/checkout/:orderId`

Requisitos:
- `x-tenant-id`
- `Authorization: Bearer ...`
- `Idempotency-Key` para checkout

## Billing

- `POST /api/payments/billing/subscriptions`
- `PATCH /api/payments/billing/subscriptions/current/plan`
- `POST /api/payments/billing/sync`

Requisitos para crear suscripción:
- `x-tenant-id`
- `Authorization: Bearer ...`
- `Idempotency-Key`

## Webhook global

- `POST /api/payments/webhooks/mercadopago`

## 5) Flujo esperado en sandbox (validación rápida)

1. Configurar `.env` completo.
2. Levantar backend con URL pública (ngrok/tunnel o dominio).
3. Conectar una tienda via OAuth:
   - abrir `GET /api/payments/mercadopago/connect/:storeId` autenticado como admin.
4. Crear checkout de orden:
   - `POST /api/payments/checkout/:orderId` con `Idempotency-Key`.
5. Simular/ejecutar pago en sandbox.
6. Verificar webhook:
   - tabla `payments` actualizada
   - `order.paymentStatus` actualizado
7. Billing:
   - `npm run billing:sync-plans` (una vez / idempotente)
   - crear suscripción SaaS
   - confirmar recepción de `preapproval` webhook
   - verificar `tenant.billingStatus`, `tenant.plan`, `tenant.planEndsAt`, `tenant.currentSubscriptionId`

## 6) Checklist final de producción

- [ ] `MP_ENV=production`
- [ ] `STOREFRONT_*` apunta al dominio público real y con TLS
- [ ] redirect URI exacta configurada en el panel de Mercado Pago
- [ ] webhook configurado en MP al endpoint global
- [ ] `MP_WEBHOOK_SECRET` cargado
- [ ] `MP_BILLING_ACCESS_TOKEN` de producción cargado
- [ ] pruebas E2E marketplace y billing en entorno real
- [ ] monitoreo de webhook (errores, retries, latencia)

## 7) Dónde se guardan los datos en tu sistema

- Credenciales OAuth por tienda:
  - tabla `store_payment_accounts`
- Pagos marketplace:
  - tabla `payments`
- Planes SaaS:
  - tabla `Plan`
- Suscripciones SaaS:
  - tabla `Subscription`
- Eventos de suscripción:
  - tabla `SubscriptionEvent`
- Idempotencia / eventos webhook:
  - `IdempotencyKey`, `PaymentEvent`
