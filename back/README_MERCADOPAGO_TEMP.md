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
# Marketplace OAuth (cada tienda conecta su cuenta)
MP_CLIENT_ID=
MP_CLIENT_SECRET=
MP_REDIRECT_URI=

# Webhook global MP (si configuras firma, recomendado)
MP_WEBHOOK_SECRET=

# Opcional: comisión marketplace (si aplica)
MP_MARKETPLACE_FEE=

# Sandbox / producción
MP_ENV=sandbox

# Billing SaaS (cuenta plataforma)
MP_BILLING_ACCESS_TOKEN=
MP_BILLING_SUCCESS_URL=
MP_BILLING_REASON_PREFIX=Pragmatienda

# Política de acceso para estados past_due
BILLING_ALLOW_PAST_DUE=false

# URL backend pública (para notification_url)
BACKEND_URL=
```

Notas:
- `MP_CLIENT_ID/SECRET/REDIRECT_URI` -> OAuth marketplace.
- `MP_BILLING_ACCESS_TOKEN` -> token fijo de la cuenta plataforma para billing.
- `MP_WEBHOOK_SECRET` -> valida firma `x-signature` (si está vacío, no valida).

## 3) Qué traer de Mercado Pago (panel)

## 3.1 Marketplace (OAuth por tienda)

Necesitas una aplicación MP para OAuth con:

1. `Client ID`
2. `Client Secret`
3. Redirect URI permitido (debe coincidir exacto con `MP_REDIRECT_URI`)

Redirect URI que usa el backend:
- `GET /api/payments/mercadopago/callback`

Ejemplo completo:
- `https://api.tudominio.com/api/payments/mercadopago/callback`

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
- [ ] `BACKEND_URL` pública y con TLS
- [ ] `MP_REDIRECT_URI` exacta en panel y `.env`
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

