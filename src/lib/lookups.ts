import { prisma } from "./db";

export type LookupCategory = "appliance" | "brand" | "complaint";

export async function getLookupOptions(category: LookupCategory) {
  return prisma.lookupOption.findMany({
    where: { category },
    orderBy: { value: "asc" },
  });
}

export async function ensureLookupOption(category: LookupCategory, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  return prisma.lookupOption.upsert({
    where: { category_value: { category, value: trimmed } },
    update: {},
    create: { category, value: trimmed },
  });
}

export async function getDefaultTechnicianForAppliance(applianceType: string) {
  const mapping = await prisma.applianceTechnician.findUnique({
    where: { applianceType },
    include: { technician: true },
  });
  return mapping?.technician ?? null;
}
