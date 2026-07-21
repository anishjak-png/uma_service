import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeMobile } from "@/lib/jobs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await context.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { jobCards: true } } },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...customer,
    jobCount: customer._count.jobCards,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const mobile = body.mobile ? normalizeMobile(body.mobile) : existing.mobile;
  if (body.mobile && mobile.length !== 10) {
    return NextResponse.json(
      { error: "Valid 10-digit mobile required" },
      { status: 400 }
    );
  }

  if (mobile !== existing.mobile) {
    const duplicate = await prisma.customer.findUnique({ where: { mobile } });
    if (duplicate) {
      return NextResponse.json(
        { error: "Mobile number already in use" },
        { status: 409 }
      );
    }
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: body.name !== undefined ? body.name?.trim() || null : undefined,
      mobile: body.mobile !== undefined ? mobile : undefined,
      address:
        body.address !== undefined ? body.address?.trim() || null : undefined,
    },
  });

  return NextResponse.json(customer);
}
