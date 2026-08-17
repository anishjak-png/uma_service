import { NextResponse } from "next/server";
import { asErrorMessage, jsonError, requireSparePartsAdmin } from "../lib/http";
import { removeReferenceImage, replaceReferenceImage } from "../lib/images";
import { getPart } from "../lib/parts";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  const { id, imageId } = await params;
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return jsonError("Image is required");
    await replaceReferenceImage(imageId, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ part: await getPart(id) });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  const { id, imageId } = await params;
  try {
    await removeReferenceImage(imageId);
    return NextResponse.json({ part: await getPart(id) });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
