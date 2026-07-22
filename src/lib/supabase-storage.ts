const MAX_PHOTOS = 3;

function getStorageConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "product-photos";

  if (!url || !key) {
    throw new Error("Supabase Storage is not configured");
  }

  return { url, key, bucket };
}

export type PhotoBufferPayload = {
  buffer: Buffer;
  type: string;
  name: string;
};

export async function uploadProductPhotoBuffers(
  photos: PhotoBufferPayload[],
  jobNumber: string
): Promise<string[]> {
  const { url, key, bucket } = getStorageConfig();
  const urls: string[] = [];

  for (const photo of photos.slice(0, MAX_PHOTOS)) {
    const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeJobNumber = jobNumber.replace(/\s+/g, "-");
    const path = `${safeJobNumber}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": photo.type || "image/jpeg",
        "x-upsert": "false",
      },
      body: new Uint8Array(photo.buffer),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Photo upload failed: ${detail}`);
    }

    urls.push(`${url}/storage/v1/object/public/${bucket}/${path}`);
  }

  return urls;
}

export async function uploadProductPhotos(
  files: File[],
  jobNumber: string
): Promise<string[]> {
  const photos = await Promise.all(
    files.slice(0, MAX_PHOTOS).map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      type: file.type || "image/jpeg",
      name: file.name,
    }))
  );
  return uploadProductPhotoBuffers(photos, jobNumber);
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
