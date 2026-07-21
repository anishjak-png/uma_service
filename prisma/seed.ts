import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLIANCES = [
  "TV",
  "AC",
  "Refrigerator",
  "Washing Machine",
  "Microwave",
  "Water Heater",
  "Mixer Grinder",
  "Iron",
  "Other",
];

const BRANDS = [
  "Samsung",
  "LG",
  "Sony",
  "Whirlpool",
  "IFB",
  "Godrej",
  "Voltas",
  "Daikin",
  "Panasonic",
  "Haier",
  "Other",
];

const COMPLAINTS = [
  "Not powering on",
  "No display",
  "Not cooling",
  "Water leakage",
  "Strange noise",
  "Not spinning",
  "Remote not working",
  "Gas refill needed",
  "General service",
  "Other",
];

const TECHNICIANS = ["Ravi", "Kumar", "Suresh", "Anand"];

/** Default appliance → technician routing for follow-up */
const APPLIANCE_ROUTING: Record<string, string> = {
  TV: "Ravi",
  AC: "Kumar",
  Refrigerator: "Suresh",
  "Washing Machine": "Anand",
  Microwave: "Ravi",
  "Water Heater": "Kumar",
  "Mixer Grinder": "Anand",
  Iron: "Suresh",
  Other: "Ravi",
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

async function main() {
  await seedLookups("appliance", APPLIANCES);
  await seedLookups("brand", BRANDS);
  await seedLookups("complaint", COMPLAINTS);

  for (const name of TECHNICIANS) {
    await prisma.technician.upsert({
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

  console.log("Seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
