import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const technicians = await prisma.technician.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      applianceMappings: true,
    },
  });

  return NextResponse.json(technicians);
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const technician = await prisma.technician.upsert({
    where: { name: name.trim() },
    update: { active: true },
    create: { name: name.trim() },
  });

  return NextResponse.json(technician, { status: 201 });
}
