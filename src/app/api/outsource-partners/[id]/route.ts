import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.outsourcePartner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const data: { name?: string; active?: boolean } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const conflict = await prisma.outsourcePartner.findFirst({
      where: { name, NOT: { id } },
    });
    if (conflict) {
      return NextResponse.json({ error: "Name already in use" }, { status: 409 });
    }
    data.name = name;
  }

  if (body.active !== undefined) {
    data.active = Boolean(body.active);
  }

  const updated = await prisma.outsourcePartner.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
