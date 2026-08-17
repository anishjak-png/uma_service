import { NextResponse } from "next/server";
import { asErrorMessage, jsonError, requireSparePartsAdmin } from "../lib/http";
import { deletePart, getPart, updatePart } from "../lib/parts";
import { deleteObject } from "../lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    const part = await getPart(id);
    if (!part) return jsonError("Part not found", 404);
    return NextResponse.json({ part });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    const body = (await request.json()) as {
      name?: string;
      code?: string;
      category?: string;
      brand?: string;
      selling_price?: number;
    };
    const name = body.name?.trim() ?? "";
    const code = body.code?.trim() ?? "";
    if (!name || !code) return jsonError("Name and code are required");
    const part = await updatePart(id, {
      name,
      code,
      category: body.category?.trim() ?? "",
      brand: body.brand?.trim() ?? "",
      selling_price: Number(body.selling_price ?? 0) || 0,
    });
    return NextResponse.json({ part });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    const part = await getPart(id);
    if (!part) return jsonError("Part not found", 404);
    for (const image of part.images) {
      await deleteObject(image.storage_path).catch(() => undefined);
    }
    await deletePart(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
