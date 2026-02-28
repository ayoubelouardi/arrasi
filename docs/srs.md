# Software Requirements Specification (SRS)  
## Personal Training Program & Tracker  

**Version:** 1.0  
**Date:** 2026-02-28  
**Author:** [Your Name]  
**Project:** Open‑Source Self‑Hosted Workout Planner  

---

## Table of Contents  

1. [Introduction](#1-introduction)  
   1.1 Purpose  
   1.2 Scope  
   1.3 Definitions and Acronyms  
2. [Overall Description](#2-overall-description)  
   2.1 Product Perspective  
   2.2 User Characteristics  
   2.3 Operating Environment  
   2.4 Design and Implementation Constraints  
   2.5 Assumptions and Dependencies  
3. [System Features and Requirements](#3-system-features-and-requirements)  
   3.1 Functional Requirements  
      3.1.1 Data Models  
      3.1.2 Program Management  
      3.1.3 Level Management  
      3.1.4 Move Management  
      3.1.5 Workout Logging and Progress Tracking  
      3.1.6 Export and Import  
      3.1.7 Synchronization with Supabase (Optional)  
      3.1.8 User Interface  
   3.2 Non‑Functional Requirements  
      3.2.1 Performance  
      3.2.2 Privacy and Security  
      3.2.3 Usability  
      3.2.4 Maintainability and Extensibility  
      3.2.5 Compatibility  
4. [External Interface Requirements](#4-external-interface-requirements)  
   4.1 User Interfaces  
   4.2 Hardware Interfaces  
   4.3 Software Interfaces  
   4.4 Communication Interfaces  
5. [Data Specifications](#5-data-specifications)  
   5.1 IndexedDB Schema  
   5.2 Supabase Schema (for Sync Users)  
   5.3 Export/Import JSON Format  
6. [Appendices](#6-appendices)  
   6.1 Glossary  
   6.2 Future Considerations  

---

## 1. Introduction  

### 1.1 Purpose  
This document specifies the requirements for a **personal training program and tracker** web application. The application allows users to create, manage, and follow structured workout programs composed of levels (phases) and moves (exercises). It is designed to be privacy‑focused, self‑hosted, and capable of running entirely in the browser using IndexedDB, with an optional synchronization layer using Supabase for users who wish to back up or sync their data across devices.

### 1.2 Scope  
The application will provide:  
- Full CRUD (Create, Read, Update, Delete) capabilities for Programs, Levels, and Moves.  
- Workout logging and progress tracking (last workout, completion status, activity history).  
- Export and import of data in a human‑readable JSON format, supporting both full backups and program‑sharing.  
- Two operational modes:  
  - **Local‑only mode:** All data is stored in the browser’s IndexedDB.  
  - **Sync mode:** Data is synchronised with a user‑provided Supabase PostgreSQL instance (optional, requires configuration).  
- A clean, mobile‑first user interface with dark mode as the default theme.  

The application is intended to be open‑sourced, allowing developers to self‑host, customise, and contribute.

### 1.3 Definitions and Acronyms  

| Term         | Description |
|--------------|-------------|
| **Program**  | A top‑level container representing a training regimen (e.g., “Strength Builder”, “Marathon Prep”). |
| **Level**    | A phase or block within a program (e.g., “Week 1–4”, “Hypertrophy Phase”). A program contains one or more levels. |
| **Move**     | An individual exercise or activity (e.g., “Squat”, “Pull‑ups”). A level contains one or more moves. |
| **Workout Log** | A record of a completed workout session, detailing actual performance for each move performed. |
| **CRUD**     | Create, Read, Update, Delete |
| **IndexedDB**| A low‑level API for client‑side storage of significant amounts of structured data. |
| **Supabase** | An open‑source Firebase alternative providing a PostgreSQL database, authentication, and real‑time capabilities. |

---

## 2. Overall Description  

### 2.1 Product Perspective  
The application is a standalone, client‑side web app. It does not require any server‑side component except for the optional Supabase integration, which is configured by the user. The core functionality (data entry, tracking, export/import) is available even without an internet connection when using local‑only mode.  

The system interacts with two storage backends:  
- **IndexedDB** for local persistence.  
- **Supabase PostgreSQL** for cloud sync (if enabled).  

### 2.2 User Characteristics  
- **Primary users:** Fitness enthusiasts, athletes, coaches who want to design and follow personalised workout programs.  
- **Secondary users:** Developers who may fork or contribute to the project.  
- Users are expected to have basic computer literacy but no technical knowledge of databases or synchronisation is required. The sync feature will be clearly documented for those who choose to use it.

### 2.3 Operating Environment  
- **Platform:** Modern web browsers (Chrome, Firefox, Safari, Edge) on desktop and mobile devices.  
- **Dependencies:** No server‑side runtime. The app is delivered as static HTML, CSS, and JavaScript files.  
- **Storage:** IndexedDB (all major browsers support it). For sync mode, an active internet connection and a user‑owned Supabase instance are required.

### 2.4 Design and Implementation Constraints  
- **Privacy‑first:** No data leaves the user’s device unless sync is explicitly enabled and configured. No third‑party analytics or tracking libraries.  
- **Self‑contained:** The app should be deployable by copying a single folder of static files.  
- **Offline‑capable:** Local mode must work without internet. Sync mode should cache data locally for offline reads and queue writes.  
- **Data portability:** All data must be exportable/importable in a simple JSON format to avoid vendor lock‑in.  
- **Open source:** The entire codebase will be released under an open‑source license (e.g., MIT).  

### 2.5 Assumptions and Dependencies  
- Users who enable sync will provide their own Supabase URL and anonymous key (or use a public demo instance).  
- The app does not include authentication; if sync is used, the Supabase instance must handle access control (e.g., Row Level Security). For simplicity, the first version may assume a single user per Supabase project.  
- The browser’s storage limits (typically >50MB) are sufficient for the expected data volume (thousands of logs).  

---

## 3. System Features and Requirements  

### 3.1 Functional Requirements  

#### 3.1.1 Data Models  
Each entity must include a comprehensive set of attributes, allowing users to capture all necessary details without needing future extensions.  

**Program**  
| Field           | Type      | Description |
|-----------------|-----------|-------------|
| `id`            | string    | Unique identifier (UUID or auto‑increment) |
| `name`          | string    | Program title (required) |
| `description`   | string    | Detailed description |
| `goal`          | string    | e.g., “Build strength”, “Lose weight” |
| `duration`      | string    | e.g., “8 weeks”, “12 weeks” |
| `difficulty`    | enum      | Beginner / Intermediate / Advanced |
| `tags`          | string[]  | User‑defined labels |
| `createdAt`     | datetime  | ISO 8601 |
| `updatedAt`     | datetime  | ISO 8601 |
| `color`         | string    | Optional UI theme colour (hex) |
| `customFields`  | object    | JSON object for any user‑defined extra fields |

**Level**  
| Field           | Type      | Description |
|-----------------|-----------|-------------|
| `id`            | string    | Unique identifier |
| `programId`     | string    | Reference to parent program |
| `name`          | string    | Level title (required) |
| `description`   | string    | Phase description |
| `order`         | integer   | Position within program (1‑based) |
| `duration`      | string    | e.g., “2 weeks”, “5 sessions” |
| `restDays`      | integer   | Number of rest days in this phase |
| `notes`         | string    | Any additional notes |
| `createdAt`     | datetime  | ISO 8601 |
| `updatedAt`     | datetime  | ISO 8601 |
| `customFields`  | object    | JSON object for extra fields |

**Move**  
| Field           | Type      | Description |
|-----------------|-----------|-------------|
| `id`            | string    | Unique identifier |
| `levelId`       | string    | Reference to parent level |
| `name`          | string    | Exercise name (required) |
| `description`   | string    | Instructions or description |
| `type`          | enum      | Strength / Cardio / Mobility / Stretching / etc. |
| `targetSets`    | integer   | Planned number of sets |
| `targetReps`    | string    | e.g., “8‑12”, “AMRAP”, “60s” |
| `targetWeight`  | string    | e.g., “50kg”, “bodyweight” |
| `targetTime`    | string    | e.g., “30s hold”, “5min” |
| `restBetweenSets` | string  | e.g., “90s”, “2min” |
| `videoUrl`      | string    | Link to demonstration video |
| `imageUrl`      | string    | Link to reference image |
| `equipment`     | string[]  | List of required equipment |
| `notes`         | string    | Additional notes |
| `order`         | integer   | Position within level |
| `createdAt`     | datetime  | ISO 8601 |
| `updatedAt`     | datetime  | ISO 8601 |
| `customFields`  | object    | JSON object for extra fields |

**WorkoutLog**  
| Field           | Type      | Description |
|-----------------|-----------|-------------|
| `id`            | string    | Unique identifier |
| `programId`     | string    | Reference to program (for aggregation) |
| `levelId`       | string    | Reference to level |
| `moveId`        | string    | Reference to move (optional, if logging per move) |
| `date`          | datetime  | Date and time of workout (ISO 8601) |
| `actualSets`    | integer   | Sets performed |
| `actualReps`    | string    | e.g., “10,10,8” or “5min” |
| `actualWeight`  | string    | e.g., “50kg,50kg,45kg” |
| `perceivedEffort`| integer  | RPE (1‑10) or similar |
| `notes`         | string    | Session notes |
| `completed`     | boolean   | Whether the move/level was fully completed |

*Note: Logs can be associated with an entire level (e.g., completed all moves) or per move. The schema should support both granularities.*

**UserSettings**  
| Field           | Type      | Description |
|-----------------|-----------|-------------|
| `id`            | string    | “settings” singleton |
| `syncEnabled`   | boolean   | Whether sync mode is active |
| `supabaseUrl`   | string    | (if sync) Supabase project URL |
| `supabaseAnonKey`| string   | (if sync) Public anon key |
| `lastSync`      | datetime  | Timestamp of last successful sync |
| `darkMode`      | boolean   | Always true (default) |
| `...`           | ...       | Other UI preferences |

#### 3.1.2 Program Management  
- Create a new program with the fields listed above.  
- View a list of all programs (summary cards).  
- View a detailed program page showing its levels.  
- Edit program details.  
- Delete a program (cascade delete its levels and moves, with confirmation).  
- Duplicate a program (copy all levels and moves, assign new IDs).  
- Reorder levels within a program via drag‑and‑drop or up/down buttons.  

#### 3.1.3 Level Management  
- Add a new level to a program.  
- Edit level details.  
- Delete a level (cascade delete its moves).  
- Duplicate a level (copy all moves, assign new IDs, keep parent program).  
- Reorder moves within a level.  

#### 3.1.4 Move Management  
- Add a new move to a level.  
- Edit move details.  
- Delete a move.  
- Duplicate a move.  

#### 3.1.5 Workout Logging and Progress Tracking  
- **Today’s Workout:** Display the current level and next moves scheduled (based on order and last log).  
- **Log a Session:** User can start a workout and log actual performance for each move. They can also mark the entire level as completed.  
- **Progress Indicators:**  
  - Percentage of program completed (levels finished).  
  - Last workout date and summary.  
  - Activity history chart (e.g., weekly workout count).  
- **History View:** List of past workouts with filters (by program, date range).  
- **Resume Workout:** If a workout was started but not finished, allow resuming.  

#### 3.1.6 Export and Import  
- **Export Options:**  
  - Export **all data** (programs, levels, moves, logs, settings) as a single JSON file.  
  - Export **a single program** (including its levels, moves, and optionally its logs) as a JSON file.  
- **Import:**  
  - Import a previously exported JSON file.  
  - On import, the user can choose to merge (add new records, skip duplicates based on ID or name) or replace existing data.  
  - Validate the JSON structure and show errors if malformed.  
- **JSON Format:** Must be human‑readable, well‑indented, and easy to parse manually. (See Section 5.3 for schema.)

#### 3.1.7 Synchronization with Supabase (Optional)  
- **Enable Sync:** User provides Supabase URL and anon key. The app tests the connection.  
- **Initial Sync:** If local data exists, user is prompted to either upload local data to Supabase or download remote data (merge conflict resolution strategy: last‑write‑wins, or prompt).  
- **Subsequent Sync:**  
  - Automatic sync on data changes (debounced) or manual sync button.  
  - Offline queue: when offline, changes are stored locally and synced when connection is restored.  
- **Conflict Handling:** Simple timestamp‑based resolution (latest wins). More advanced strategies may be added later.  
- **Seamless Transition:** User can switch from local to sync at any time; data is migrated. Switching off sync leaves local copy intact (user can choose to keep or discard remote data).  

#### 3.1.8 User Interface  
- **Mobile‑First:** Responsive design, touch‑friendly controls.  
- **Dark Mode Only:** Background dark, text light, accent colours (e.g., #00ffaa).  
- **Components:** Inspired by shadcn/ui – clean, minimal, with cards, modals, and simple forms.  
- **Navigation:** Bottom bar (mobile) / side drawer (desktop) with tabs: Programs, Today, History, Settings.  
- **Drag‑and‑drop:** For reordering levels and moves (with fallback buttons).  

### 3.2 Non‑Functional Requirements  

#### 3.2.1 Performance  
- Initial load time < 2s on average 4G connection.  
- UI interactions should feel instantaneous; IndexedDB operations are asynchronous but non‑blocking.  
- Export/Import of up to 10,000 log entries should complete within a few seconds.  

#### 3.2.2 Privacy and Security  
- No data is sent to any server except the user‑configured Supabase.  
- All code is open source and auditable.  
- No cookies or tracking mechanisms.  
- If sync is used, the user is responsible for securing their Supabase credentials and database.  

#### 3.2.3 Usability  
- Intuitive, minimal learning curve.  
- Consistent terminology and icons.  
- Clear feedback for actions (toasts, loading indicators).  
- Help tooltips for advanced features (e.g., custom fields).  

#### 3.2.4 Maintainability and Extensibility  
- Modular JavaScript (ES6+) with clear separation of concerns (storage, UI, sync).  
- Well‑documented code and API interfaces for future contributors.  
- Use of IndexedDB wrapper (like Dexie.js) for simplicity and robustness.  
- Supabase integration via their official JavaScript library.  

#### 3.2.5 Compatibility  
- Supports latest two versions of Chrome, Firefox, Safari, and Edge.  
- Graceful degradation: older browsers may not support IndexedDB; show error message.  

---

## 4. External Interface Requirements  

### 4.1 User Interfaces  
- HTML5, CSS3 (with Tailwind or custom CSS), JavaScript.  
- No external UI libraries except possibly a lightweight framework (e.g., Preact or Alpine.js) to keep bundle small.  
- Icons from a simple open‑source set (e.g., Feather Icons).  

### 4.2 Hardware Interfaces  
- None. Relies on standard browser capabilities.  

### 4.3 Software Interfaces  
- **IndexedDB:** Accessed via a wrapper (e.g., Dexie.js) to simplify transactions and versioning.  
- **Supabase:** Via `@supabase/supabase-js` for database operations and real‑time subscriptions (optional).  
- **File System:** For export/import, uses the File System Access API (where available) with fallback to download/upload via anchor and file input.  

### 4.4 Communication Interfaces  
- HTTPS for serving the app.  
- For sync mode: HTTPS connection to Supabase REST API and WebSocket for real‑time.  

---

## 5. Data Specifications  

### 5.1 IndexedDB Schema  
Database name: `TrainingTracker`  
Version: 1  

**Object Stores:**  
- `programs`: `id` as keyPath. Indexes: `name`, `createdAt`.  
- `levels`: `id` as keyPath. Indexes: `programId`, `order`.  
- `moves`: `id` as keyPath. Indexes: `levelId`, `order`.  
- `logs`: `id` as keyPath. Indexes: `programId`, `levelId`, `moveId`, `date`.  
- `settings`: singleton store with fixed key `settings`.  

Relations are maintained via foreign keys (programId, levelId) but not enforced by IndexedDB.  

### 5.2 Supabase Schema (for Sync Users)  
Tables mirror the IndexedDB structure, with additional columns for syncing metadata.  

**Table: programs**  
- Columns: id (uuid primary key), name, description, goal, duration, difficulty, tags (jsonb), created_at, updated_at, color, custom_fields (jsonb).  

**Table: levels**  
- Columns: id (uuid), program_id (uuid references programs), name, description, order, duration, rest_days, notes, created_at, updated_at, custom_fields.  

**Table: moves**  
- Columns: id (uuid), level_id (uuid references levels), name, description, type, target_sets, target_reps, target_weight, target_time, rest_between_sets, video_url, image_url, equipment (jsonb), notes, order, created_at, updated_at, custom_fields.  

**Table: logs**  
- Columns: id (uuid), program_id, level_id, move_id, date, actual_sets, actual_reps, actual_weight, perceived_effort, notes, completed, created_at.  

**Table: user_settings**  
- Columns: id (uuid primary key default 'settings'), dark_mode (bool), ... (other preferences).  

Row Level Security (RLS) should be enabled; each user (authenticated via Supabase Auth) sees only their own data. For simplicity, the first version may assume a single‑user database with no authentication, but the schema is ready for RLS.

### 5.3 Export/Import JSON Format  
The exported JSON is an object with a top‑level `version` field and collections.  

```json
{
  "version": "1.0",
  "exportDate": "2026-02-28T12:00:00Z",
  "data": {
    "programs": [ /* array of program objects */ ],
    "levels": [ /* array of level objects with programId */ ],
    "moves": [ /* array of move objects with levelId */ ],
    "logs": [ /* array of log objects */ ],
    "settings": { /* user settings object */ }
  }
}
```

When exporting a single program, only related levels, moves, and optionally logs are included.  

Import must validate that all referenced IDs exist or resolve them (e.g., create missing programs).  

---

## 6. Appendices  

### 6.1 Glossary  
*(Already covered in 1.3)*  

### 6.2 Future Considerations  
- **Authentication:** Add optional login for Supabase sync to support multi‑user separation.  
- **Templates:** Pre‑loaded example programs.  
- **Social Sharing:** Generate shareable links (if hosted on a public instance).  
- **Advanced Analytics:** Volume charts, personal records.  
- **Wearable Integration:** Import heart rate, etc.  

---

**End of Document**
