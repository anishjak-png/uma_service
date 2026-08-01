import { JobStatusBadge } from "@/components/JobStatusBadge";
import { SHOP_NAME, STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jobNumberFromTrackingPath } from "@/lib/jobs";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

type PageProps = { params: Promise<{ jobNumber: string }> };

export default async function PublicStatusPage({ params }: PageProps) {
  const { jobNumber: pathSegment } = await params;
  const normalizedJobNumber = jobNumberFromTrackingPath(pathSegment);

  const job = await prisma.jobCard.findFirst({
    where: {
      jobNumber: { equals: normalizedJobNumber, mode: "insensitive" },
    },
    include: { customer: true },
  });

  if (!job) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-emerald-900 px-4 py-6 text-center text-white">
        <h1 className="text-lg font-bold">{SHOP_NAME}</h1>
        <p className="text-xs text-emerald-200">Service Status</p>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-slate-500">UT Number</p>
            <p className="text-2xl font-bold text-slate-900">{job.jobNumber}</p>
            <div className="mt-3 flex justify-center">
              <JobStatusBadge status={job.status} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Product</span>
              <span className="font-medium text-slate-900">
                {[job.brand, job.applianceType, job.model].filter(Boolean).join(" ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="font-medium text-slate-900">
                {STATUS_LABELS[job.status] ?? job.status}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
