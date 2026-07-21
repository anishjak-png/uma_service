import { NextRequest, NextResponse } from "next/server";
import { ensureLookupOption, getLookupOptions, LookupCategory } from "@/lib/lookups";

const VALID_CATEGORIES = new Set<LookupCategory>(["appliance", "brand", "complaint"]);

export async function GET(request: NextRequest) {
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

  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Valid category required" }, { status: 400 });
  }

  if (!value?.trim()) {
    return NextResponse.json({ error: "Value required" }, { status: 400 });
  }

  const option = await ensureLookupOption(category, value);
  return NextResponse.json(option, { status: 201 });
}
