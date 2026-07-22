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

export async function updateApplianceOption(id: string, newValue: string) {
  const trimmed = newValue.trim();
  if (!trimmed) return { error: "Value required" as const };

  const existing = await prisma.lookupOption.findUnique({ where: { id } });
  if (!existing || existing.category !== "appliance") {
    return { error: "Appliance not found" as const };
  }

  if (existing.value === trimmed) {
    return { option: existing };
  }

  const duplicate = await prisma.lookupOption.findUnique({
    where: { category_value: { category: "appliance", value: trimmed } },
  });
  if (duplicate) {
    return { error: "Appliance name already exists" as const };
  }

  const oldValue = existing.value;

  const option = await prisma.$transaction(async (tx) => {
    await tx.jobCard.updateMany({
      where: { applianceType: oldValue },
      data: { applianceType: trimmed },
    });

    const mapping = await tx.applianceTechnician.findUnique({
      where: { applianceType: oldValue },
    });
    if (mapping) {
      await tx.applianceTechnician.delete({ where: { applianceType: oldValue } });
      await tx.applianceTechnician.create({
        data: { applianceType: trimmed, technicianId: mapping.technicianId },
      });
    }

    return tx.lookupOption.update({
      where: { id },
      data: { value: trimmed },
    });
  });

  return { option };
}

export async function deleteApplianceOption(id: string) {
  const existing = await prisma.lookupOption.findUnique({ where: { id } });
  if (!existing || existing.category !== "appliance") {
    return { error: "Appliance not found" as const };
  }

  const activeJobs = await prisma.jobCard.count({
    where: {
      applianceType: existing.value,
      status: { in: ["Pending", "WaitingForCustomerApproval", "Ready", "Return"] },
    },
  });

  if (activeJobs > 0) {
    return {
      error: `Cannot delete — ${activeJobs} active job(s) use this appliance`,
    } as const;
  }

  await prisma.$transaction([
    prisma.applianceTechnician.deleteMany({
      where: { applianceType: existing.value },
    }),
    prisma.lookupOption.delete({ where: { id } }),
  ]);

  return { ok: true as const };
}
