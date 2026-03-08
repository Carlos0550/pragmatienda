# AGENTS.md

Repository guidance for coding agents working in `pragmatienda`.

## Workspace Overview

- This repo is split into `front/` and `back/`.
- `front/` is a Vite + React + TypeScript app with Vitest and ESLint.
- `back/` is an Express + TypeScript + Prisma backend with Vitest.
- There is no root `package.json`; run commands from `front/` or `back/`.
- Root `docker-compose.yml` starts both frontend and backend containers for local development.

## Agent Priorities

- Prefer minimal, targeted edits that match nearby code.
- Preserve package-local conventions instead of forcing one repo-wide style.
- Do not invent new tooling or scripts unless the task clearly needs them.
- Avoid broad refactors while implementing small features or fixes.
- Check both frontend and backend contracts when changing shared API behavior.

## Rule Files

- No `.cursor/rules/` directory was found.
- No `.cursorrules` file was found.
- No `.github/copilot-instructions.md` file was found.
- If any of these files are added later, treat them as higher-priority guidance than this file.

## Install And Local Dev

- Backend install: `cd back && npm install`
- Frontend install: `cd front && npm install`
- Full local stack with Docker: `docker compose up -d`
- Backend dev server: `cd back && npm run dev`
- Backend Docker-friendly dev server: `cd back && npm run dev:docker`
- Frontend dev server: `cd front && npm run dev`
- Backend SSR watch pairing: `cd back && npm run dev:ssr:front`

## Build Commands

- Backend build: `cd back && npm run build`
- Backend SSR build: `cd back && npm run build:ssr`
- Frontend build: `cd front && npm run build`
- Frontend SSR build: `cd front && npm run build:ssr`
- Frontend client-only SSR bundle: `cd front && npm run build:client`
- Frontend server-only SSR bundle: `cd front && npm run build:server`
- Frontend development bundle: `cd front && npm run build:dev`

## Lint Commands

- Frontend lint: `cd front && npm run lint`
- Backend has no lint script at the moment.
- For backend changes, use `npm run build` and relevant tests as the main safety checks.

## Test Commands

- Backend full test suite: `cd back && npm run test`
- Frontend full test suite: `cd front && npm run test`
- Frontend watch mode: `cd front && npm run test:watch`

## Single Test Commands

- Backend single spec file: `cd back && npm run test -- tests/billing/create-subscription.spec.ts`
- Backend single test by name: `cd back && npm run test -- tests/billing/create-subscription.spec.ts -t "creates a subscription using tenant owner email and selected plan"`
- Frontend single spec file: `cd front && npm run test -- tests/pages/storefront/Home.test.tsx`
- Frontend single test by name: `cd front && npm run test -- tests/pages/storefront/Home.test.tsx -t "muestra productos destacados con imágenes"`
- Alternative direct Vitest form also works in both packages: `npx vitest run <path-to-test> -t "test name"`

## Prisma And Backend Ops

- Prisma CLI passthrough: `cd back && npm run prisma -- <args>`
- Generate Prisma client: `cd back && npm run generate`
- Create/apply dev migration: `cd back && npm run migrate`
- Seed database: `cd back && npm run seed`
- Prisma Studio: `cd back && npm run studio`
- Billing sync script: `cd back && npm run billing:sync-plans`
- Subscription sync script: `cd back && npm run billing:sync-subscriptions`
- Superadmin token script: `cd back && npm run superadmin:token`

## Validation Expectations

- For frontend-only edits, usually run `cd front && npm run lint` and targeted tests.
- For backend-only edits, usually run `cd back && npm run build` and targeted tests.
- For API contract changes, run both backend and frontend checks when possible.
- Prefer single-test runs first, then full suites if the change is broad.

## Architecture Notes

- Backend code lives mostly under `back/src/`.
- Frontend app code lives under `front/src/`; tests live under `front/tests/`.
- Backend tests live under `back/tests/`.
- Backend uses Prisma repositories, service classes, controllers, routes, and Zod schemas.
- Frontend uses route pages, layouts, `services/http.ts`, shared `types`, and UI primitives under `components/ui`.

## Backend Style Guide

