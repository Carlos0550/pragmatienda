FROM node:22-bookworm-slim

WORKDIR /app

# Instala dependencias de ambos paquetes primero para aprovechar cache de Docker
COPY front/package.json front/package-lock.json ./front/
COPY back/package.json back/package-lock.json ./back/
RUN npm ci --prefix front && npm ci --prefix back

# Copia el resto del monorepo y compila SSR (front + back)
COPY . .
RUN npm run build:ssr --prefix back

# Runtime
WORKDIR /app/back
EXPOSE 3001
CMD ["npm", "run", "start"]
