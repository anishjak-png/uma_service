import { NextResponse } from "next/server";
import type { ReferenceLimit } from "../constants";
import { embedImage } from "../lib/embedder";
import { asErrorMessage, jsonError, requireSparePartsAdmin } from "../lib/http";
import { matchSparePart } from "../lib/match";

export async function POST(request: Request) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  try {
    const form = await request.formData();
    const file = form.get("image");
    const limit = Number(form.get("reference_limit") ?? 3);
    const referenceLimit = ([1, 2, 3].includes(limit) ? limit : 3) as ReferenceLimit;
    if (!(file instanceof File)) return jsonError("Image is required");
    const { embedding } = await embedImage(Buffer.from(await file.arrayBuffer()));
    const result = await matchSparePart(embedding, referenceLimit);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
