# Implementation Plan — Personal Training Program & Tracker

## Dependency Tree (Task IDs)

```text
P1-T1 (Repo/tooling baseline)
├─ P1-T2 (Architecture + data contracts)
├─ P1-T3 (UI shell + navigation scaffold)
└─ P1-T4 (IndexedDB layer + repositories)
   └─ P2-T1 (Program/Level/Move domain services)
      ├─ P2-T2 (CRUD UI flows)
      ├─ P2-T3 (Reorder/duplicate/cascade rules)
      └─ P2-T4 (Export/import v1 contract)
         └─ P3-T1 (Workout session flow: today/start/resume/complete)
            ├─ P3-T2 (Logging engine + progress calculations)
            ├─ P3-T3 (History + progress UI)
            └─ P3-T4 (Core accessibility/performance pass)
               └─ P4-T1 (Supabase sync foundation)
                  └─ P4-T2 (Offline queue + conflict handling)
                     ├─ P4-T3 (Security/privacy/reliability hardening)
                     └─ P4-T4 (Release readiness + acceptance verification)
```

### Parallelization Notes
- After **P1-T1**, tasks **P1-T2** and **P1-T3** can run in parallel.
- During Phase 2, **P2-T2** and **P2-T4** can run in parallel once **P2-T1** is stable.
- During Phase 3, **P3-T3** and **P3-T4** can run in parallel after **P3-T2**.
- In Phase 4, **P4-T3** can start once **P4-T1** is complete while **P4-T2** continues.

---

## Phase 1 — Foundation and Architecture

**Phase goal:** establish a production-ready base architecture and developer workflow.
**Progress snapshot:** P1-T1 ✅, P1-T2 ✅, P1-T3 ✅. **Next:** P1-T4 (IndexedDB persistence foundation).

### Task P1-T1: Repository and quality baseline
- **Goal:** set up project structure, build tooling, linting, formatting, and CI checks.
- **Steps:**
  1. Create project structure for app, shared modules, and docs.
  2. Configure package/tooling scripts for dev, build, test, lint.
  3. Add CI workflow for lint + tests + build on pull requests.
- **Validation criteria:** clean install works; CI passes on default branch; local build/test commands succeed.

### Task P1-T2: Architecture and data contracts
- **Goal:** define module boundaries and canonical type contracts for core entities.
- **Steps:**
  1. Define Program, Level, Move, WorkoutLog, and UserSettings types/interfaces.
  2. Establish storage/service/UI boundaries and dependency rules.
  3. Document architectural decisions and constraints from SRS.
- **Validation criteria:** all core entities have typed contracts; architecture doc reviewed and accepted.

### Task P1-T3: UI shell and navigation scaffold
- **Goal:** build the mobile-first app shell with stable navigation structure.
- **Steps:**
  1. Implement layout shell with top-level routes/tabs (Programs, Today, History, Settings).
  2. Add reusable base components (cards, forms, modal, toast).
  3. Implement dark-mode-first theme tokens and spacing/typography baseline.
- **Validation criteria:** all main screens are reachable; layout works on mobile and desktop breakpoints.

### Task P1-T4: IndexedDB persistence foundation
- **Goal:** implement reliable local persistence and repository interfaces.
- **Steps:**
  1. Implement IndexedDB schema/store versioning as defined in SRS.
  2. Build repository abstractions for CRUD and transactional operations.
  3. Add unit tests for basic read/write/update/delete and migration path.
- **Validation criteria:** database initializes correctly; transaction tests pass; no orphan writes in tests.

**Phase 1 validation criteria:** CI is stable, architecture contracts are documented, and local persistence is working with tests.

---

## Phase 2 — Program Authoring (Core CRUD)

**Phase goal:** deliver complete authoring workflows for programs, levels, and moves.

### Task P2-T1: Domain services for Program/Level/Move
- **Goal:** implement business logic services independent from UI.
- **Steps:**
  1. Create service methods for create/read/update/delete for each entity.
  2. Implement duplicate and cascade delete behaviors.
  3. Enforce ordering and referential integrity rules in service layer.
- **Validation criteria:** service tests cover CRUD + duplicate + cascade + integrity constraints.

### Task P2-T2: CRUD UI flows
- **Goal:** provide end-to-end UI for creating and managing programs, levels, and moves.
- **Steps:**
  1. Build list/detail/edit views for each entity.
  2. Add validated forms and inline feedback for required fields.
  3. Wire UI actions to domain services and show success/error states.
