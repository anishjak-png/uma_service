import { NextRequest, NextResponse } from "next/server";
import {
  addApplianceBrand,
  addApplianceComplaint,
  ensureLookupOption,
  getLookupOptions,
  getLookupOptionsBatch,
  LookupCategory,
} from "@/lib/lookups";

const VALID_CATEGORIES = new Set<LookupCategory>(["appliance", "brand", "complaint"]);

function parseCategories(raw: string | null): LookupCategory[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is LookupCategory => VALID_CATEGORIES.has(c as LookupCategory));
}

export async function GET(request: NextRequest) {
  const batchCategories = parseCategories(request.nextUrl.searchParams.get("categories"));

  if (batchCategories.length > 0) {
    const options = await getLookupOptionsBatch(batchCategories);
    return NextResponse.json(options);
  }

  const category = request.nextUrl.searchParams.get("category") as LookupCategory;

  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Valid category required" }, { status: 400 });
  }

  const options = await getLookupOptions(category);
  return NextResponse.json(options);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const category = body.category as LookupCategory;
  const value = body.value as string;
  const applianceType = body.applianceType as string | undefined;

  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Valid category required" }, { status: 400 });
  }

  if (!value?.trim()) {
    return NextResponse.json({ error: "Value required" }, { status: 400 });
  }

  const option = await ensureLookupOption(category, value);

  if (
    applianceType?.trim() &&
    (category === "brand" || category === "complaint")
  ) {
    const mappingResult =
      category === "brand"
        ? await addApplianceBrand(applianceType, value)
        : await addApplianceComplaint(applianceType, value);

    if ("error" in mappingResult) {
      return NextResponse.json({ error: mappingResult.error }, { status: 400 });
    }
  }

  return NextResponse.json(option, { status: 201 });
}
