import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const technicians = await prisma.technician.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        applianceMappings: true,
      },
    });

    return NextResponse.json(technicians);
  } catch (error) {
    console.error("GET /api/technicians failed:", error);
    return NextResponse.json(
      { error: "Failed to load technicians. Check database connection." },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error("POST /api/technicians failed:", error);
    return NextResponse.json(
      { error: "Failed to save technician. Check database connection." },
      { status: 503 }
    );
  }
}
