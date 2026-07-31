import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeMobile } from "../src/lib/password";

const prisma = new PrismaClient();

/** Only these product types appear when creating jobs. */
export const APPLIANCES = [
  "Cooker",
  "Mixie",
  "Gas Stove",
  "Iron Box",
  "Kettle",
  "Microwave",
  "Table Top Grinder",
  "Sewing Machine",
  "Water Heater",
  "Induction Stove",
  "Pedestal Fan",
  "Table Fan",
  "Ceiling Fan",
  "Mosquito Bat",
];

const BRANDS = [
  "Prestige",
  "Anantha",
  "Mithra",
  "Hawkins",
  "Ideal",
  "Pigeon",
  "Lakshmi",
  "Crompton",
  "Remi",
  "Polar",
  "TN",
  "Surya",
  "Butterfly",
  "Preethi",
  "Dekuk",
  "Vidiem",
  "Vguard",
  "Philips",
  "Bajaj",
  "Samsung",
  "LG",
  "Merrit",
  "Usha",
  "Singer",
  "Amirtha",
  "Sowbagya",
  "Hunter",
  "Others",
];

const COMPLAINTS = [
  "Not powering on",
  "Not heating",
  "Strange noise",
  "Water leakage",
  "Switch/cord issue",
  "General service",
  "Other",
];

const TECHNICIANS = ["Jeeva", "Kaja", "Prasanth", "Sameer", "Vijay"];

const OUTSOURCE_PARTNERS = ["Hanuram", "Perumal", "Balaji"];

const APPLIANCE_ACCESSORIES: Record<string, string[]> = {
  Mixie: ["Jars", "Lid", "Coupler"],
  "Gas Stove": ["Burner", "Pan support", "Knobs"],
  Cooker: ["Gasket", "Weight", "Inner pot"],
  "Sewing Machine": ["Bobbin case", "Foot pedal", "Power cord"],
  "Table Top Grinder": ["Grinding stone", "Lid", "Lock clip"],
};

const APPLIANCE_ROUTING: Record<string, string> = {
  Mixie: "Prasanth",
  "Gas Stove": "Jeeva",
  "Iron Box": "Jeeva",
  Kettle: "Prasanth",
  "Table Top Grinder": "Vijay",
  "Sewing Machine": "Sameer",
  "Induction Stove": "Kaja",
  "Pedestal Fan": "Sameer",
  "Table Fan": "Sameer",
  "Ceiling Fan": "Sameer",
  "Mosquito Bat": "Kaja",
};

const APPLIANCE_BRANDS: Record<string, string[]> = {
  Cooker: [
    "Prestige",
    "Anantha",
    "Mithra",
    "Hawkins",
    "Ideal",
    "Pigeon",
    "Lakshmi",
    "Others",
  ],
  Mixie: ["Preethi", "Prestige", "Butterfly", "Philips", "Others"],
  "Gas Stove": [
    "Surya",
    "Butterfly",
    "Preethi",
    "Dekuk",
    "Vidiem",
    "Prestige",
    "Others",
  ],
  "Iron Box": ["Preethi", "Bajaj", "Philips", "Crompton", "Others"],
  Kettle: ["Prestige", "Remi", "Preethi", "Pigeon", "Others"],
  Microwave: ["Bajaj", "Samsung", "LG", "Others"],
  "Table Top Grinder": ["Amirtha", "Sowbagya", "Lakshmi", "TN", "Others"],
  "Sewing Machine": ["Merrit", "Usha", "Singer", "Others"],
  "Water Heater": ["Vguard", "Bajaj", "Crompton", "Others"],
  "Induction Stove": ["Prestige", "Vguard", "Pigeon", "Philips", "Preethi", "Others"],
  "Pedestal Fan": ["Crompton", "Remi", "Polar", "Others"],
  "Table Fan": ["Crompton", "Remi", "Polar", "TN", "Others"],
  "Ceiling Fan": ["Crompton", "Remi", "Polar", "Others"],
  "Mosquito Bat": ["Hunter", "Others"],
};

