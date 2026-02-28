FROM node:22-bookworm-slim

WORKDIR /app

# Prisma necesita OpenSSL en runtime/build para generar cliente correctamente
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Prisma generate no requiere conectarse, pero Prisma Config sí exige que exista DATABASE_URL.
# Este valor dummy solo aplica al build y será sobreescrito por variables reales en Railway runtime.
ARG DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pragmatienda
ENV DATABASE_URL=${DATABASE_URL}

# Instala dependencias de ambos paquetes primero para aprovechar cache de Docker.
# Copiamos prisma schema antes de npm ci de back para evitar fallo en postinstall.
COPY front/package.json front/package-lock.json ./front/
COPY back/package.json back/package-lock.json ./back/
COPY back/prisma ./back/prisma
RUN npm ci --prefix front && npm ci --prefix back --ignore-scripts

# Copia el resto del monorepo y compila SSR (front + back)
COPY . .
RUN npm run postinstall --prefix back
RUN npm run build:ssr --prefix back

# Runtime
WORKDIR /app/back
EXPOSE 3001
CMD ["npm", "run", "start"]
