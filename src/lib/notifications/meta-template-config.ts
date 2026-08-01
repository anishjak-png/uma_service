import type { NotificationEventType } from "@prisma/client";
import { getAppUrl } from "@/lib/constants";
import { buildProductName } from "./job-context";
import { toTrackingPathSlug } from "@/lib/jobs";
import type {
  NotificationJobContext,
  NotificationSettingsDto,
  MetaTemplatePayload,
  MetaTemplateVariableFormat,
} from "./types";

/** Variable keys used in approved Meta WhatsApp templates. */
export type MetaTemplateVariableKey =
  | "customer_name"
  | "product_name"
  | "job_number"
  | "tracking_link"
  | "service_amount";

export type MetaTemplateDefinition = {
  /** Approved Meta Cloud API template name */
  name: string;
  eventType: NotificationEventType;
  /** Ordered keys — index 0 maps to Meta {{1}}, index 1 to {{2}}, etc. */
  variables: readonly MetaTemplateVariableKey[];
  /** Approved URL button at index 0 — dynamic suffix only (static base is in Meta template) */
  urlButtonVariable?: MetaTemplateVariableKey;
  /** Meta-approved variable format (e.g. currency for service amount) */
  variableFormats?: Partial<Record<MetaTemplateVariableKey, MetaTemplateVariableFormat>>;
};

/**
 * Single source of truth for Meta approved production templates.
 * uma_job_created       → 3 body variables: Customer Name, Product, Job Number
 * uma_job_created_link  → 4 body variables: Customer Name, Product, Job Number, Tracking Link
 * uma_ready             → 4 body variables: Customer Name, Product, Job Number, Service Amount
 * uma_return            → 3 body variables: Customer Name, Product, Job Number
 *
 * Test Connection uses Meta's built-in hello_world — not listed here.
 */
export const META_TEMPLATES: Record<
  Exclude<NotificationEventType, "JOB_CREATED">,
  MetaTemplateDefinition
> = {
  JOB_READY: {
    name: "uma_ready",
    eventType: "JOB_READY",
    variables: [
      "customer_name",
      "product_name",
      "job_number",
      "service_amount",
    ],
    variableFormats: { service_amount: "currency" },
  },
  JOB_RETURN: {
    name: "uma_return",
    eventType: "JOB_RETURN",
    variables: ["customer_name", "product_name", "job_number"],
  },
};

export const META_TEMPLATE_VARIABLE_LABELS: Record<
  MetaTemplateVariableKey,
  string
> = {
  customer_name: "Customer Name",
  product_name: "Product",
  job_number: "Job Number",
  tracking_link: "Tracking Link",
  service_amount: "Service Amount",
};

export type MetaTemplateBuildResult =
  | {
      ok: true;
      payload: MetaTemplatePayload;
      variableCount: number;
      messagePreview: string;
    }
  | { ok: false; error: string };

export function getMetaTemplateDefinition(
  eventType: NotificationEventType,
  settings: NotificationSettingsDto
): MetaTemplateDefinition {
  if (eventType === "JOB_CREATED") {
    if (settings.trackingLinkEnabled) {
      return {
        name: "uma_job_created_link",
        eventType: "JOB_CREATED",
        variables: [
          "customer_name",
          "product_name",
          "job_number",
          "tracking_link",
        ],
      };
    }
    return {
      name: "uma_job_created",
      eventType: "JOB_CREATED",
      variables: ["customer_name", "product_name", "job_number"],
    };
  }

  return META_TEMPLATES[eventType];
}

function resolveMetaVariableValue(
  key: MetaTemplateVariableKey,
  job: NotificationJobContext,
  settings: NotificationSettingsDto
): string {
  switch (key) {
    case "customer_name":
      return job.customer.name?.trim() || "Customer";
    case "product_name": {
      const product = buildProductName(job);
      return product || "Product";
    }
    case "job_number":
      return job.jobNumber;
    case "tracking_link":
      if (!settings.trackingLinkEnabled) return "";
      return `${getAppUrl()}/j/${toTrackingPathSlug(job.jobNumber)}`;
    case "service_amount":
      if (job.serviceAmount == null) return "";
      // Template body includes "Rs." — send numeric amount only for {{4}}
      return job.serviceAmount.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      });
    default:
      return "";
  }
}

export function validateMetaTemplateVariables(
  definition: MetaTemplateDefinition,
  variables: string[]
): { ok: true } | { ok: false; error: string } {
  const expectedCount = definition.variables.length;

  if (variables.length !== expectedCount) {
    return {
      ok: false,
      error: `Meta template "${definition.name}" expects ${expectedCount} variable(s) but got ${variables.length}. Cannot send to Meta Cloud API.`,
    };
  }

  for (let i = 0; i < expectedCount; i++) {
    const key = definition.variables[i];
    const label = META_TEMPLATE_VARIABLE_LABELS[key];
    const value = variables[i]?.trim() ?? "";

    if (!value) {
      return {
        ok: false,
        error: `Meta template "${definition.name}" variable {{${i + 1}}} (${label}) is missing or empty. Cannot send to Meta Cloud API.`,
      };
    }
  }

  return { ok: true };
}

export function buildMetaTemplatePayload(
  eventType: NotificationEventType,
  job: NotificationJobContext,
  settings: NotificationSettingsDto
): MetaTemplateBuildResult {
  const definition = getMetaTemplateDefinition(eventType, settings);
  const variables = definition.variables.map((key) =>
    resolveMetaVariableValue(key, job, settings)
  );

  const validation = validateMetaTemplateVariables(definition, variables);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const messagePreview = definition.variables
    .map(
      (key, index) =>
        `${META_TEMPLATE_VARIABLE_LABELS[key]}=${variables[index]}`
    )
    .join(" | ");

  let urlButtonParameter: string | undefined;
  if (definition.urlButtonVariable) {
      urlButtonParameter =
      definition.urlButtonVariable === "job_number"
        ? toTrackingPathSlug(job.jobNumber)
        : resolveMetaVariableValue(definition.urlButtonVariable, job, settings);
    if (!urlButtonParameter.trim()) {
      return {
        ok: false,
        error: `Meta template "${definition.name}" URL button parameter (${META_TEMPLATE_VARIABLE_LABELS[definition.urlButtonVariable]}) is missing or empty. Cannot send to Meta Cloud API.`,
      };
    }
  }

  const previewSuffix = urlButtonParameter
    ? ` | url_button=${urlButtonParameter}`
    : "";

  const variableFormats = definition.variables.map(
    (key) => definition.variableFormats?.[key] ?? "text"
  );

  return {
    ok: true,
    payload: {
      templateName: definition.name,
      variables,
      variableFormats,
      urlButtonParameter,
    },
    variableCount: variables.length,
    messagePreview: `[${definition.name}] ${messagePreview}${previewSuffix}`,
  };
}
