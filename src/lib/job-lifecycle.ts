export const DELETED_JOB_STATUS = "Deleted" as const;

export const DUPLICATE_CREATE_WINDOW_MS = 60_000;

export function isDeletedStatus(status: string | null | undefined) {
  return status === DELETED_JOB_STATUS;
}

export function notDeletedWhere() {
  return { status: { not: DELETED_JOB_STATUS } };
}

/** Add status-not-Deleted only when the query is not already status-filtered. */
export function excludeDeletedFromWhere<T extends Record<string, unknown>>(
  where: T
): T {
  if (where.status != null) return where;
  return { ...where, status: { not: DELETED_JOB_STATUS } };
}

export function parseCreateKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  if (key.length < 8 || key.length > 80) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(key)) return null;
  return key;
}
