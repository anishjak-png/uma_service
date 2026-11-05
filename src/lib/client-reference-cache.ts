const TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  value?: T;
  expires: number;
  inflight?: Promise<T>;
};

const store = new Map<string, CacheEntry<unknown>>();

async function cachedGet<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit?.value !== undefined && hit.expires > now) {
    return hit.value;
  }
  if (hit?.inflight) {
    return hit.inflight;
  }

  const inflight = loader()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + TTL_MS });
      return value;
    })
    .catch((error) => {
      store.delete(key);
      throw error;
    });

  store.set(key, { value: hit?.value, expires: hit?.expires ?? 0, inflight });
  return inflight;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return (await res.json()) as T;
}

export type NamedOption = { id: string; name: string };

export type ApplianceLookups = {
  brands?: string[];
  complaints?: string[];
  accessories?: string[];
};

export type ApplianceTechnicianMapping = {
  applianceType: string;
  technician: { name: string };
};

export function fetchOutsourcePartners(): Promise<NamedOption[]> {
  return cachedGet("outsource-partners", async () => {
    const data = await getJson<unknown>("/api/outsource-partners");
    return Array.isArray(data) ? (data as NamedOption[]) : [];
  });
}

export function fetchTechnicians(): Promise<NamedOption[]> {
  return cachedGet("technicians", async () => {
    const data = await getJson<unknown>("/api/technicians");
    return Array.isArray(data) ? (data as NamedOption[]) : [];
  });
}

export function fetchApplianceLookups(
  applianceType: string
): Promise<ApplianceLookups> {
  const type = applianceType.trim();
  return cachedGet(`appliance-lookups:${type}`, async () => {
    const data = await getJson<ApplianceLookups>(
      `/api/appliance-lookups?applianceType=${encodeURIComponent(type)}`
    );
    return data ?? {};
  });
}

export function fetchApplianceTechnicians(): Promise<
  ApplianceTechnicianMapping[]
> {
  return cachedGet("appliance-technicians", async () => {
    const data = await getJson<unknown>("/api/appliance-technicians");
    return Array.isArray(data) ? (data as ApplianceTechnicianMapping[]) : [];
  });
}
