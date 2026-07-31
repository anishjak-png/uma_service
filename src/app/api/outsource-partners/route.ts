import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireStaff(["reception", "technician", "admin"]);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const partners = await prisma.outsourcePartner.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });

  return NextResponse.json(partners);
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await request.json();
  const trimmed = String(name ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const partner = await prisma.outsourcePartner.upsert({
    where: { name: trimmed },
    update: { active: true },
    create: { name: trimmed },
  });

  return NextResponse.json(partner, { status: 201 });
}
