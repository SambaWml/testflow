# TestFlow — Test Management System

A complete web platform for planning, executing, and reporting software tests — with AI-powered test case generation.

## Features

- **Dashboard** — overview with metrics, pass rate, status chart, and quick actions
- **Projects** — organize items and test cases per project, with expand/collapse and tab view (items / test cases)
- **Items** — register User Stories, Bugs, Improvements, Requirements, Flows, and Tasks
- **AI Generator** — generate BDD or Step-by-Step test cases via OpenAI GPT-4o (falls back to mock without API key); optionally create a Test Plan directly after generation
- **Test Cases** — list and grid views, filter by project/format/priority, bulk delete
- **Executions** — run test plans case by case, record status, notes, bug refs, and multiple evidence links; navigate back to previous cases while preserving draft input
- **Reports** — consolidate executions, view pass/fail stats, export to PDF or copy as Markdown
- **Settings** — manage projects, modules, terminology, and system preferences (including language)
- **Profile** — edit name and change password from the topbar avatar dropdown

## Tech Stack

- Next.js 15 (App Router) + TypeScript 5
- Prisma 6 + SQLite (swap to PostgreSQL for production)
- Tailwind CSS 4 + Radix UI
- TanStack Query v5
- NextAuth v5 (JWT strategy)
- OpenAI GPT-4o (test case generation)
- Recharts (charts)

## Setup

### Requirements
- Node.js 20+
- npm

### Installation

```bash
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Access: http://localhost:3000

**Demo login:** admin@testflow.com / admin123

### Environment variables (.env.local)

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional — enables real AI generation (uses mock without this)
OPENAI_API_KEY="sk-..."
```

## AI Generation

- **Without `OPENAI_API_KEY`**: generates mock test cases automatically (fully functional for testing).
- **With `OPENAI_API_KEY`**: uses GPT-4o for context-aware, real generation based on the item description.

## PDF Export

The PDF report opens in a new tab with a formatted layout and triggers `window.print()` automatically. Use "Save as PDF" in the browser print dialog.

## Database

SQLite by default (`dev.db`). To use PostgreSQL in production:

```env
DATABASE_URL="postgresql://user:pass@host:5432/testflow"
```

Then run `npx prisma migrate deploy`.

## Routes

| Route | Screen |
|---|---|
| `/` | Dashboard |
| `/projects` | Projects & Items |
| `/generator` | AI Test Case Generator |
| `/cases` | Test Cases |
| `/executions` | Test Execution |
| `/reports` | Reports |
| `/settings` | Settings |