const APPLIANCE_COMPLAINTS: Record<string, string[]> = {
  Cooker: ["Not powering on", "Not heating", "Water leakage", "General service", "Other"],
  Mixie: ["Not powering on", "Strange noise", "General service", "Other"],
  "Gas Stove": ["Not powering on", "Not heating", "General service", "Other"],
  "Iron Box": ["Not powering on", "Not heating", "General service", "Other"],
  Kettle: ["Not powering on", "Not heating", "Water leakage", "General service", "Other"],
  Microwave: ["Not powering on", "Not heating", "Strange noise", "General service", "Other"],
  "Table Top Grinder": ["Not powering on", "Strange noise", "General service", "Other"],
  "Sewing Machine": ["Not powering on", "Strange noise", "General service", "Other"],
  "Water Heater": ["Not powering on", "Not heating", "Water leakage", "General service", "Other"],
  "Induction Stove": ["Not powering on", "Not heating", "General service", "Other"],
  "Pedestal Fan": ["Not powering on", "Strange noise", "General service", "Other"],
  "Table Fan": ["Not powering on", "Strange noise", "General service", "Other"],
  "Ceiling Fan": ["Not powering on", "Strange noise", "General service", "Other"],
  "Mosquito Bat": ["Not powering on", "General service", "Other"],
};

async function seedLookups(category: string, values: string[]) {
  for (const value of values) {
    await prisma.lookupOption.upsert({
      where: { category_value: { category, value } },
      update: {},
      create: { category, value },
    });
  }
}

async function pruneRemovedAppliances() {
  const allowed = new Set(APPLIANCES);
  const existing = await prisma.lookupOption.findMany({
    where: { category: "appliance" },
  });

  for (const option of existing) {
    if (allowed.has(option.value)) continue;

    await prisma.applianceTechnician.deleteMany({
      where: { applianceType: option.value },
    });
    await prisma.applianceBrand.deleteMany({
      where: { applianceType: option.value },
    });
    await prisma.applianceComplaint.deleteMany({
      where: { applianceType: option.value },
    });
    await prisma.applianceAccessory.deleteMany({
      where: { applianceType: option.value },
    });
    await prisma.lookupOption.delete({ where: { id: option.id } });
  }

  // Drop orphaned mappings if appliance lookup was removed earlier
  for (const row of await prisma.applianceTechnician.findMany()) {
    if (!allowed.has(row.applianceType)) {
      await prisma.applianceTechnician.delete({ where: { id: row.id } });
    }
  }
  for (const row of await prisma.applianceBrand.findMany()) {
    if (!allowed.has(row.applianceType)) {
      await prisma.applianceBrand.delete({ where: { id: row.id } });
    }
  }
  for (const row of await prisma.applianceComplaint.findMany()) {
    if (!allowed.has(row.applianceType)) {
      await prisma.applianceComplaint.delete({ where: { id: row.id } });
    }
  }
  for (const row of await prisma.applianceAccessory.findMany()) {
    if (!allowed.has(row.applianceType)) {
      await prisma.applianceAccessory.delete({ where: { id: row.id } });
    }
  }
}

