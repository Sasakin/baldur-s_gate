# Baldur's Gate — Agent guide

## Project overview

Monorepo (pnpm workspaces) with a React + Three.js isometric game, Express API server, and shared library packages.

## Quick commands

- Start dev: `pnpm dev` (runs server.ts via tsx)
- Build all: `pnpm build` (typecheck + vite build)
- Typecheck: `pnpm typecheck`
- Add dep to a package: `pnpm --filter <pkg> add <dep>`

## Workspace packages

| Path | Purpose |
|---|---|
| `artifacts/baldurs-gate/` | Main game app (React + Three.js, Vite) |
| `artifacts/api-server/` | Express API server |
| `artifacts/mockup-sandbox/` | UI mockup sandbox |
| `lib/db/` | Drizzle ORM schema + migrations |
| `lib/api-client-react/` | React hooks for API |
| `lib/api-zod/` | Zod schemas shared client/server |
| `lib/integrations/*/` | Third-party integrations |

## Tech stack

- **Frontend**: React 19, TypeScript strict, Vite, Tailwind CSS v4, Three.js / React Three Fiber
- **Backend**: Express 5, Drizzle ORM, Zod
- **Tooling**: pnpm workspaces, tsx (runner), tsc (typecheck)

## Code conventions

- TypeScript strict mode, no `any`
- React Server Components where possible
- Radix UI primitives + Tailwind for UI
- Drizzle for DB queries
- Functional patterns, avoid classes
- No semicolons in TS/JS files
- Use `zod` for API validation schemas

## Navigation tips

- `artifacts/*/src/` — per-package source
- `src/` (root) — top-level app entry (main.tsx, App.tsx)
- `lib/*/src/` — shared library source
- `scripts/src/` — build/deploy scripts

## Before committing

Run `pnpm typecheck` and fix any errors.
