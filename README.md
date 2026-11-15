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

`.env` is ignored by git. Never commit it.

### Local database instead of Neon

`docker compose up -d` starts Postgres on `localhost:5432` and Mailpit (an inbox that catches
all outgoing email) on http://localhost:8025. Point both database URLs at
`postgresql://grind:grind@localhost:5432/grind` and leave `BREVO_API_KEY` empty.

## How reminders work

Every 10 minutes the API looks for deadlines that are close and sends each reminder once:

- 3 days and 1 day before a submission closes, while the hackathon is not yet submitted
- 1 day before a registration closes, while the hackathon is still marked Interested

Users can turn the emails off in Settings.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the API and the web app in watch mode |
| `pnpm build` | Builds both apps |
| `pnpm typecheck` | Type-checks both apps |
| `pnpm db:migrate` | Creates and applies a migration during development |