- **Validation criteria:** manual flow test passes for create/edit/delete in all three entity types.

### Task P2-T3: Reordering and structure management
- **Goal:** make structure editing efficient and predictable.
- **Steps:**
  1. Add drag-and-drop and fallback up/down controls.
  2. Recompute contiguous order values after every structure mutation.
  3. Persist and verify ordering in local storage.
- **Validation criteria:** reorder operations always result in unique, contiguous order values.

### Task P2-T4: Export/Import v1
- **Goal:** enable reliable backup, restore, and sharing workflows.
- **Steps:**
  1. Implement full export and single-program export JSON formats.
  2. Implement import modes (merge and replace) with transaction boundaries.
  3. Add schema version checks and referential integrity validation.
- **Validation criteria:** exported files re-import successfully; invalid files fail with clear errors and no partial writes.

**Phase 2 validation criteria:** users can fully create and manage training structures and safely export/import data.

---

## Phase 3 — Workout Execution and Progress

**Phase goal:** deliver daily workout execution, logging, and progress visibility.

### Task P3-T1: Today screen and session lifecycle
- **Goal:** implement start/resume/complete flow for workout sessions.
- **Steps:**
  1. Build Today view showing current program, level, and next moves.
  2. Implement session start/resume logic with draft recovery.
  3. Add complete/cancel outcomes with confirmations.
- **Validation criteria:** interrupted sessions are resumable; completion state persists after refresh.

### Task P3-T2: Workout logging engine
- **Goal:** store accurate per-session and per-move execution data.
- **Steps:**
  1. Implement log record creation with timestamps and metadata.
  2. Support level-complete and move-level granular logging.
  3. Normalize units and preserve entered unit/value per log record.
- **Validation criteria:** logs are queryable by date/program/level and match user-entered values.

### Task P3-T3: History and progress analytics
- **Goal:** provide clear feedback on training consistency and advancement.
- **Steps:**
  1. Build History list with filters (program + date range).
  2. Implement progress indicators (completion %, last workout summary, activity counts).
  3. Add simple chart/visual summaries for weekly activity.
- **Validation criteria:** progress metrics match underlying logs and pass spot-check scenarios.

### Task P3-T4: Accessibility and performance pass (core flows)
- **Goal:** ensure core workout flows are fast and accessible.
- **Steps:**
  1. Add keyboard navigation and focus states on critical screens.
  2. Verify contrast and semantic labels for forms/controls.
  3. Profile key flows and optimize expensive render/query paths.
- **Validation criteria:** WCAG 2.1 AA checks pass for key screens; performance budgets in SRS are met.

**Phase 3 validation criteria:** users can execute workouts daily, review history, and trust progress data.

---

## Phase 4 — Sync, Hardening, and Release

**Phase goal:** add optional Supabase sync and complete production hardening.

### Task P4-T1: Supabase sync foundation
- **Goal:** establish optional remote sync with owner-scoped records.
- **Steps:**
  1. Add sync configuration flow (URL/key validation).
  2. Implement Supabase schema mapping with `owner_id` and soft-delete fields.
  3. Build initial upload/download sync pathways.
- **Validation criteria:** configured environment completes initial sync without data loss.

### Task P4-T2: Offline queue and conflict handling
- **Goal:** make sync robust under unstable connectivity.
- **Steps:**
  1. Implement mutation queue for offline operations.
  2. Add replay engine with retry/backoff policy.
  3. Apply deterministic conflict rules (`updatedAt` latest wins; equal timestamp logs conflict).
- **Validation criteria:** offline edits replay on reconnect; conflict cases are deterministic and traceable.

### Task P4-T3: Security, privacy, and reliability hardening
- **Goal:** verify privacy-first guarantees and operational safety.
- **Steps:**
  1. Validate no unintended outbound network calls.
  2. Add destructive-action safeguards (confirmations + backup prompts).
  3. Add reliability tests for import/replace/sync-failure recovery paths.
- **Validation criteria:** security/privacy checklist passes; recovery scenarios succeed without corruption.

### Task P4-T4: Release readiness and acceptance
- **Goal:** prepare v1 for real users with reproducible quality gates.
- **Steps:**
  1. Execute full acceptance run against SRS release criteria.
  2. Finalize deployment docs, environment setup, and rollback guidance.
  3. Run regression suite and tag release candidate.
- **Validation criteria:** all phase validations and SRS acceptance criteria pass; release checklist is complete.

**Phase 4 validation criteria:** optional sync is reliable, privacy guarantees hold, and release candidate is production-ready.
