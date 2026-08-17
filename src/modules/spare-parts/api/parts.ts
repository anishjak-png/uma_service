import { NextResponse } from "next/server";
import { asErrorMessage, jsonError, requireSparePartsAdmin } from "../lib/http";
import { addReferenceImage } from "../lib/images";
import { createPart, listParts } from "../lib/parts";

export async function GET(request: Request) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  try {
    const parts = await listParts(searchParams.get("q") ?? "");
    return NextResponse.json({ parts });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const code = String(form.get("code") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const brand = String(form.get("brand") ?? "").trim();
    const sellingPrice = Number(form.get("selling_price") ?? 0);
    const files = form
      .getAll("images")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (!name || !code) return jsonError("Name and code are required");
    if (files.length < 1) return jsonError("Add at least one reference photo");
    if (files.length > 3) return jsonError("At most 3 reference photos");

    const part = await createPart({
      name,
      code,
      category,
      brand,
      selling_price: Number.isFinite(sellingPrice) ? sellingPrice : 0,
    });

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await addReferenceImage(part.id, buffer);
    }

    return NextResponse.json({ part }, { status: 201 });
  } catch (error) {
    console.error("Create spare part failed:", error);
    return jsonError(asErrorMessage(error), 500);
  }
}
