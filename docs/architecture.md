# Architecture Baseline (P1-T2)

This document defines module boundaries and canonical data contracts for Phase 1 Task 2.
It follows the SRS requirements in `docs/srs.md` and is intentionally minimal for the current phase.

## Layer boundaries

```text
UI (src/app)
  -> Services (src/services)
     -> Storage repositories (src/storage)
        -> IndexedDB implementation

Shared contracts/utilities (src/shared) are dependency-safe for all layers.
```

### Responsibilities

- `src/app`
  - Rendering, routing, interaction state, and user feedback.
  - Must not access IndexedDB directly.
- `src/services`
  - Business rules for Program/Level/Move/Workout behavior.
  - Coordinates validation, ordering, duplicate/cascade actions, and transactions.
- `src/storage`
  - Persistence adapters and repository implementations.
  - Owns Dexie schema access and low-level CRUD.
- `src/shared`
  - Canonical types (`src/shared/types`) and framework-agnostic helpers.

## Dependency direction rules

- Allowed:
  - `app -> services -> storage`
  - `app|services|storage -> shared`
- Not allowed:
  - `storage -> services|app`
  - `services -> app`
  - `shared -> app|services|storage`

## Canonical contracts

Core entities are defined in `src/shared/types/index.ts`:

- `Program`
- `Level`
- `Move`
- `WorkoutLog`
- `UserSettings`

Additional shared aliases and contracts:

- `EntityId`, `ISODateString`
- `ProgramDifficulty`, `MoveType`
- `TrainingDataExport`, `ExportMode`, `ImportMode`

## Constraints carried from the SRS

- IDs are client-generated and represented as strings (UUID-compatible).
- Timestamps are ISO 8601 UTC strings.
- `order` values for levels/moves must remain contiguous and unique in their parent scope.
- Local-first architecture: storage works without network dependencies.
- Sync configuration is optional and represented in `UserSettings`.
- Privacy-first: no outbound network dependency is required for core local workflows.
