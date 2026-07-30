import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const mappings = await prisma.applianceTechnician.findMany({
      include: { technician: true },
      orderBy: { applianceType: "asc" },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("GET /api/appliance-technicians failed:", error);
    return NextResponse.json(
      { error: "Failed to load appliance mappings. Check database connection." },
      { status: 503 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error("PUT /api/appliance-technicians failed:", error);
    return NextResponse.json(
      { error: "Failed to save appliance mapping. Check database connection." },
      { status: 503 }
    );
  }
}
