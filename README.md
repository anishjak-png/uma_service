# Uma Traders — Job Card System

Mobile-first job card management for home appliance repair service.

**Database:** Supabase (PostgreSQL) only — all data in the cloud, no local database file.

## Features

- Create job cards with auto-generated job numbers (`UMA-2026-000001`)
- Automatic LAN thermal receipt printing via print agent (optional)
- Search by mobile number or job card number
- Technician status updates and cost entry
- Pending WhatsApp screen for Ready notifications
- Customer signature on delivery
- Public customer status page at `/j/[jobNumber]`
- PIN-based staff login (Reception / Technician / Admin)
- Admin: technicians, customers, billing reports

## Quick Start

1. Create a [Supabase](https://supabase.com) project
2. Copy `.env.example` → `.env` and add your Supabase `DATABASE_URL` + `DIRECT_URL`
3. Run:

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Full Supabase setup: **[docs/SUPABASE.md](docs/SUPABASE.md)**

### Default PINs (change before production)

| Role | PIN |
|------|-----|
| Reception | 1234 |
| Technician | 5678 |
| Admin | 9999 |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase pooler URL (port 6543) — app runtime |
| `DIRECT_URL` | Supabase direct URL (port 5432) — schema push / seed |
| `SESSION_SECRET` | Min 32 characters |
| `RECEPTION_PIN`, `TECHNICIAN_PIN`, `ADMIN_PIN` | Staff login |
| `NEXT_PUBLIC_APP_URL` | Public app URL (QR on receipts) |
| `NEXT_PUBLIC_SHOP_NAME`, `NEXT_PUBLIC_SHOP_PHONE` | Receipt / UI |
| `PRINT_AGENT_API_KEY` | LAN print agent auth (optional) |

## Deploy to Production (Vercel + Supabase)

1. Push schema: `npm run db:push` (once, against Supabase)
2. Seed: `npm run db:seed` (once)
3. Import repo on [Vercel](https://vercel.com)
4. Set all env vars (see [docs/SUPABASE.md](docs/SUPABASE.md))
5. Deploy — phones use `https://your-app.vercel.app`

## LAN Thermal Printer (optional)

Print agent on shop PC polls the **cloud app**; data stays in Supabase.

See [docs/PRINT_SETUP.md](PRINT_SETUP.md) for full setup (local test + shop PC).

## Daily Workflow

1. **Reception:** Create job → receipt prints (if agent running) → sticker → hand receipt
2. **Technician:** Update status and cost
3. **WhatsApp Pending:** Send Ready messages when free
4. **Delivery:** Search → signature → mark delivered
