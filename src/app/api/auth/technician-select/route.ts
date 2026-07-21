import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session.isLoggedIn || session.role !== "technician") {
    return NextResponse.json({ error: "Technician login required" }, { status: 403 });
  }

  const { technicianId } = await request.json();

  const technician = await prisma.technician.findUnique({
    where: { id: technicianId, active: true },
  });

  if (!technician) {
    return NextResponse.json({ error: "Technician not found" }, { status: 404 });
  }

  session.technicianId = technician.id;
  session.technicianName = technician.name;
  await session.save();

  return NextResponse.json({
    technicianId: technician.id,
    technicianName: technician.name,
  });
}
