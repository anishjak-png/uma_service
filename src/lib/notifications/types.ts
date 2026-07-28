import type {
  NotificationEventType,
  NotificationChannel,
  WhatsAppProviderType,
} from "@prisma/client";

export type { NotificationEventType, NotificationChannel, WhatsAppProviderType };

export const NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  "JOB_CREATED",
  "JOB_READY",
  "JOB_RETURN",
];

export type NotificationEventPayload = {
  type: NotificationEventType;
  jobId: string;
  manual?: boolean;
};

export type NotificationSettingsDto = {
  masterEnabled: boolean;
  jobCreatedEnabled: boolean;
  jobReadyEnabled: boolean;
  jobReturnEnabled: boolean;
  trackingLinkEnabled: boolean;
  provider: WhatsAppProviderType;
  apiUrl: string | null;
  apiKey: string | null;
  accessToken: string | null;
  phoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  businessNumber: string | null;
  additionalHeaders: string | null;
};

/** Job fields used when building WhatsApp notification payloads (Meta + custom providers). */
export type NotificationJobContext = {
  jobNumber: string;
  brand: string;
  applianceType: string;
  model?: string | null;
  /** Non-Meta templates only — approved Meta templates do not include complaint */
  complaint?: string | null;
  serviceAmount?: number | null;
  customer: {
    name?: string | null;
    mobile?: string;
  };
};

export type NotificationJobProduct = Pick<
  NotificationJobContext,
  "brand" | "applianceType" | "model"
>;

export type TemplateVariables = {
  customer_name: string;
  job_number: string;
  product_name: string;
  complaint: string;
  service_amount: string;
  tracking_link: string;
};

export type MetaTemplateVariableFormat = "text" | "currency";

export type MetaTemplatePayload = {
  templateName: string;
  /** Body component {{1}}, {{2}}, … */
  variables: string[];
  /** Per-variable format — defaults to text */
  variableFormats?: MetaTemplateVariableFormat[];
  /** Dynamic URL suffix for template button index 0 (uma_job_created_link) */
  urlButtonParameter?: string;
};

export type WhatsAppSendParams = {
  to: string;
  /** Human-readable preview stored in notification logs */
  message: string;
  settings: NotificationSettingsDto;
  /** Present when sending via Meta Cloud API approved templates */
  metaTemplate?: MetaTemplatePayload;
};

export type WhatsAppSendDebug = {
  templateName?: string;
  recipient?: string;
  requestPayload?: string;
  responsePayload?: string;
  executionTimeMs?: number;
  httpStatus?: number;
  sentAt?: string;
  metaErrorCode?: number;
  metaErrorSubcode?: number;
  metaErrorMessage?: string;
  metaErrorDetails?: string;
  /** Structured error blob persisted in notification logs */
  logError?: string;
  /** Exact Meta error summary for admin diagnostics (e.g. test connection) */
  staffError?: string;
};

export type WhatsAppSendResult = {
  success: boolean;
  externalId?: string;
  error?: string;
  debug?: WhatsAppSendDebug;
};

export type NotificationProcessResult = {
  sent: boolean;
  skipped: boolean;
  error?: string;
  logId?: string;
};
