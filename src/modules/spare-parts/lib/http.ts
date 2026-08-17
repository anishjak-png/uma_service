import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isSparePartsEnabled } from "../enabled";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireSparePartsAdmin() {
  if (!isSparePartsEnabled()) return jsonError("Spare parts billing is disabled", 404);
  const session = await requireAdmin();
  if (!session) return jsonError("Forbidden", 403);
  return null;
}

export function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message ?? "");
    const details =
      "details" in error && (error as { details?: unknown }).details
        ? String((error as { details: unknown }).details)
        : "";
    const text = `${message} ${details}`.trim();
    if (text.includes("duplicate") || text.includes("spa_spare_parts_code")) {
      return "That product code already exists.";
    }
    if (text) return text;
  }
  return "Unexpected error";
}
