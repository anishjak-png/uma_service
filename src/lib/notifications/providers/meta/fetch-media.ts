import type { NotificationSettingsDto } from "../../types";
import { resolveMetaGraphApiVersion } from "./payload-builder";

type MetaMediaMetadata = {
  url?: string;
  mime_type?: string;
  file_size?: number;
  id?: string;
};

export function buildMetaMediaEndpoint(
  mediaId: string,
  settings: NotificationSettingsDto
): string {
  const version = resolveMetaGraphApiVersion(settings);
  return `https://graph.facebook.com/${version}/${mediaId}`;
}

export async function fetchMetaMediaMetadata(
  mediaId: string,
  accessToken: string,
  settings: NotificationSettingsDto
): Promise<{ ok: true; url: string; mimeType: string } | { ok: false; error: string }> {
  const url = buildMetaMediaEndpoint(mediaId, settings);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return { ok: false, error: `Meta media lookup failed (${res.status})` };
  }

  let data: MetaMediaMetadata;
  try {
    data = (await res.json()) as MetaMediaMetadata;
  } catch {
    return { ok: false, error: "Invalid Meta media response" };
  }

  if (!data.url) {
    return { ok: false, error: "Media URL missing from Meta response" };
  }

  return {
    ok: true,
    url: data.url,
    mimeType: data.mime_type ?? "image/jpeg",
  };
}

export async function downloadMetaMedia(
  mediaUrl: string,
  accessToken: string
): Promise<{ ok: true; buffer: Buffer; mimeType: string } | { ok: false; error: string }> {
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return { ok: false, error: `Media download failed (${res.status})` };
  }

  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();

  return {
    ok: true,
    buffer: Buffer.from(arrayBuffer),
    mimeType: mimeType.split(";")[0]?.trim() || "image/jpeg",
  };
}
