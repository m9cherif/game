# Neon Strike (Next.js + PostgreSQL)

A browser-based multiplayer shooter built with Next.js 16, React 19, Three.js, and Drizzle ORM on PostgreSQL.

The app is built so it **compiles and starts without a database** — API routes return `503 database not configured` until `DATABASE_URL` is provided. That means you can deploy it to any platform (Vercel, Netlify, Render, Railway, Fly.io, Docker hosts, etc.) and attach a Postgres database later without ever breaking the build.

## Environment variables

| Variable      | Required? | Purpose                                                                 |
| ------------- | --------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`| Runtime   | PostgreSQL connection string. Build succeeds without it; multiplayer / high-scores APIs return 503 until set. |

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
# edit .env.local with your Postgres URL
```

## Database setup (once DATABASE_URL is set)

```bash
npx drizzle-kit push   # creates tables defined in src/db/schema.ts
```

## Scripts

```bash
npm install        # install deps
npm run dev        # local dev server (next dev)
npm run build      # production build (works with or without DATABASE_URL)
npm run start      # start the production server
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Deploying anywhere

The build does **not** require `DATABASE_URL`, so the production build will pass on any host. Set `DATABASE_URL` as a runtime environment variable pointing to your Postgres instance (Supabase, Neon, Railway Postgres, Render Postgres, Fly.io Postgres, AWS RDS, etc.).

### Vercel
1. Import the repo.
2. Add `DATABASE_URL` in **Project Settings → Environment Variables**.
3. (Optional) Provision a Vercel Postgres / Neon database and paste its URL.
4. Deploy. Run `drizzle-kit push` against the production DB once.

### Docker
```bash
docker build -t neonstrike .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." neonstrike
```

### Render / Railway / Fly.io
- Set build command: `npm run build`
- Set start command: `npm run start`
- Set env var `DATABASE_URL` to the platform-provided Postgres URL.
- Expose port `3000`.

## Health check

`GET /api/health` returns:
- `200 { ok: true, status: "ok" }` when DB is reachable.
- `503 { ok: false, status: "no-database" }` when `DATABASE_URL` is not set.
- `503 { ok: false, status: "db-connection-failed" }` when the DB is unreachable.

Use this for platform health checks / uptime monitors.
