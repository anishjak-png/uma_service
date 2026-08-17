import { getSpaSupabase, spaStorageBucket } from "./supabase";

export async function uploadJpeg(path: string, buffer: Buffer): Promise<void> {
  const { error } = await getSpaSupabase().storage.from(spaStorageBucket()).upload(path, buffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
}

export async function deleteObject(path: string): Promise<void> {
  const { error } = await getSpaSupabase().storage.from(spaStorageBucket()).remove([path]);
  if (error) throw error;
}

export async function signedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await getSpaSupabase()
    .storage.from(spaStorageBucket())
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await getSpaSupabase()
    .storage.from(spaStorageBucket())
    .createSignedUrls(unique, 3600);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}
