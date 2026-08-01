import { JobStatusBadge } from "@/components/JobStatusBadge";
import { SHOP_NAME, SHOP_PHONE, STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import { prisma } from "@/lib/db";
import {
  formatMobileDisplay,
  jobNumberFromTrackingPath,
  parseAccessories,
} from "@/lib/jobs";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

type PageProps = { params: Promise<{ jobNumber: string }> };

function DetailRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0 last:pb-0 first:pt-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span
        className={`text-right text-sm ${emphasize ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}
      >
        {value}
      </span>
    </div>
  );
}

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

  const accessories = parseAccessories(job.accessories);
  const customerName = job.customer.name?.trim() || "Customer";
  const productLine = [job.brand, job.applianceType].filter(Boolean).join(" ");
  const statusLabel = STATUS_LABELS[job.status] ?? job.status;
  const showServiceAmount =
    (job.status === "Ready" || job.status === "Delivered") &&
    job.serviceAmount != null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-100">
      <header className="bg-emerald-800 px-4 py-5 text-center text-white shadow-sm">
        <h1 className="text-lg font-bold tracking-wide">{SHOP_NAME}</h1>
        <p className="mt-0.5 text-xs text-emerald-200">Service status</p>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4 pb-8">
        <Card className="overflow-hidden border-emerald-200 shadow-sm">
          <div className="bg-emerald-600 px-4 py-3 text-center text-white">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">
              Job card
            </p>
            <p className="mt-1 text-2xl font-bold">{job.jobNumber}</p>
            <div className="mt-2 flex justify-center">
              <JobStatusBadge status={job.status} />
            </div>
            <p className="mt-2 text-sm text-emerald-50">{statusLabel}</p>
          </div>
        </Card>

        {showServiceAmount && (
          <Card className="border-emerald-300 bg-emerald-50 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Service charges
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-900">
                {formatCurrency(job.serviceAmount)}
              </p>
              {job.status === "Ready" && (
                <p className="mt-2 text-sm text-emerald-800">
                  Your product is ready for pickup
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customer
            </h2>
            <DetailRow label="Name" value={customerName} emphasize />
            <DetailRow
              label="Mobile"
              value={formatMobileDisplay(job.customer.mobile)}
              emphasize
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Product
            </h2>
            <DetailRow label="Type" value={productLine || "—"} />
            {job.model?.trim() ? (
              <DetailRow label="Model" value={job.model.trim()} />
            ) : (
              <DetailRow label="Model" value="Not specified" />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Accessories received
            </h2>
            {accessories.length === 0 ? (
              <p className="text-sm text-slate-600">No accessories recorded</p>
            ) : (
              <ul className="space-y-2">
                {accessories.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-800">{item.name}</span>
                    <span className="text-slate-500">× {item.qty}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {SHOP_PHONE ? (
          <p className="text-center text-xs text-slate-500">
            Questions? Call {SHOP_PHONE}
          </p>
        ) : null}
      </main>
    </div>
  );
}
