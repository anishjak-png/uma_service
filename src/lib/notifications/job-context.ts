import { getAppUrl } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import { toTrackingPathSlug } from "@/lib/jobs";
import type {
  NotificationJobContext,
  NotificationJobProduct,
  NotificationSettingsDto,
  TemplateVariables,
} from "./types";

export function buildProductName(job: NotificationJobProduct): string {
  return [job.brand, job.applianceType, job.model].filter(Boolean).join(" ");
}

export function buildTrackingLink(
  jobNumber: string,
  settings: NotificationSettingsDto
): string {
  if (!settings.trackingLinkEnabled) return "";
  const baseUrl = getAppUrl();
  return `${baseUrl}/j/${toTrackingPathSlug(jobNumber)}`;
}

export function buildTemplateVariables(
  job: NotificationJobContext,
  settings: NotificationSettingsDto
): TemplateVariables {
  const trackingLink = buildTrackingLink(job.jobNumber, settings);

  return {
    customer_name: job.customer.name?.trim() || "Customer",
    job_number: job.jobNumber,
    product_name: buildProductName(job),
    complaint: job.complaint?.trim() ?? "",
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
