import type { NotificationSettingsDto } from "../../types";
import { resolveMetaGraphApiVersion } from "./payload-builder";

type MetaUploadResponse = {
  id?: string;
};

function buildMetaUploadEndpoint(
  phoneNumberId: string,
  settings: NotificationSettingsDto
): string {
  const version = resolveMetaGraphApiVersion(settings);
  return `https://graph.facebook.com/${version}/${phoneNumberId}/media`;
}

export async function uploadMetaMedia(params: {
  settings: NotificationSettingsDto;
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  const phoneNumberId = params.settings.phoneNumberId?.trim();
  const accessToken = params.settings.accessToken?.trim();

  if (!phoneNumberId || !accessToken) {
    return {
      ok: false,
      error: "Meta Cloud API requires Phone Number ID and Access Token",
    };
  }

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", params.mimeType);
  form.append(
    "file",
    new Blob([new Uint8Array(params.buffer)], { type: params.mimeType }),
    params.filename
  );

  const res = await fetch(buildMetaUploadEndpoint(phoneNumberId, params.settings), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const bodyText = await res.text();

  if (!res.ok) {
    return {
      ok: false,
      error: `Media upload failed (${res.status}): ${bodyText.slice(0, 200)}`,
    };
  }

  let data: MetaUploadResponse;
  try {
    data = JSON.parse(bodyText) as MetaUploadResponse;
  } catch {
    return { ok: false, error: "Invalid Meta upload response" };
  }

  if (!data.id) {
    return { ok: false, error: "Media ID missing from Meta upload response" };
  }

  return { ok: true, mediaId: data.id };
}
