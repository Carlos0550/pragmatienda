# Backend Cinnamon

Backend base para una tienda online con Express + TypeScript, Prisma 7, Postgres,
Redis, MinIO, Winston y mailer (Resend/Ethereal).

## Requisitos
- Node.js 18+
- Docker y docker-compose

## Arranque rapido
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Crear variables de entorno:
   ```bash
   cp .env.example .env
   ```
3. Levantar servicios locales:
   ```bash
   docker-compose up -d
   ```
4. Generar cliente Prisma:
   ```bash
   npm run generate
   ```
5. Ejecutar migraciones:
   ```bash
   npm run migrate
   ```
6. Iniciar backend:
   ```bash
   npm run dev
   ```

Health check: `http://localhost:3001/health`
Swagger UI: `http://localhost:3001/docs`
OpenAPI JSON: `http://localhost:3001/docs.json`

## Estructura
- `src/config`: env + logger
- `src/db`: Prisma
- `src/cache`: Redis
- `src/storage`: MinIO
- `src/mail`: Resend/Ethereal

## Notas
- `MAIL_PROVIDER=ethereal` genera credenciales locales y muestra un preview en logs.
- MinIO crea automaticamente los buckets `images` (publico) y `payments` (privado) al iniciar.
- La documentacion OpenAPI se genera desde schemas Zod en `src/docs/swagger.ts`.
- El ejemplo esta en `src/routes/health.ts` y se importa desde `src/routes/index.ts`.
- El modelo `User` en Prisma es un ejemplo inicial y puedes ajustarlo.
