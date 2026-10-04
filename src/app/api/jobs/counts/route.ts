import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  ACTIVE_JOB_STATUSES,
  TECH_MY_BOARD_STATUSES,
  WARRANTY_JOB_STATUSES,
} from "@/lib/prisma-statuses";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = request.nextUrl.searchParams.get("scope");
  const technicianMyScope =
    session.role === "technician" &&
    Boolean(session.technicianId) &&
    scope !== "all";

  const assigned =
    technicianMyScope && session.technicianId
      ? { assignedTechnicianId: session.technicianId }
      : {};

  const [active, outsourced, warranty] = await Promise.all([
    prisma.jobCard.count({
      where: {
        ...assigned,
        status: {
          in: technicianMyScope ? TECH_MY_BOARD_STATUSES : ACTIVE_JOB_STATUSES,
        },
      },
    }),
    prisma.jobCard.count({
      where: { status: "Outsourced" },
    }),
    prisma.jobCard.count({
      where: { status: { in: WARRANTY_JOB_STATUSES } },
    }),
  ]);

  return NextResponse.json({ active, outsourced, warranty });
}
