import { JobStatusBadge } from "@/components/JobStatusBadge";
import { SHOP_NAME, SHOP_PHONE, STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMobileDisplay } from "@/lib/jobs";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ jobNumber: string }> };

export default async function PublicStatusPage({ params }: PageProps) {
  const { jobNumber } = await params;

  const job = await prisma.jobCard.findUnique({
    where: { jobNumber: jobNumber.toUpperCase() },
    include: { customer: true },
  });

  if (!job) {
    notFound();
  }

  const showCost =
    job.status === "Ready" ||
    job.status === "Delivered" ||
    job.status === "Closed";

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-orange-600 px-4 py-6 text-center text-white">
        <h1 className="text-xl font-bold">{SHOP_NAME}</h1>
        <p className="text-sm text-orange-100">Service Status</p>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
          <p className="text-sm text-gray-500">Job Number</p>
          <p className="text-2xl font-bold text-gray-900">{job.jobNumber}</p>
          <div className="mt-3 flex justify-center">
            <JobStatusBadge status={job.status} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Appliance</span>
            <span className="font-medium text-gray-900">
              {[job.brand, job.model, job.applianceType].filter(Boolean).join(" ")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Received</span>
            <span className="font-medium text-gray-900">
              {job.receivedAt.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className="font-medium text-gray-900">
              {STATUS_LABELS[job.status]}
            </span>
          </div>
          {showCost && job.finalCost != null && (
            <div className="flex justify-between border-t pt-3">
              <span className="text-gray-500">Repair Cost</span>
              <span className="text-lg font-bold text-green-700">Rs {job.finalCost}</span>
            </div>
          )}
        </div>

        {job.status === "Ready" && (
          <div className="rounded-2xl bg-green-50 p-4 text-center text-green-800">
            <p className="font-semibold">Your product is ready for pickup!</p>
            <p className="mt-1 text-sm">Please visit our shop to collect.</p>
          </div>
        )}

        {SHOP_PHONE && (
          <a
            href={`tel:${SHOP_PHONE}`}
            className="block rounded-xl bg-orange-600 py-4 text-center text-lg font-semibold text-white hover:bg-orange-700"
          >
            Call {formatMobileDisplay(SHOP_PHONE)}
          </a>
        )}
      </div>
    </div>
  );
}
