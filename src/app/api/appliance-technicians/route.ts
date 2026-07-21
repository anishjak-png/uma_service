import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const mappings = await prisma.applianceTechnician.findMany({
    include: { technician: true },
    orderBy: { applianceType: "asc" },
  });

  return NextResponse.json(mappings);
}

export async function PUT(request: NextRequest) {
  const { applianceType, technicianId } = await request.json();

  if (!applianceType || !technicianId) {
    return NextResponse.json(
      { error: "applianceType and technicianId required" },
      { status: 400 }
    );
  }

  const mapping = await prisma.applianceTechnician.upsert({
    where: { applianceType },
    update: { technicianId },
    create: { applianceType, technicianId },
    include: { technician: true },
  });

  return NextResponse.json(mapping);
}
