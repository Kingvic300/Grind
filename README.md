# Grind

Grind tracks the hackathons you enter: dates, status, deadlines, project, team and results.
You can view them as a list, a kanban board, a calendar, or a page of totals, and Grind emails
you before deadlines.

## Stack

| Part | Tech |
| --- | --- |
| `apps/web` | React 19, Vite, React Router, TanStack Query, dnd-kit, plain CSS |
| `apps/api` | NestJS 11, Prisma 6, PostgreSQL, JWT session cookie, Brevo or SMTP email |

## Run it

Requires Node 20+ and pnpm.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # then fill in the values
pnpm --filter @grind/api exec prisma migrate deploy
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api (the web dev server proxies `/api` to it)

### Environment (`apps/api/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection. With Neon, use the pooled URL. |
| `DIRECT_URL` | Direct Postgres connection, used for migrations. With Neon, the host without `-pooler`. |
| `JWT_SECRET` | Signs session cookies. Generate with `openssl rand -hex 32`. |
| `BREVO_API_KEY` | When set, reminder emails are sent through Brevo. |
| `MAIL_FROM` | Sender, for example `Grind <you@example.com>`. With Brevo it must be a verified sender. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP fallback, used when `BREVO_API_KEY` is empty. |
| `WEB_ORIGIN`, `APP_URL` | Allowed browser origin, and the link placed in emails. |
| `TAVILY_API_KEY` | Optional. Tavily search API key (free plan: 1,000 credits a month) that lets Discover list LinkedIn hackathon events. Without it the LinkedIn source is off. |

`.env` is ignored by git. Never commit it.

### Local database instead of Neon

`docker compose up -d` starts Postgres on `localhost:5432` and Mailpit (an inbox that catches
all outgoing email) on http://localhost:8025. Point both database URLs at
`postgresql://grind:grind@localhost:5432/grind` and leave `BREVO_API_KEY` empty.

## Shared lists

Every user has a private list. On the Sharing page a user can also create shared lists. Each
shared list has an invite link (`/join/<code>`). Anyone who opens the link and logs in joins
the list, and every member can add, edit and delete its hackathons. The owner can remove
members and make a new link, which stops the old one working.

Changes reach other open browsers at once through Server-Sent Events (`GET /api/events`).
The event bus is in memory, so this works with one API instance. Several instances would
need a shared bus such as Postgres `LISTEN/NOTIFY`.

## Discover

The Discover page lists open and upcoming hackathons from Devpost, DoraHacks, Devfolio and
MLH, and adds any of them to the list you are viewing in one click. The API fetches them
server side (`GET /api/discover`, login required) and caches the result for 30 minutes.
None of these sites offer an official public API: Grind reads the endpoints their own pages
use (and the schema.org markup on MLH's events page), so a site change can break one
source. A broken source shows a notice and the others still load.

## Goals

The Goals page sets targets that fill in by themselves: hackathons entered (Registered or
later), projects submitted (Submitted or Done), wins, prize money, or hackathons built with a
given tech (past Interested). A goal can also be free text that you tick off by hand. Each goal
covers this month, quarter or year, next year, chosen dates, or no end date. A hackathon counts
on the day it ends, or the day it starts, or the day it was added.

- Personal goals are seen only by their owner. They count the private list, plus shared-list
  hackathons the owner added or is assigned to.
- Team goals belong to a shared list. Every member sees and edits them, and they count all of
  that list's hackathons.

The API counts progress (`GET /api/goals`). Overview shows up to three goals still in play.

## Notes

The Notes page holds quick notes: some text, a link, or both, with an optional reminder. Notes
are personal, or shared with a team when made while a shared list is open. A note whose
reminder time has passed shows under "Due now" and as a count on the Notes tab until it is
ticked off.

## How reminders work

Every 10 minutes the API looks for deadlines that are close and sends each reminder once:

- 3 days and 1 day before a submission closes, while the hackathon is not yet submitted
- 1 day before a registration closes, while the hackathon is still marked Interested

Reminders for a shared list go to every member who has reminders on.

Note reminders are checked every minute and emailed once when they come due: personal notes to
their owner, team notes to every member. A reminder more than a day late is not emailed.

Users can turn the emails off in Settings.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the API and the web app in watch mode |
| `pnpm build` | Builds both apps |
| `pnpm typecheck` | Type-checks both apps |
| `pnpm db:migrate` | Creates and applies a migration during development |
