import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeMobile } from "@/lib/jobs";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const where = q
    ? {
        OR: [
          { mobile: { contains: normalizeMobile(q) } },
          { name: { contains: q } },
        ],
      }
    : {};

  const customers = await prisma.customer.findMany({
    where,
    include: { _count: { select: { jobCards: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      address: c.address,
      allowWhatsappNotifications: c.allowWhatsappNotifications,
      jobCount: c._count.jobCards,
      updatedAt: c.updatedAt,
    }))
  );
}
