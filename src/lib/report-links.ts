import type { ReportPeriod } from "@/lib/reports";

type ReportLinkParams = {
  status?: string;
  technicianId?: string;
  applianceType?: string;
  brand?: string;
  minAgeDays?: number;
  active?: boolean;
  receivedPeriod?: ReportPeriod;
  deliveredPeriod?: ReportPeriod;
  readyPeriod?: ReportPeriod;
  completedByTechnicianId?: string;
};

export function reportJobsHref(params: ReportLinkParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.technicianId) search.set("technicianId", params.technicianId);
  if (params.applianceType) search.set("applianceType", params.applianceType);
  if (params.brand) search.set("brand", params.brand);
  if (params.minAgeDays != null) search.set("minAgeDays", String(params.minAgeDays));
  if (params.active) search.set("active", "true");
  if (params.receivedPeriod) search.set("receivedPeriod", params.receivedPeriod);
  if (params.deliveredPeriod) search.set("deliveredPeriod", params.deliveredPeriod);
  if (params.readyPeriod) search.set("readyPeriod", params.readyPeriod);
  if (params.completedByTechnicianId) {
    search.set("completedByTechnicianId", params.completedByTechnicianId);
  }
  const qs = search.toString();
  return qs ? `/jobs/search?${qs}` : "/jobs/search";
}
