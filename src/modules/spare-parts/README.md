# Spare-parts billing (removable block)

Admin-only camera sales + catalogue. Isolated from jobs, customers, and WhatsApp.

## Files

- `src/modules/spare-parts/` — all feature code
- `src/app/spare-parts/` — thin page mounts
- `src/app/api/spare-parts/` — thin API mounts
- Print hook: `enqueueSalePrint` in `src/lib/print-queue.ts` and `type === "sale"` in `scripts/print-bridge/print-queue-manager.ts`

## Env

```
SPARE_PARTS_ENABLED=true
NEXT_PUBLIC_SPARE_PARTS_ENABLED=true
VOYAGE_API_KEY=...
SPA_STORAGE_BUCKET=spa-spare-part-images
```

Set both enabled flags to `false` to hide the Settings tab and routes without deleting code.

## Removal

1. Delete `src/modules/spare-parts/`, `src/app/spare-parts/`, `src/app/api/spare-parts/`
2. Remove the Spare parts Settings tab and `isSparePartsEnabled` checks
3. Remove `enqueueSalePrint` / `getSalePrintStatus` from `src/lib/print-queue.ts`
4. Remove `scripts/print-bridge/sale-receipt.ts` and the `type === "sale"` branch in the print bridge
5. Remove spare-parts middleware block and `canAccessSpareParts` from `src/lib/auth.ts`
6. Optional: drop `spa_*` tables and the `spa-spare-part-images` bucket later

`PrintJob.jobCardId` staying optional and unused `payload` do not affect job receipts.
