# Shop PC print bridge

## One-time setup (your team)

Double-click **`INSTALL.bat`** once.

Requires **Node.js 20+** and **Git**. The installer will:
- Clone/update the project
- Run `npm install`
- Create `.env` (opens Notepad for Supabase + printer IP)
- Register **auto-start on Windows login**
- Start the bridge immediately

**No daily steps.** Bridge starts within seconds of login.

## Administrator updates only

Double-click **`Update-PrintBridge.bat`** when deploying new versions:
- `git pull`
- `npm install`
- Restarts the bridge

Never run updates on every login — printing must start instantly.

## Other files

| File | Purpose |
|------|---------|
| `START-NOW.bat` | Manual start |
| `Update-PrintBridge.bat` | Admin: pull updates |
| `Uninstall-PrintBridge.bat` | Remove auto-start |

## Health dashboard

While running: **http://localhost:3005**

Shows Realtime/Supabase/printer status, queue length, last print, errors.

## Logs

`logs/print-bridge.log` — automatically rotated (keeps last 7 files).