- Use TypeScript with strict mode in the backend; preserve explicit types where they add clarity.
- Prefer double quotes and semicolons in backend files.
- Use relative imports in backend files; there is no alias configured there.
- Match existing folder casing exactly, even when it is inconsistent (`services/Products`, `services/Users`, etc.).
- Keep controllers thin: parse request data, validate with Zod, call a service, return HTTP response.
- Put request/query/body validation in `*.zod.ts` modules, not inline in controllers unless already local and tiny.
- Return service objects shaped like `{ status, message, data?, err? }` when working in existing service layers.
- Use `safeParse` for request validation and return `400` with flattened field errors on invalid input.
- Guard required tenant/user/param values early and return fast on invalid state.
- Catch unexpected errors near request boundaries and log through `logger`.
- Prefer domain-specific error classes when they already exist, such as billing/payment errors.
- Avoid throwing raw strings; throw `Error` subclasses or return structured results.
- Normalize and sanitize user-facing data before persistence when helper utilities already exist.
- Keep Prisma queries localized to services/repositories rather than controllers.
- Reuse existing helpers for MinIO, Redis, auth, billing, and payment provider logic.
- When updating files with mixed style issues, follow the local style of the edited file instead of reformatting unrelated lines.

## Frontend Style Guide

- Frontend TypeScript is intentionally looser than backend TypeScript; do not "strictify" unrelated code.
- Prefer the `@/` import alias for frontend app code.
- Use `import type` for type-only imports when convenient; this pattern already appears widely.
- Follow the quote style of the file you are editing; the frontend currently contains both single-quote and double-quote files.
- Keep semicolon usage consistent with the surrounding file.
- Prefer functional React components and hooks.
- Keep API access inside `src/services/api.ts` and `src/services/http.ts` patterns rather than scattering raw `fetch` calls.
- Use shared types from `src/types/index.ts` before creating duplicate inline interfaces.
- Reuse utility helpers from `src/lib/` and query helpers from `src/hooks/` where available.
- Reuse existing UI primitives from `src/components/ui/` before creating new base components.
- Preserve established route/layout structure in `AppRoutes.tsx` and the `layouts/` directory.
- Keep forms controlled, surface backend field errors into UI state, and show user-friendly notifications.
- Prefer small state variables with clear names over deeply nested local state objects.
- Do not refactor generated-style UI primitives unless the task requires it.

## Naming Conventions

- React pages/layouts/components use PascalCase filenames.
- Backend service/controller instances are usually camelCase exports from PascalCase classes.
- Zod schema files end in `.zod.ts`.
- Test files use `.spec.ts` in backend and `.test.tsx` or `.test.ts` in frontend.
- Utility functions use descriptive camelCase names.
- Keep API path segments, DTO names, and domain terms aligned with existing business language.

## Imports And File Organization

- Keep imports grouped logically: external packages first, then internal modules, then type-only imports when practical.
- In frontend files, alias imports are preferred over long relative traversals.
- In backend files, stay with relative imports unless the package is reconfigured.
- Avoid unused imports; frontend ESLint disables some unused-var checks, but dead imports still add noise.
- Favor colocating small helpers near the feature unless there is clear reuse across modules.

## Error Handling And Logging

- Backend controllers and services commonly use `try/catch`; preserve that pattern.
- Log operational failures with context but do not leak secrets, tokens, or raw credentials.
- Return stable, user-safe messages in HTTP responses.
- Surface validation errors as field maps when the surrounding endpoint already does so.
- In frontend code, convert API failures into typed `ApiError` handling and UI messages.
- Treat `401`, `402`, and `403` consistently with the existing `ApiService` interceptor behavior.

## Testing Conventions

- Backend tests use Vitest in Node environment with `back/tests/setup-env.ts`.
- Frontend tests use Vitest with `jsdom`, Testing Library, and `front/tests/setup.ts`.
- Frontend tests commonly mock `@/services/http` and app contexts.
- Prefer focused unit/integration tests near the changed behavior rather than large snapshot tests.
- When adding a test, mirror the existing test file placement and naming in that package.

## Things To Avoid

- Do not add a new formatter configuration unless explicitly requested.
- Do not convert backend imports to aliases without updating TypeScript config and existing code.
- Do not mix broad stylistic cleanup with behavior changes.
- Do not bypass Zod validation on new backend inputs.
- Do not duplicate API clients, toast helpers, or shared types.

## Good Default Workflow

- Read the nearest similar file first.
- Make the smallest coherent change.
- Run the narrowest relevant test command.
- Run lint/build if the package supports it.
- Mention any missing automation explicitly in your handoff.
