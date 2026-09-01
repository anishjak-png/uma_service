import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeMobile } from "@/lib/jobs";

export type CustomerContact = {
  id: string;
  name: string | null;
  mobile: string;
  allowWhatsappNotifications: boolean;
};

function toContact(customer: CustomerContact): CustomerContact {
  return {
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    allowWhatsappNotifications: customer.allowWhatsappNotifications,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** Keep WhatsApp threads attached when a customer's mobile is corrected. */
export async function syncWhatsAppConversationMobile(
  customerId: string,
  oldMobile: string,
  newMobile: string
) {
  if (oldMobile === newMobile) return;

  const [oldConvo, newConvo] = await Promise.all([
    prisma.whatsAppConversation.findUnique({
      where: { customerMobile: oldMobile },
    }),
    prisma.whatsAppConversation.findUnique({
      where: { customerMobile: newMobile },
    }),
  ]);

  if (newConvo) {
    await prisma.whatsAppConversation.update({
      where: { id: newConvo.id },
      data: { customerId },
    });
    if (oldConvo && oldConvo.id !== newConvo.id && oldConvo.customerId === customerId) {
      await prisma.whatsAppConversation.update({
        where: { id: oldConvo.id },
        data: { customerId: null },
      });
    }
    return;
  }

  if (oldConvo) {
    await prisma.whatsAppConversation.update({
      where: { id: oldConvo.id },
      data: { customerMobile: newMobile, customerId },
    });
  }
}

/**
 * Correct name/mobile on a job.
 * - Name-only: updates the shared customer.
 * - Mobile already used by another customer: moves this job onto that customer.
 * - New mobile, this is their only job: updates the customer record.
 * - New mobile, customer has other jobs: creates a new customer for this job only.
 */
export async function applyJobCustomerCorrection(params: {
  jobId: string;
  currentCustomerId: string;
  name: string;
  mobile: string;
}): Promise<{ customer: CustomerContact } | { error: string; status: number }> {
  const name = params.name.trim();
  if (!name) {
    return { error: "Customer name required", status: 400 };
  }

  const mobile = normalizeMobile(params.mobile);
  if (mobile.length !== 10) {
    return { error: "Valid 10-digit mobile required", status: 400 };
  }

  const current = await prisma.customer.findUnique({
    where: { id: params.currentCustomerId },
    include: { _count: { select: { jobCards: true } } },
  });
  if (!current) {
    return { error: "Customer not found", status: 404 };
  }

  const nameChanged = (current.name ?? "").trim() !== name;
  const mobileChanged = current.mobile !== mobile;

  if (!nameChanged && !mobileChanged) {
    return { customer: toContact(current) };
  }

  try {
    if (!mobileChanged) {
      const customer = await prisma.customer.update({
        where: { id: current.id },
        data: { name },
      });
      return { customer: toContact(customer) };
    }

    const otherWithMobile = await prisma.customer.findUnique({
      where: { mobile },
    });

    if (otherWithMobile && otherWithMobile.id !== current.id) {
      return { customer: toContact(otherWithMobile) };
    }

    if (current._count.jobCards <= 1) {
      const customer = await prisma.customer.update({
        where: { id: current.id },
        data: { name, mobile },
      });
      await syncWhatsAppConversationMobile(current.id, current.mobile, mobile);
      return { customer: toContact(customer) };
    }

    const created = await prisma.customer.create({
      data: {
        name,
        mobile,
        allowWhatsappNotifications: current.allowWhatsappNotifications,
      },
    });
    return { customer: toContact(created) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Mobile number already in use", status: 409 };
    }
    throw error;
  }
}
