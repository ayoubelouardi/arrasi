# Copilot Instructions for `arrasi`

## Build, test, and lint commands

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Type-check: `npm run typecheck`
- Lint: `npm run lint`
- Run all tests: `npm test`
- Run a single test file: `npm test -- src/services/program-authoring-service.test.ts`
- Run a specific test case: `npm test -- src/services/program-authoring-service.test.ts -t "enforces referential integrity and contiguous ordering"`
- Build production bundle: `npm run build`
- Check formatting: `npm run format:check`

## High-level architecture

- Frontend is a **Vite + Preact + TypeScript** app with Tailwind v4 styles.
- App shell and navigation are in `src/app.tsx`; page views live under `src/app/pages/*`.
- Domain logic is intentionally UI-independent in `src/services/*` (currently `ProgramAuthoringService`).
- Persistence is local-first via Dexie/IndexedDB in `src/storage/*`:
  - `src/storage/db.ts` defines schema versions and migrations (`TrainingTracker`, currently version 2).
  - `src/storage/repositories/*` contains repository abstractions and transaction helpers.
- Shared contracts are centralized in `src/shared/types/index.ts` and should be reused across UI/services/storage.

Dependency direction expected in this repo:

`app -> services -> storage`, and all layers may depend on `shared`.

## Key repository conventions

- Use path aliases from config: `@app/*`, `@shared/*`, `@storage/*`, `@services/*` (note `@services/*`, not bare `@services`).
- Preact templates use `class` (not React `className`) in `.tsx` files.
- Core domain entities use string IDs and ISO timestamp strings; services generate IDs with `crypto.randomUUID()` and normalize ordering to contiguous 1-based values.
- Referential integrity and cascade behavior are enforced in service/storage operations; do not bypass services for domain mutations in UI flows.
- IndexedDB tests depend on `fake-indexeddb` (`src/test/setup.ts`) and use unique DB names plus explicit cleanup (`db.close()` + `db.delete()`).
