import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteApplianceOption, updateApplianceOption } from "@/lib/lookups";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await context.params;
  const { value } = await request.json();

  const result = await updateApplianceOption(id, value ?? "");
  if ("error" in result) {
    const status =
      result.error === "Appliance not found"
        ? 404
        : result.error === "Appliance name already exists"
          ? 409
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.option);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await deleteApplianceOption(id);

  if ("error" in result) {
    const status =
      result.error === "Appliance not found"
        ? 404
        : result.error?.startsWith("Cannot delete")
          ? 409
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
