import { NextResponse } from "next/server";
import { asErrorMessage, jsonError, requireSparePartsAdmin } from "../lib/http";
import { addReferenceImage } from "../lib/images";
import { getPart } from "../lib/parts";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    const part = await getPart(id);
    if (!part) return jsonError("Part not found", 404);
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return jsonError("Image is required");
    await addReferenceImage(id, Buffer.from(await file.arrayBuffer()));
    const updated = await getPart(id);
    return NextResponse.json({ part: updated });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
