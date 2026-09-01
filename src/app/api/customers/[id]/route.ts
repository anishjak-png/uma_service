import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { normalizeMobile } from "@/lib/jobs";
import { syncWhatsAppConversationMobile } from "@/lib/customer-contact";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await requireStaff(["reception", "admin"]);
  if (!session) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
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
  const session = await requireStaff(["reception", "admin"]);
  if (!session) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const previousMobile = existing.mobile;

  if (body.allowWhatsappNotifications !== undefined) {
    data.allowWhatsappNotifications = Boolean(body.allowWhatsappNotifications);
  }

  const mobile = body.mobile ? normalizeMobile(body.mobile) : existing.mobile;
  if (body.mobile && mobile.length !== 10) {
    return NextResponse.json(
      { error: "Valid 10-digit mobile required" },
      { status: 400 }
    );
  }

  if (body.mobile && mobile !== existing.mobile) {
    const duplicate = await prisma.customer.findUnique({ where: { mobile } });
    if (duplicate) {
      return NextResponse.json(
        { error: "Mobile number already in use" },
        { status: 409 }
      );
    }
  }

  if (body.name !== undefined) {
    data.name = body.name?.trim() || null;
  }
  if (body.mobile !== undefined) {
    data.mobile = mobile;
  }
  if (body.address !== undefined) {
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Only admin can update address" },
        { status: 403 }
      );
    }
    data.address = body.address?.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const customer = await prisma.customer.update({
    where: { id },
    data,
  });

  if (typeof data.mobile === "string" && data.mobile !== previousMobile) {
    await syncWhatsAppConversationMobile(customer.id, previousMobile, data.mobile);
  }

  return NextResponse.json(customer);
}
