import { APP_URL } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import type { NotificationSettingsDto, TemplateVariables } from "./types";

type JobForTemplate = {
  jobNumber: string;
  applianceType: string;
  brand: string;
  model?: string | null;
  complaint: string;
  serviceAmount?: number | null;
  customer: { name?: string | null; mobile: string };
};

export function buildProductName(job: JobForTemplate): string {
  return [job.brand, job.applianceType, job.model].filter(Boolean).join(" ");
}

export function buildTrackingLink(
  jobNumber: string,
  settings: NotificationSettingsDto
): string {
  if (!settings.trackingLinkEnabled) return "";
  return `${APP_URL}/j/${encodeURIComponent(jobNumber)}`;
}

export function buildTemplateVariables(
  job: JobForTemplate,
  settings: NotificationSettingsDto
): TemplateVariables {
  const trackingLink = buildTrackingLink(job.jobNumber, settings);

  return {
    customer_name: job.customer.name?.trim() || "Customer",
    job_number: job.jobNumber,
    product_name: buildProductName(job),
    complaint: job.complaint,
    service_amount: formatCurrency(job.serviceAmount),
    tracking_link: trackingLink,
  };
}

/** Strip empty tracking section when tracking link is disabled. */
export function cleanupRenderedMessage(message: string): string {
  return message
    .replace(/\nTrack your service request here:\n\n\nThank you\./g, "\nThank you.")
    .replace(/\nTrack your service request here:\n\nThank you\./g, "\nThank you.")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
