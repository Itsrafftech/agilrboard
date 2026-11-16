# AgileBoard

A clean, minimal Kanban project management tool for agile teams — drag-and-drop boards, sprint planning, workload tracking, and real-time reporting.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **API:** tRPC (end-to-end type safety)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** NextAuth.js (credentials + Google OAuth)
- **Drag & drop:** @dnd-kit
- **Charts:** Recharts
- **PDF export:** html2canvas + jsPDF

## Features

- **Kanban board** — drag-and-drop cards across To Do / In Progress / In Review / Done, with priority color coding, assignees, due dates, and labels.
- **Sprint planning** — create sprints with a goal and date range, move backlog items into the active sprint, track velocity.
- **Team workload** — per-member task count and story point load, visualized as a bar chart, plus an assignee filter on the board.
- **Reporting** — burndown chart, cumulative flow diagram, per-member completion rate, and one-click PDF export.
- **Projects & teams** — multiple projects, invite members by email, role-based access (Admin / Member / Viewer).

## Getting Started

### 1. Prerequisites

- Node.js 18+
- A PostgreSQL database (local, Docker, or hosted)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (use the pooler URL if you have one) |
| `DIRECT_URL` | Direct (non-pooled) connection string used by the Prisma CLI. Same as `DATABASE_URL` locally |
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Random secret — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) to enable "Continue with Google". Leave blank to use credentials-only login. |

### 4. Start PostgreSQL

If you don't already have a database, the included `docker-compose.yml` spins one up:

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` matching the default `DATABASE_URL` in `.env.example`.

### 5. Apply migrations and seed demo data

```bash
npm run db:deploy   # prisma migrate deploy: applies everything in prisma/migrations
npm run db:seed
```

For day-to-day schema work use `npm run db:migrate` (`prisma migrate dev`) to create and apply new migrations. Do not use `db push` on a database you care about: it leaves no migration history.

**Database that was created earlier with `db push`** (no `_prisma_migrations` table)? Baseline it once, then deploy. The first migration, `20261116000000_init`, is exactly the old schema:

```bash
npx prisma migrate resolve --applied 20261116000000_init
npm run db:deploy   # applies 20261116182832_task_status_change
```

That migration adds the `TaskStatusChange` table and writes one **baseline** snapshot row per existing task (see "Notes on reporting"). Back up the database first if it holds real data.

The seed script creates:
- 3 users (`alice@agileboard.dev` is the project admin, `bob@agileboard.dev`, `carol@agileboard.dev`). Their password is `SEED_PASSWORD` if set, otherwise a random one printed once at the end of the seed output
- A passwordless shared demo account (`demo@agileboard.dev`) behind the "Try Demo" button. It is sandboxed to the demo project and cannot create projects or manage members
- One demo project ("AgileBoard Demo") with labels
- A completed sprint (Sprint 0) and an active sprint (Sprint 1) with tasks in every status, plus a **synthetic** status history for them so the demo charts have something to show
- Several backlog tasks not yet assigned to a sprint

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a seeded user (password from the seed output) or click **Try Demo**.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm start` | Production build and start |
| `npm run db:deploy` | Apply committed migrations (`prisma migrate deploy`) |
| `npm run db:migrate` | Create and apply a new migration during development |
| `npm run db:push` | Prototype only: sync the schema without migration history |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio to browse data |

## Tests

Authorization tests (Vitest) call the tRPC routers directly against a real, throwaway PostgreSQL. They cover cross-project access, viewer/admin roles, last-admin protection, foreign assignee/sprint/label ids, the demo sandbox and task ordering.

```bash
npm run test:db:up   # starts Postgres on localhost:54329 (RAM-backed, docker compose profile "test")
npm test             # runs the suite once
```

The suite uses `TEST_DATABASE_URL` (default `postgresql://postgres:postgres@localhost:54329/agileboard_test`) and **never** `DATABASE_URL`. It refuses to start unless the host is local and the database name ends in `_test`. Data is truncated between tests. To start from a blank schema: `docker compose --profile test down && npm run test:db:up`.

## Project Structure

```
app/                    Next.js App Router pages & layouts
  (auth)/login          Login page
  (auth)/register       Registration page
  (dashboard)/projects  Project list, and per-project Board/Backlog/Sprint/Reports/Team
  api/auth              NextAuth route handler
  api/trpc              tRPC fetch adapter route handler
components/             Reusable UI (ui/, board/, sprint/, team/, reports/, project/, layout/)
server/                 tRPC context, middleware, and routers
lib/                    Prisma client, NextAuth config, tRPC client, utilities
prisma/                 schema.prisma and seed.ts
types/                  Shared TypeScript types and UI constants
```

## Data model

`User`, `Account` / `Session` (NextAuth), `Project`, `ProjectMember` (role: Admin/Member/Viewer), `Sprint`, `Task`, `TaskComment`, `Label` — see [`prisma/schema.prisma`](prisma/schema.prisma) for the full schema.

## Notes on reporting

Burndown and cumulative flow are computed from `TaskStatusChange`, an append-only log written in the same transaction as every status change (create, move between columns, add to / remove from a sprint). Nothing is interpolated:

- **Burndown** = story points of the tasks that were in the sprint at the end of each day and not Done, so scope added or removed mid-sprint is visible. Future days are blank. The ideal line starts from the scope at the end of day one.
- **Cumulative flow** = number of sprint tasks per status at the end of each day, for days that have real data.
- **Sprints that predate the log**: the migration stores one *baseline* snapshot per existing task at migration time, because the real timing of earlier changes is unknown. Days before that snapshot are left blank and the report says "history is only available from <date>". A sprint with no usable history says so and shows only today's real value.
- Limits: story points are read from the task's current value (edits to points are not versioned), and deleting a task removes its history.
- The seed script writes a clearly synthetic history for the demo sprint.
