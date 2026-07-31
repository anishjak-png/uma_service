# Windows Print Bridge — Supabase Realtime

Production print bridge for shop PCs. Instant receipts via Supabase Realtime INSERT events — **no HTTP polling**.

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
LAN Printer (PRINTER_IP:PRINTER_PORT)
```

**Modules (Windows Service ready):** Configuration · Realtime Manager · Print Queue · Printer Driver · Logger · Health Server · Connectivity Monitor

## Shop PC — one-click install

Double-click **`scripts/shop-pc/INSTALL.bat`** once.

| Step | Who |
|------|-----|
| `INSTALL.bat` | Once per PC |
| `Update-PrintBridge.bat` | Administrator only (git pull + npm install) |
| Daily startup | Automatic on Windows login |

Bridge starts in **under 5 seconds** — no git pull, no npm install on login.

## Shop PC `.env`

Copy [`.env.shop.example`](../.env.shop.example):

| Variable | Example |
|----------|---------|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API |
| `BRANCH_ID` | `main` (must match Vercel `PRINT_BRANCH_ID`) |
| `PRINTER_ID` | `counter-1` (must match Vercel `PRINT_PRINTER_ID`) |
| `PRINTER_IP` | LAN printer IP |
| `PRINTER_PORT` | `9100` |
| `PRINTER_NAME` | `Counter Printer` |
| `HEALTH_PORT` | `3005` (optional) |

Legacy names still work: `PRINT_BRANCH_ID`, `THERMAL_PRINTER_HOST`, etc.

## Vercel environment variables

| Variable | Value |
|----------|-------|
| `PRINT_BRANCH_ID` | `main` |
| `PRINT_PRINTER_ID` | `counter-1` |

## Health dashboard

While the bridge runs: **http://localhost:3005**

Shows version, Realtime/Supabase/printer status, queue length, last printed job, last error, heartbeat.

JSON API: `http://localhost:3005/status`

## Reliability features

- **Auto-reconnect** — Supabase Realtime, internet, printer (with retries)
- **Missed job recovery** — on reconnect, prints all `Pending` jobs FIFO, then continues Realtime
- **Duplicate protection** — atomic DB claim + in-memory dedup
- **Sequential queue** — one receipt at a time
- **Log rotation** — keeps last 7 log files in `logs/`

## Manual start (alternative)

```bash
npm run print-bridge
```

Expected logs:

```
Print Bridge Started
Realtime Connected
Printing Job UT 3
Print Successful: UT 3
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No Realtime events | Run `prisma/enable-printjob-realtime.sql` in Supabase |
| Job skipped (branch/printer) | Match `BRANCH_ID` / `PRINTER_ID` with Vercel |
| Print Failed | Check health dashboard; `Test-NetConnection` to `PRINTER_IP` port 9100 |
| Duplicate prints | Ensure only one bridge instance; run latest update |
| Apply code updates | Admin runs `Update-PrintBridge.bat` — not on login |
