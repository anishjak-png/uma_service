# Uma Traders — Job Card System

Mobile-first job card management for home appliance repair service.

## Features

- Create job cards with auto-generated job numbers (`UMA-2026-000001`)
- **Automatic LAN thermal receipt printing** via print agent on server PC
- Search by mobile number or job card number
- Technician status updates and cost entry
- Pending WhatsApp screen for Ready notifications (free, via shop mobile)
- Customer signature on delivery
- Public customer status page at `/j/[jobNumber]`
- PIN-based staff login (Reception / Technician / Admin)

## Quick Start

```bash
npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Default PINs (change in `.env`)

| Role | PIN |
|------|-----|
| Reception | 1234 |
| Technician | 5678 |
| Admin | 9999 |

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` — SQLite for local dev (`file:./dev.db`), PostgreSQL/Supabase for production
- `SESSION_SECRET` — min 32 characters
- `RECEPTION_PIN`, `TECHNICIAN_PIN`, `ADMIN_PIN`
- `NEXT_PUBLIC_SHOP_NAME`, `NEXT_PUBLIC_SHOP_PHONE`, `NEXT_PUBLIC_APP_URL`
- `PRINT_AGENT_API_KEY` — shared secret between app and print agent

## LAN Thermal Printer Setup

The app enqueues print jobs when a job card is created. A **print agent** on the shop server PC polls the app and sends ESC/POS to the 80mm LAN printer (port 9100).

### 1. Configure the app

Set in `.env` (or Vercel env for production):

```
PRINT_AGENT_API_KEY="your-long-random-secret"
NEXT_PUBLIC_APP_URL="https://your-app-url.com"
```

### 2. Configure the server PC

On the always-on PC connected to the same network as the printer:

```bash
# In .env on server PC:
PRINT_AGENT_APP_URL="https://your-app-url.com"
PRINT_AGENT_API_KEY="same-secret-as-app"
THERMAL_PRINTER_HOST="192.168.1.100"
THERMAL_PRINTER_PORT="9100"
PRINT_AGENT_POLL_MS="2000"
```

Start the agent:

```bash
npm run print-agent
```

Run at Windows startup via Task Scheduler or PM2.

### 3. Verify printer connectivity

```powershell
Test-NetConnection 192.168.1.100 -Port 9100
```

Create a test job from reception — receipt should print within ~2 seconds.

## Deploy to Production

1. Create a Supabase project and get the PostgreSQL connection string
2. Update `DATABASE_URL` in production env
3. Change `provider` in `prisma/schema.prisma` to `postgresql` if needed
4. Deploy to Vercel: `vercel deploy`
5. Set all env vars in Vercel dashboard (including `PRINT_AGENT_API_KEY`)
6. Run print agent on shop server PC pointing at production URL

## Daily Workflow

1. **Reception:** Create job → receipt auto-prints → write sticker → hand receipt to customer
2. **Technician:** Update status and enter cost in app
3. **When free:** Open WhatsApp Pending → send Ready messages → mark sent
4. **Delivery:** Search job → customer signs → mark delivered

## Hardware

- 1 Android phone at reception
- 1 LAN 80mm thermal printer (ESC/POS, port 9100)
- 1 always-on server PC running the print agent
- Shop mobile for WhatsApp Ready notifications
