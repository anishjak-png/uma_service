# Supabase setup

All app data lives in **Supabase PostgreSQL**. No SQLite, no database on your PC.

## 1. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. **New project** → choose name, password (save the DB password)
3. Wait for the project to finish provisioning

## 2. Get connection strings

In Supabase: **Project Settings → Database → Connection string**

Copy two URLs (replace `[PASSWORD]` with your database password):

| Variable | Supabase tab | Port | Used for |
|----------|--------------|------|----------|
| `DATABASE_URL` | **Transaction pooler** (or Session pooler) | **6543** | App runtime (Vercel, `npm run dev`) |
| `DIRECT_URL` | **Direct connection** | **5432** | `npm run db:push`, `npm run db:seed` |

Example `.env`:

```env
DATABASE_URL="postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
```

Copy [`.env.example`](.env.example) to `.env` and paste your URLs.

## 3. Create tables and seed data

```bash
npm install
npm run db:push
npm run db:seed
```

- `db:push` — creates all tables in Supabase
- `db:seed` — adds default technicians, appliances, brands, complaints

## 4. Run locally (optional)

```bash
npm run dev
```

Local dev uses the **same Supabase database** as production unless you create a second Supabase project for staging.

## 5. Deploy to Vercel

1. Push code to GitHub
2. [vercel.com](https://vercel.com) → Import repository
3. Add environment variables (same as `.env`, plus production URLs):

   | Variable | Notes |
   |----------|--------|
   | `DATABASE_URL` | Supabase pooler (6543) |
   | `DIRECT_URL` | Supabase direct (5432) — needed for build if you add migrate step |
   | `SESSION_SECRET` | Random 32+ characters |
   | `RECEPTION_PIN`, `TECHNICIAN_PIN`, `ADMIN_PIN` | **Change defaults** |
   | `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
   | `NEXT_PUBLIC_SHOP_NAME`, `NEXT_PUBLIC_SHOP_PHONE` | Shop details |
   | `PRINT_AGENT_API_KEY` | If using LAN printer |

4. Deploy

## 6. Print agent (optional — not the database)

Thermal printing still needs a small program on the shop PC to reach the LAN printer. It reads print jobs **from Supabase via the cloud app** — it does not store data locally.

```env
PRINT_AGENT_APP_URL="https://your-app.vercel.app"
PRINT_AGENT_API_KEY="same as Vercel"
THERMAL_PRINTER_HOST="192.168.1.x"
```

```bash
npm run print-agent
```

## View / edit data in browser

Supabase **Table Editor** — or locally:

```bash
npm run db:studio
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Can't reach database` | Check password, IP allowlist (Supabase allows all by default) |
| `db:push` fails with pooler | Use `DIRECT_URL` on port 5432 |
| App works locally, fails on Vercel | Add all env vars in Vercel dashboard, redeploy |
| Empty technicians dropdown | Run `npm run db:seed` |

## Security — Supabase “RLS disabled” / “sensitive data exposed” alerts

Supabase hosts PostgreSQL and also exposes tables through a **public REST API** (`/rest/v1/...`) when Row Level Security (RLS) is off.

**This app does not use that API for data.** All reads/writes go through **Next.js API routes + Prisma** using `DATABASE_URL` on the server. Staff auth is PIN/session based in the app — not Supabase Auth.

If Supabase emails you about public tables (e.g. `Customer`, `NotificationSettings` with tokens/mobile numbers), fix it once:

1. Supabase Dashboard → **SQL Editor** → New query
2. Paste and run [`prisma/enable-rls.sql`](../prisma/enable-rls.sql)
3. Dashboard → **Database → Security Advisor** → confirm issues are cleared

That script:

- Enables RLS on all `public` tables (blocks anon/authenticated API access)
- Revokes table grants from `anon` and `authenticated` roles
- Does **not** break Prisma, `db:push`, seed, or Table Editor (postgres role bypasses RLS)

**Storage:** Product photos use the **service role key** server-side only (`SUPABASE_SERVICE_ROLE_KEY`). Never expose that key or the database password in the browser. Keep `NEXT_PUBLIC_*` vars limited to shop name, phone, app URL.

**Do not** put the Supabase **anon** key in this app for database access — it is not needed for uma-service.
