# Windows Print Bridge — Supabase Realtime

Instant receipt printing with **no polling**. The bridge subscribes to `INSERT` events on `PrintJob` via Supabase Realtime.

## Architecture

```
Reception (phone/browser)
        │
        ▼
Vercel ERP — creates PrintJob (status: Pending)
        │
        ▼
Supabase PostgreSQL
        │
        ▼ Realtime INSERT event
Windows Print Bridge (shop PC)
        │
        ▼ ESC/POS
LAN Printer 192.168.1.87:9100
```

## One-time Supabase setup

1. Run `npm run db:push` to apply schema changes
2. In **Supabase SQL Editor**, run [`prisma/enable-printjob-realtime.sql`](../prisma/enable-printjob-realtime.sql)

## Shop PC `.env`

Copy [`.env.shop.example`](../.env.shop.example):

| Variable | Example |
|----------|---------|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API |
| `PRINT_BRANCH_ID` | `main` (must match Vercel) |
| `PRINT_PRINTER_ID` | `counter-1` (must match Vercel) |
| `THERMAL_PRINTER_HOST` | `192.168.1.87` |

## Vercel environment variables

| Variable | Value |
|----------|-------|
| `PRINT_BRANCH_ID` | `main` |
| `PRINT_PRINTER_ID` | `counter-1` |

## Start the bridge

```bash
npm install
npm run print-bridge
```

Expected logs:

```
Print Bridge Started
Realtime Connected
New Print Job Received: ...
Printing Job UT 3
Print Successful: UT 3
```

## Behaviour

- **INSERT only** — UPDATE/DELETE ignored
- **Instant print** — no `setInterval` polling
- **FIFO queue** — one receipt at a time
- **Duplicate protection** — in-memory processed job IDs
- **Reconnect** — on websocket restore, syncs missed Pending jobs once
- **Branch/printer filter** — each bridge only prints matching jobs

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No Realtime events | Run `enable-printjob-realtime.sql` |
| Job skipped (branch/printer) | Match `PRINT_BRANCH_ID` / `PRINT_PRINTER_ID` on Vercel and shop PC |
| Print Failed | Check `Test-NetConnection` to printer port 9100 |
