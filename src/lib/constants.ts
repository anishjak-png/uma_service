export const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Uma Traders";
export const SHOP_PHONE = process.env.NEXT_PUBLIC_SHOP_PHONE ?? "";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const APPLIANCE_TYPES = [
  "TV",
  "AC",
  "Refrigerator",
  "Washing Machine",
  "Microwave",
  "Water Heater",
  "Mixer Grinder",
  "Iron",
  "Other",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  Received: "Received",
  Diagnosing: "Diagnosing",
  InRepair: "In Repair",
  Ready: "Ready for Pickup",
  Delivered: "Delivered",
  Closed: "Closed",
};

export const ACTIVE_STATUSES = ["Received", "Diagnosing", "InRepair", "Ready"] as const;

export const STATUS_FLOW: Record<string, string[]> = {
  Received: ["Diagnosing", "InRepair", "Ready"],
  Diagnosing: ["InRepair", "Ready"],
  InRepair: ["Ready", "Diagnosing"],
  Ready: ["Delivered"],
  Delivered: ["Closed"],
};
