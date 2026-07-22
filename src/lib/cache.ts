const store = new Map<string, { data: unknown; expires: number }>();

export const CACHE_TTL = {
  todayCollection: 30_000,
  monthlyCollection: 300_000,
  reports: 300_000,
} as const;

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttlMs: number) {
  store.set(key, { data, expires: Date.now() + ttlMs });
}
