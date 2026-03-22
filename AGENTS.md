# Repository Guidelines

## Project Structure & Module Organization
`pragmatienda` is split into two Node/TypeScript apps. `front/` contains the Vite + React storefront/admin UI; main code lives in `front/src/`, shared UI primitives in `front/src/components/ui/`, and tests in `front/tests/`. `back/` contains the Express API and SSR host; app code lives in `back/src/`, Prisma schema and migrations in `back/prisma/`, and tests in `back/tests/`. Root-level `docker-compose.yml` starts both apps for local development, and `docs/` holds architecture notes for SSR and billing.

## Build, Test, and Development Commands
Run commands from the package you are changing; there is no root `package.json`.

- `cd front && npm run dev`: start the Vite dev server on port 3000.
- `cd front && npm run build`: build the client app.
- `cd front && npm run lint`: run ESLint for frontend code.
- `cd front && npm run test`: run frontend Vitest tests.
- `cd back && npm run dev`: start the backend with `tsx` watch mode.
- `cd back && npm run build`: compile the backend to `back/dist/`.
- `cd back && npm run test`: run backend Vitest tests.
- `docker compose up -d`: run both services in containers.

## Coding Style & Naming Conventions
Use TypeScript throughout and keep existing 2-space indentation. Frontend files use PascalCase for pages, layouts, and components such as `StorefrontLayout.tsx`; backend Zod validators end in `.zod.ts`, and scripts live under `back/src/scripts/`. Prefer `@/` imports in `front/` and relative imports in `back/`. Preserve the backend’s double-quote and semicolon style; in frontend files, follow the local file style if it already differs.

## Testing Guidelines
Both apps use Vitest. Frontend tests run in `jsdom` with Testing Library and should be named `*.test.ts(x)` under `front/tests/`. Backend tests run in a Node environment and use `*.spec.ts` under `back/tests/`. No coverage gate is configured, so add or update focused tests for every behavior change.

## Commit & Pull Request Guidelines
Recent commits use short, imperative subjects such as `Add guest cart functionality and enhance checkout process`. Follow that pattern: one-line summary, sentence case, focused scope. PRs should describe the user-visible change, note any database or env-var impact, link the related issue, and include screenshots for UI changes.

## Architecture Notes
The backend serves both `/api` endpoints and SSR storefront pages. When changing storefront data flow, verify both sides: React routes in `front/src/AppRoutes.tsx` and the SSR/API integration in `back/src/app.ts` and `back/src/ssr/renderer.ts`.
