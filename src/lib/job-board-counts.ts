import { prisma } from "@/lib/db";
import {
  ACTIVE_JOB_STATUSES,
  TECH_MY_BOARD_STATUSES,
  WARRANTY_JOB_STATUSES,
} from "@/lib/prisma-statuses";
import type { SessionData } from "@/lib/session";

export type JobBoardCounts = {
  active: number;
  outsourced: number;
  warranty: number;
};

export async function loadJobBoardCounts(
  session: SessionData,
  scope: string | null
): Promise<JobBoardCounts> {
  const technicianMyScope =
    session.role === "technician" &&
    Boolean(session.technicianId) &&
    scope !== "all";

  if (!technicianMyScope) {
    const groups = await prisma.jobCard.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const countOf = (statuses: readonly string[]) =>
      groups
        .filter((group) => statuses.includes(group.status))
        .reduce((sum, group) => sum + group._count.id, 0);

    return {
      active: countOf(ACTIVE_JOB_STATUSES),
      outsourced: countOf(["Outsourced"]),
      warranty: countOf(WARRANTY_JOB_STATUSES),
    };
  }

  const [active, extras] = await Promise.all([
    prisma.jobCard.count({
      where: {
        assignedTechnicianId: session.technicianId,
        status: { in: TECH_MY_BOARD_STATUSES },
      },
    }),
    prisma.jobCard.groupBy({
      by: ["status"],
      where: { status: { in: [...WARRANTY_JOB_STATUSES, "Outsourced"] } },
      _count: { id: true },
    }),
  ]);

  const extraOf = (status: string) =>
    extras.find((group) => group.status === status)?._count.id ?? 0;

  return {
    active,
    outsourced: extraOf("Outsourced"),
    warranty: WARRANTY_JOB_STATUSES.reduce(
      (sum, status) => sum + extraOf(status),
      0
    ),
  };
}
