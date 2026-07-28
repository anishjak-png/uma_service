import type { NotificationEventType } from "@prisma/client";

/** Initial template bodies stored in DB on first admin load — editable from Admin Settings. */
export const DEFAULT_TEMPLATE_BODIES: Record<NotificationEventType, string> = {
  JOB_CREATED: `Dear {{customer_name}},

Your product has been received by UMA SERVICE.

Job Card Number : {{job_number}}

Product :
{{product_name}}

Complaint :
{{complaint}}

Track your service request here:

{{tracking_link}}

Thank you.`,

  JOB_READY: `Dear {{customer_name}},

Your product is ready for delivery.

Job Card Number : {{job_number}}

Service Charges : {{service_amount}}

Please collect your product from UMA Traders.

Thank you.`,

  JOB_RETURN: `Dear {{customer_name}},

We regret to inform you that your product could not be repaired / serviced.

Job Card Number : {{job_number}}

Kindly collect your product from UMA Traders.

Thank you.`,
};

export const TEMPLATE_VARIABLE_HINTS = [
  "{{customer_name}}",
  "{{job_number}}",
  "{{product_name}}",
  "{{complaint}}",
  "{{service_amount}}",
  "{{tracking_link}}",
] as const;
