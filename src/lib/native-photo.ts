"use client";

import { Capacitor } from "@capacitor/core";

/** True when running inside the Capacitor Android (or iOS) shell. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);/.exec(header ?? "");
  const mime = mimeMatch?.[1] || "image/jpeg";
  const binary = atob(data ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

/**
 * Opens the native camera/gallery prompt on Android APK.
 * Returns null if cancelled or not on native.
 */
export async function pickNativePhoto(_options?: {
  preferCamera?: boolean;
}): Promise<File | null> {
  if (!isNativeApp()) return null;

  const { Camera, CameraResultType, CameraSource } = await import(
    "@capacitor/camera"
  );

  const photo = await Camera.getPhoto({
    quality: 85,
    width: 1600,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    // Prompt shows Camera + Gallery on Android (HTML file input often skips camera).
    source: CameraSource.Prompt,
    saveToGallery: false,
  });

  if (!photo.dataUrl) return null;

  const ext = photo.format === "png" ? "png" : "jpg";
  return dataUrlToFile(photo.dataUrl, `photo-${Date.now()}.${ext}`);
}

export function isPhotoPickerCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String(
    (error as { message?: string }).message ?? error
  ).toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("cancelled") ||
    message.includes("canceled") ||
    message.includes("user denied") ||
    message.includes("no image")
  );
}
