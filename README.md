# GMRE Comp Database

A fullstack web application for Grant Murray Real Estate agents to submit, search, and analyze commercial lease comps — organized by property type, class, and key deal metrics.

## Features

- **Dashboard** — Filterable lease comp table with sortable columns. Property type tabs (Office, Retail, Industrial, Medical, Flex, Mixed-Use, Land). Per-type analytics: avg. base rent, avg. deal size, avg. lease term, avg. TI allowance, top tenant by SF, top landlord by SF.
- **Submit Comp Form** — Password-gated form with all lease fields. AI document extraction: upload a PDF/DOC/TXT and GPT-4o auto-fills the form.
- **Detail View** — Click any comp row for a full-screen detail panel.
- **Export CSV** — One-click CSV export of filtered results.
- **Dark mode** — Full light/dark theme with system preference detection.

## Data Model

Each lease comp captures:
- Property: name, address, type, class, building size, year built, suite, parking ratio
- Lease: tenant, landlord, leased SF, lease type (NNN/FS/MG), base rent, effective rent, term, start/end dates, annual escalation
- Concessions: TI allowance, free rent months, landlord work description
- Metadata: submitted by, submission date

## Running Locally

```bash
npm install
npm run dev
```

App runs on `http://localhost:5000`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SUBMIT_PASSWORD` | `gmre2025` | Password agents enter to submit comps |
| `OPENAI_API_KEY` | — | Required for AI document extraction |

## Deployment

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

The app uses SQLite (`data.db`) for persistent storage — the database file persists across restarts.

## Tech Stack

- Frontend: React, Tailwind CSS, shadcn/ui, TanStack Query, wouter
- Backend: Express, Drizzle ORM, SQLite (better-sqlite3)
- AI: OpenAI GPT-4o-mini for document extraction
- Build: Vite + esbuild
