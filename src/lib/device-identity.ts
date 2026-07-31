"use client";

const STORAGE_KEY = "uma_device_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function getDeviceIdentity(): Promise<{
  deviceId: string;
  deviceLabel: string;
  platform: "android" | "web";
}> {
  if (typeof window === "undefined") {
    return { deviceId: "server", deviceLabel: "Unknown", platform: "web" };
  }

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Device } = await import("@capacitor/device");
      const info = await Device.getId();
      const details = await Device.getInfo();
      const label = [details.manufacturer, details.model]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        deviceId: info.identifier,
        deviceLabel: label || details.model || "Android device",
        platform: "android",
      };
    }
  } catch {
    // Fall through to web storage ID
  }

  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    deviceId = randomId();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }

  const ua = navigator.userAgent;
  const browser = ua.includes("Chrome")
    ? "Chrome"
    : ua.includes("Firefox")
      ? "Firefox"
      : ua.includes("Safari")
        ? "Safari"
        : "Browser";

  return {
    deviceId,
    deviceLabel: `${browser} on ${navigator.platform || "Web"}`,
    platform: "web",
  };
}
