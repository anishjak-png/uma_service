import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, isValidMobile, normalizeMobile } from "@/lib/password";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.staffUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Staff user not found" }, { status: 404 });
  }

  const data: {
    name?: string;
    role?: "reception" | "technician" | "admin";
    active?: boolean;
    passwordHash?: string;
    mobile?: string;
    technicianId?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = name;
  }

  if (body.mobile !== undefined) {
    if (!isValidMobile(body.mobile)) {
      return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
    }
    const mobile = normalizeMobile(body.mobile);
    const conflict = await prisma.staffUser.findFirst({
      where: { mobile, NOT: { id } },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Mobile number already in use" },
        { status: 409 }
      );
    }
    data.mobile = mobile;
  }

  if (body.role !== undefined) {
    if (!["reception", "technician", "admin"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    data.role = body.role;
  }

  if (body.active !== undefined) {
    data.active = Boolean(body.active);
  }

  if (body.password !== undefined) {
    if (typeof body.password !== "string" || body.password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    data.passwordHash = await hashPassword(body.password);
  }

  const nextRole = data.role ?? existing.role;

  if (body.technicianId !== undefined || data.role === "technician") {
    const technicianId =
      nextRole === "technician"
        ? (body.technicianId ?? existing.technicianId)
        : null;

    if (nextRole === "technician" && !technicianId) {
      return NextResponse.json(
        { error: "Technician account must be linked to a technician" },
        { status: 400 }
      );
    }

    if (technicianId) {
      const tech = await prisma.technician.findUnique({
        where: { id: technicianId },
      });
      if (!tech) {
        return NextResponse.json({ error: "Technician not found" }, { status: 404 });
      }
      const conflict = await prisma.staffUser.findFirst({
        where: {
          technicianId,
          active: true,
          NOT: { id },
        },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "This technician already has an active staff account" },
          { status: 409 }
        );
      }
    }

    data.technicianId = technicianId;
  }

  const updated = await prisma.staffUser.update({
    where: { id },
    data,
    include: { technician: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    staff: {
      id: updated.id,
      mobile: updated.mobile,
      name: updated.name,
      role: updated.role,
      active: updated.active,
      technicianId: updated.technicianId,
      technicianName: updated.technician?.name ?? null,
    },
  });
}
