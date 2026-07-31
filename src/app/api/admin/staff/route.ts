import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  hashPassword,
  isValidMobile,
  normalizeMobile,
} from "@/lib/password";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await prisma.staffUser.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: {
      technician: { select: { id: true, name: true } },
      _count: { select: { devices: true } },
    },
  });

  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      mobile: s.mobile,
      name: s.name,
      role: s.role,
      active: s.active,
      technicianId: s.technicianId,
      technicianName: s.technician?.name ?? null,
      deviceCount: s._count.devices,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const mobileRaw = body.mobile;
  const name = body.name?.trim();
  const role = body.role;
  const password = body.password;
  const technicianId = body.technicianId ?? null;

  if (!mobileRaw || !name || !role || !password) {
    return NextResponse.json(
      { error: "Mobile, name, role, and password are required" },
      { status: 400 }
    );
  }

  if (!isValidMobile(mobileRaw)) {
    return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
  }

  if (!["reception", "technician", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  if (role === "technician" && !technicianId) {
    return NextResponse.json(
      { error: "Technician account must be linked to a technician" },
      { status: 400 }
    );
  }

  if (role !== "technician" && technicianId) {
    return NextResponse.json(
      { error: "Only technician role can have a technician link" },
      { status: 400 }
    );
  }

  if (technicianId) {
    const tech = await prisma.technician.findUnique({ where: { id: technicianId } });
    if (!tech) {
      return NextResponse.json({ error: "Technician not found" }, { status: 404 });
    }
    const existingLink = await prisma.staffUser.findFirst({
      where: { technicianId, active: true },
    });
    if (existingLink) {
      return NextResponse.json(
        { error: "This technician already has an active staff account" },
        { status: 409 }
      );
    }
  }

  const mobile = normalizeMobile(mobileRaw);
  const existing = await prisma.staffUser.findUnique({ where: { mobile } });
  if (existing) {
    return NextResponse.json(
      { error: "Mobile number already registered" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const staffUser = await prisma.staffUser.create({
    data: {
      mobile,
      name,
      role,
      passwordHash,
      technicianId: role === "technician" ? technicianId : null,
    },
    include: { technician: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    staff: {
      id: staffUser.id,
      mobile: staffUser.mobile,
      name: staffUser.name,
      role: staffUser.role,
      active: staffUser.active,
      technicianId: staffUser.technicianId,
      technicianName: staffUser.technician?.name ?? null,
    },
  });
}