async function seedApplianceLookups() {
  const allowed = new Set(APPLIANCES);

  for (const [applianceType, brands] of Object.entries(APPLIANCE_BRANDS)) {
    if (!allowed.has(applianceType)) continue;
    for (const brand of brands) {
      await prisma.applianceBrand.upsert({
        where: { applianceType_brand: { applianceType, brand } },
        update: {},
        create: { applianceType, brand },
      });
    }
  }

  for (const [applianceType, complaints] of Object.entries(APPLIANCE_COMPLAINTS)) {
    if (!allowed.has(applianceType)) continue;
    for (const complaint of complaints) {
      await prisma.applianceComplaint.upsert({
        where: { applianceType_complaint: { applianceType, complaint } },
        update: {},
        create: { applianceType, complaint },
      });
    }
  }

  for (const [applianceType, accessories] of Object.entries(APPLIANCE_ACCESSORIES)) {
    if (!allowed.has(applianceType)) continue;
    for (const accessory of accessories) {
      await prisma.applianceAccessory.upsert({
        where: { applianceType_accessory: { applianceType, accessory } },
        update: {},
        create: { applianceType, accessory },
      });
    }
  }

  // Remove brand/complaint/accessory mappings for allowed types that were redefined
  for (const applianceType of allowed) {
    const allowedBrands = new Set(APPLIANCE_BRANDS[applianceType] ?? []);
    const allowedComplaints = new Set(APPLIANCE_COMPLAINTS[applianceType] ?? []);
    const allowedAccessories = new Set(APPLIANCE_ACCESSORIES[applianceType] ?? []);

    const brandRows = await prisma.applianceBrand.findMany({
      where: { applianceType },
    });
    for (const row of brandRows) {
      if (!allowedBrands.has(row.brand)) {
        await prisma.applianceBrand.delete({ where: { id: row.id } });
      }
    }

    const complaintRows = await prisma.applianceComplaint.findMany({
      where: { applianceType },
    });
    for (const row of complaintRows) {
      if (!allowedComplaints.has(row.complaint)) {
        await prisma.applianceComplaint.delete({ where: { id: row.id } });
      }
    }

    const accessoryRows = await prisma.applianceAccessory.findMany({
      where: { applianceType },
    });
    for (const row of accessoryRows) {
      if (!allowedAccessories.has(row.accessory)) {
        await prisma.applianceAccessory.delete({ where: { id: row.id } });
      }
    }
  }
}

async function main() {
  await pruneRemovedAppliances();
  await seedLookups("appliance", APPLIANCES);
  await seedLookups("brand", BRANDS);
  await seedLookups("complaint", COMPLAINTS);
  await seedApplianceLookups();

  for (const name of TECHNICIANS) {
    await prisma.technician.upsert({
      where: { name },
      update: { active: true },
      create: { name },
    });
  }

  for (const name of OUTSOURCE_PARTNERS) {
    await prisma.outsourcePartner.upsert({
      where: { name },
      update: { active: true },
      create: { name },
    });
  }

  for (const [applianceType, techName] of Object.entries(APPLIANCE_ROUTING)) {
    const technician = await prisma.technician.findUnique({ where: { name: techName } });
    if (!technician) continue;

    await prisma.applianceTechnician.upsert({
      where: { applianceType },
      update: { technicianId: technician.id },
      create: { applianceType, technicianId: technician.id },
    });
  }

  // Remove technician routing for products no longer offered or unassigned
  const allowed = new Set(APPLIANCES);
  const routed = new Set(Object.keys(APPLIANCE_ROUTING));
  const routings = await prisma.applianceTechnician.findMany();
  for (const routing of routings) {
    if (!allowed.has(routing.applianceType) || !routed.has(routing.applianceType)) {
      await prisma.applianceTechnician.delete({ where: { id: routing.id } });
    }
  }

  await prisma.jobSequence.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, lastNum: 0 },
  });

  const adminMobile = process.env.ADMIN_MOBILE?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (adminMobile && adminPassword) {
    const mobile = normalizeMobile(adminMobile);
    const passwordHash = await hashPassword(adminPassword);
    await prisma.staffUser.upsert({
      where: { mobile },
      update: {
        name: "Admin",
        role: "admin",
        active: true,
        passwordHash,
      },
      create: {
        mobile,
        name: "Admin",
        role: "admin",
        active: true,
        passwordHash,
      },
    });
    console.log("Admin staff user seeded for mobile:", mobile);
  } else {
    console.warn("ADMIN_MOBILE and ADMIN_PASSWORD not set — skip admin staff seed");
  }

  console.log("Seed completed — product types:", APPLIANCES.join(", "));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
