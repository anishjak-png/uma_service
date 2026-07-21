import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeMobile } from "@/lib/jobs";

export async function GET(request: NextRequest) {
  const mobile = normalizeMobile(request.nextUrl.searchParams.get("mobile") ?? "");

  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Valid mobile required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { mobile },
    include: {
      jobCards: {
        orderBy: { receivedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    name: customer.name,
    address: customer.address,
    mobile: customer.mobile,
    recentJobs: customer.jobCards,
  });
}
