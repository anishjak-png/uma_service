import { prisma } from "./db";

export type LookupCategory = "appliance" | "brand" | "complaint";

export async function getLookupOptionsBatch(categories: LookupCategory[]) {
  const options = await prisma.lookupOption.findMany({
    where: { category: { in: categories } },
    orderBy: [{ category: "asc" }, { value: "asc" }],
  });

  const result: Record<LookupCategory, typeof options> = {
    appliance: [],
    brand: [],
    complaint: [],
  };

  for (const option of options) {
    const category = option.category as LookupCategory;
    if (categories.includes(category)) {
      result[category].push(option);
    }
  }

  return result;
}

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

export async function getBrandsForAppliance(applianceType: string) {
  const rows = await prisma.applianceBrand.findMany({
    where: { applianceType },
    orderBy: { brand: "asc" },
  });
  return rows.map((row) => row.brand);
}

export async function getComplaintsForAppliance(applianceType: string) {
  const rows = await prisma.applianceComplaint.findMany({
    where: { applianceType },
    orderBy: { complaint: "asc" },
  });
  return rows.map((row) => row.complaint);
}

export async function getAccessoriesForAppliance(applianceType: string) {
  const rows = await prisma.applianceAccessory.findMany({
    where: { applianceType },
    orderBy: { accessory: "asc" },
  });
  return rows.map((row) => row.accessory);
}

export async function getApplianceLookups(applianceType: string) {
  const [brands, complaints, accessories] = await Promise.all([
    getBrandsForAppliance(applianceType),
    getComplaintsForAppliance(applianceType),
    getAccessoriesForAppliance(applianceType),
  ]);
  return { brands, complaints, accessories };
}

export async function addApplianceBrand(applianceType: string, brand: string) {
  const trimmed = brand.trim();
  if (!trimmed) return { error: "Brand required" as const };

  await ensureLookupOption("brand", trimmed);

  const mapping = await prisma.applianceBrand.upsert({
    where: { applianceType_brand: { applianceType, brand: trimmed } },
    update: {},
    create: { applianceType, brand: trimmed },
  });

  return { mapping };
}

export async function addApplianceComplaint(
  applianceType: string,
  complaint: string
) {
  const trimmed = complaint.trim();
  if (!trimmed) return { error: "Complaint required" as const };

  await ensureLookupOption("complaint", trimmed);

  const mapping = await prisma.applianceComplaint.upsert({
    where: {
      applianceType_complaint: { applianceType, complaint: trimmed },
    },
    update: {},
    create: { applianceType, complaint: trimmed },
  });

  return { mapping };
}

export async function addApplianceAccessory(
  applianceType: string,
  accessory: string
) {
  const trimmed = accessory.trim();
  if (!trimmed) return { error: "Accessory required" as const };

  const mapping = await prisma.applianceAccessory.upsert({
    where: {
      applianceType_accessory: { applianceType, accessory: trimmed },
    },
    update: {},
    create: { applianceType, accessory: trimmed },
  });

  return { mapping };
}

export async function removeApplianceAccessory(
  applianceType: string,
  accessory: string
) {
  const trimmed = accessory.trim();
  if (!trimmed) return { error: "Accessory required" as const };

  await prisma.applianceAccessory.deleteMany({
    where: { applianceType, accessory: trimmed },
  });

  return { ok: true as const };
}

export async function removeApplianceBrand(applianceType: string, brand: string) {
  const trimmed = brand.trim();
  if (!trimmed) return { error: "Brand required" as const };

  await prisma.applianceBrand.deleteMany({
    where: { applianceType, brand: trimmed },
  });

  return { ok: true as const };
}

export async function removeApplianceComplaint(
  applianceType: string,
  complaint: string
) {
  const trimmed = complaint.trim();
  if (!trimmed) return { error: "Complaint required" as const };

  await prisma.applianceComplaint.deleteMany({
    where: { applianceType, complaint: trimmed },
  });

  return { ok: true as const };
}

export async function ensureApplianceLookupOption(
  category: "brand" | "complaint",
  value: string,
  applianceType: string
) {
  const trimmed = value.trim();
  if (!trimmed || !applianceType.trim()) return null;

  await ensureLookupOption(category, trimmed);

  if (category === "brand") {
    await prisma.applianceBrand.upsert({
      where: {
        applianceType_brand: { applianceType, brand: trimmed },
      },
      update: {},
      create: { applianceType, brand: trimmed },
    });
  } else {
    await prisma.applianceComplaint.upsert({
      where: {
        applianceType_complaint: { applianceType, complaint: trimmed },
      },
      update: {},
      create: { applianceType, complaint: trimmed },
    });
  }

  return trimmed;
}

export async function isBrandAllowedForAppliance(
  applianceType: string,
  brand: string
) {
  const mapping = await prisma.applianceBrand.findUnique({
    where: {
      applianceType_brand: { applianceType, brand: brand.trim() },
    },
  });
  return Boolean(mapping);
}

export async function isComplaintAllowedForAppliance(
  applianceType: string,
  complaint: string
) {
  const mapping = await prisma.applianceComplaint.findUnique({
    where: {
      applianceType_complaint: { applianceType, complaint: complaint.trim() },
    },
  });
  return Boolean(mapping);
}

export async function isAccessoryAllowedForAppliance(
  applianceType: string,
  accessory: string
) {
  const trimmed = accessory.trim();
  if (trimmed.startsWith("Other:")) return true;
  const mapping = await prisma.applianceAccessory.findUnique({
    where: {
      applianceType_accessory: { applianceType, accessory: trimmed },
    },
  });
  return Boolean(mapping);
}

export async function validateAccessoriesForAppliance(
  applianceType: string,
  accessories: string[]
) {
  for (const accessory of accessories) {
    if (!(await isAccessoryAllowedForAppliance(applianceType, accessory))) {
      return false;
    }
  }
  return true;
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

    await tx.applianceBrand.updateMany({
      where: { applianceType: oldValue },
      data: { applianceType: trimmed },
    });

    await tx.applianceComplaint.updateMany({
      where: { applianceType: oldValue },
      data: { applianceType: trimmed },
    });

    await tx.applianceAccessory.updateMany({
      where: { applianceType: oldValue },
      data: { applianceType: trimmed },
    });

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
      status: { in: ["Pending", "WaitingForCustomerApproval", "Outsourced", "Ready", "Return"] },
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
    prisma.applianceBrand.deleteMany({
      where: { applianceType: existing.value },
    }),
    prisma.applianceComplaint.deleteMany({
      where: { applianceType: existing.value },
    }),
    prisma.applianceAccessory.deleteMany({
      where: { applianceType: existing.value },
    }),
    prisma.lookupOption.delete({ where: { id } }),
  ]);

  return { ok: true as const };
}
