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
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Random secret — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) to enable "Continue with Google". Leave blank to use credentials-only login. |

### 4. Start PostgreSQL

If you don't already have a database, the included `docker-compose.yml` spins one up:

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` matching the default `DATABASE_URL` in `.env.example`.

### 5. Push the schema and seed demo data

```bash
npm run db:push
npm run db:seed
```

The seed script creates:
- 3 demo users (`alice@agileboard.dev`, `bob@agileboard.dev`, `carol@agileboard.dev`), all with password `password123`
- One demo project ("AgileBoard Demo") with labels
- A completed sprint (Sprint 0) and an active sprint (Sprint 1) with tasks in every status
- Several backlog tasks not yet assigned to a sprint

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with any seeded user.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm start` | Production build and start |
| `npm run db:push` | Push the Prisma schema to your database (no migration history) |
| `npm run db:migrate` | Create and apply a Prisma migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio to browse data |

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

Burndown and cumulative-flow data are derived from each task's **current** status rather than a stored history table (the schema intentionally doesn't include a status-change log). The ideal burndown line and past-day series are computed from today's actual remaining points, which is the standard approach when only current-state data is available. If you need true day-by-day history, add a `TaskStatusChange` table and update `server/routers/report.ts` to read from it instead.
