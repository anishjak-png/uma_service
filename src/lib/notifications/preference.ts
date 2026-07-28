/**
 * Notification preference hierarchy:
 * 1. Master WhatsApp Automation (admin settings)
 * 2. Customer allowWhatsappNotifications (default true)
 * 3. Job whatsappNotificationsOverride (null = inherit)
 */

export function resolveWhatsAppAllowed(params: {
  customerAllows: boolean;
  jobOverride: boolean | null | undefined;
  manual?: boolean;
}): boolean {
  const { customerAllows, jobOverride, manual = false } = params;

  if (jobOverride === false) {
    return false;
  }

  if (manual) {
    return true;
  }

  if (jobOverride === true) {
    return true;
  }

  return customerAllows;
}

export function getWhatsAppSkipReason(params: {
  customerAllows: boolean;
  jobOverride: boolean | null | undefined;
  manual?: boolean;
}): string | null {
  if (resolveWhatsAppAllowed(params)) {
    return null;
  }

  if (params.jobOverride === false) {
    return "WhatsApp notifications disabled for this job";
  }

  if (!params.customerAllows) {
    return "Customer opted out of WhatsApp notifications";
  }

  return "WhatsApp notifications are disabled";
}

/** Job override value when staff enables WhatsApp on a job. */
export function jobOverrideWhenEnabling(customerAllows: boolean): boolean | null {
  return customerAllows ? null : true;
}

export function isJobWhatsAppEnabled(params: {
  customerAllows: boolean;
  jobOverride: boolean | null | undefined;
}): boolean {
  return resolveWhatsAppAllowed({ ...params, manual: false });
}
