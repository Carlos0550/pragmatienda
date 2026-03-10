# Resumen completo: cómo funciona Pragmatienda

Este documento resume la arquitectura, el flujo de desarrollo/producción y el uso de Redis y despliegue.

---

## 1. Qué es el proyecto

- **Frontend**: SPA React (Vite + TypeScript) en el puerto **3000**.
- **Backend**: API REST Express (TypeScript) en el puerto **3001**, prefijo `/api`.
- **Comunicación**: El front llama a `/api`; en desarrollo un proxy redirige a `localhost:3001`.

Es una tienda online **multi-tenant**: cada negocio tiene su tienda (dominio/subdominio), panel de admin, carrito, checkout y facturación SaaS (planes y suscripciones con Mercado Pago).

---

## 2. Desarrollo local (tu máquina)

### 2.1 Cómo arrancar todo

```bash
docker compose up
```

Se levantan **tres** contenedores:

| Servicio | Contenedor        | Puerto | Descripción                    |
|----------|-------------------|--------|--------------------------------|
| **redis**  | pragmatienda-redis  | 6379   | Redis local para cache/sesiones |
| **back**   | pragmatienda-back   | 3001   | API (Express + Prisma)         |
| **front**  | pragmatienda-front  | 3000   | App React (Vite)               |

### 2.2 Variables de entorno en local

- El backend usa `back/.env` (**env_file** en docker-compose).
- **REDIS_URL** se **sobrescribe** en el `environment` del servicio `back` a:
  ```bash
  REDIS_URL=redis://redis:6379
  ```
  Así el backend dentro de Docker se conecta al contenedor `redis`, no al Redis de Northflank.

- El resto de variables (DATABASE_URL, MINIO_*, JWT, etc.) salen del `.env`. Para desarrollo local sueles usar:
  - Base de datos local o la misma URL de Northflank si tu IP tiene acceso.
  - MinIO/Railway u otro según tengas configurado.

### 2.3 Por qué Redis local y no el de Northflank

El Redis de Northflank suele ser **solo accesible desde dentro de la red de Northflank**. Desde tu casa o desde Docker en tu PC la conexión puede dar **ECONNRESET**. Por eso en local usamos un Redis en Docker y lo referenciamos con `redis://redis:6379`.

---

## 3. Producción en Northflank

### 3.1 Cómo se despliega

- En Northflank despliegas el **backend** (y si aplica el front, según tu setup).
- El **Dockerfile** en la raíz del repo construye todo (front + back), hace `build:ssr` y arranca el backend con `npm run start` en `/app/back`.

### 3.2 Redis en Northflank

- Creas un **addon de Redis** en el mismo proyecto de Northflank.
- **Vinculas el addon al servicio** (backend). Northflank inyecta automáticamente la variable **REDIS_URL** con la URL **interna** (por ejemplo `redis://...@nombre-del-addon:6379`).
- Esa URL solo es válida **dentro de la red de Northflank**; por eso desde tu casa fallaba y en producción funciona.

No hace falta tocar código: el backend usa siempre `env.REDIS_URL`; en local Docker la sobrescribes con Redis local, y en Northflank la define el addon.

### 3.3 Otras variables en Northflank

Configuras en el servicio (Environment / Secrets):

- **DATABASE_URL**: addon de PostgreSQL o conexión externa.
- **REDIS_URL**: lo da el addon de Redis al vincularlo.
- **MINIO_***, **JWT_SECRET**, **CORS_ORIGIN**, **FRONTEND_URL**, **BACKEND_URL**, **MP_*** (Mercado Pago), **RESEND_API_KEY**, etc., según lo que use tu app.

No necesitas TLS especial para Redis si en Northflank el addon te da `redis://`; si en algún momento te dieran `rediss://`, el código en `back/src/cache/redis.ts` ya detecta `rediss://` y activa TLS con `rejectUnauthorized: false`.

---

## 4. Resumen Redis (local vs Northflank)

| Entorno        | Origen de REDIS_URL        | Comportamiento                          |
|----------------|----------------------------|-----------------------------------------|
| **Local**      | docker-compose (override)   | `redis://redis:6379` → contenedor Redis |
| **Northflank** | Addon Redis (inyección)    | URL interna del addon → Redis en la nube |

- Mismo código en ambos entornos.
- En local evitas ECONNRESET usando Redis en Docker.
- En Northflank usas el addon sin abrir Redis a internet.

---

## 5. Flujo de la aplicación (muy resumido)

1. **Landing**: dominio raíz (ej. pragmatienda.com) → landing; dominio de tienda → se resuelve el tenant y se muestra la tienda.
2. **Cliente**: registro/login vía `/api/public/*`, JWT en cookie; productos, carrito, checkout, perfil.
3. **Admin**: login en `/admin/login`; negocio, categorías, productos, facturación, Mercado Pago.
4. **Superadmin**: rol 9; CRUD de planes en `/api/superadmin/plans`.
5. **Pagos**: Mercado Pago para compras y suscripciones; webhooks en `/api/payments/webhooks/mercadopago`.

Redis se usa para cache e invalidación de tokens/sesiones; no es necesario para que la API arranque, pero si no puede conectar seguirá intentando y registrará errores hasta que la conexión funcione o se deshabilite Redis.

---

## 5.1 URLs de despliegue y landing

En producción o con URLs públicas (ej. Northflank `p02-pragmatienda-v1--8gpyjdpz7wwp.code.run`) el hostname no es `pragmatienda.com`. Para que la app no muestre "Esta tienda no existe":

- Cualquier hostname que **termine en `.code.run`** se trata como **landing** (se muestra la página principal de la plataforma, no se intenta resolver una tienda).
- En el backend puedes añadir más sufijos con la variable de entorno **`EXTRA_LANDING_HOSTNAME_SUFFIXES`** (separados por coma, ej. `code.run,northflank.app`). Así otras plataformas de despliegue se comportan igual.

En esas URLs, "Ir a PragmaTienda" redirige al mismo dominio (la app desplegada), no a pragmatienda.com.

---

## 6. Comandos útiles

| Acción              | Comando |
|---------------------|--------|
| Desarrollo local    | `docker compose up` |
| Solo backend (sin Docker) | `cd back && npm run dev` (necesitas Redis y DB accesibles) |
| Build para producción | Desde raíz: el Dockerfile hace `build:ssr` en back |
| Migraciones         | `cd back && npm run migrate` |
| Seed DB             | `cd back && npm run seed` |
| Documentación API   | Con el back levantado: `http://localhost:3001/docs` |

---

## 7. Documentos relacionados

- **ANALISIS_PROYECTO.md**: estructura detallada, rutas, roles, tecnologías.
- **AGENTS.md**: convenciones y comandos para el repo (front/back, tests, Prisma, etc.).
