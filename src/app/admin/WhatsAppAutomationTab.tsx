"use client";

import { TEMPLATE_VARIABLE_HINTS } from "@/lib/notifications/default-templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Settings = {
  masterEnabled: boolean;
  jobCreatedEnabled: boolean;
  jobReadyEnabled: boolean;
  jobReturnEnabled: boolean;
  trackingLinkEnabled: boolean;
  provider: "meta" | "interakt" | "twilio" | "custom";
  apiUrl: string | null;
  apiKey: string | null;
  accessToken: string | null;
  phoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  businessNumber: string | null;
  additionalHeaders: string | null;
};

type TemplateRow = {
  eventType: "JOB_CREATED" | "JOB_READY" | "JOB_RETURN";
  body: string;
};

const EVENT_LABELS: Record<TemplateRow["eventType"], string> = {
  JOB_CREATED: "Job Card Created",
  JOB_READY: "Ready For Delivery",
  JOB_RETURN: "Return",
};

const PROVIDERS = [
  { value: "meta", label: "Meta Cloud API" },
  { value: "interakt", label: "Interakt" },
  { value: "twilio", label: "Twilio" },
  { value: "custom", label: "Custom API" },
] as const;

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-emerald-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function WhatsAppAutomationTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [testRecipientPhone, setTestRecipientPhone] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      window.location.origin;
    setWebhookUrl(`${base}/api/webhooks/whatsapp`);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [settingsRes, templatesRes] = await Promise.all([
      fetch("/api/admin/notifications/settings"),
      fetch("/api/admin/notifications/templates"),
    ]);
    setSettings(await settingsRes.json());
    const templateData = await templatesRes.json();
    setTemplates(templateData.templates ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    setMessage("");
    const res = await fetch("/api/admin/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to save settings");
    } else {
      setSettings(data);
      setMessage("Settings saved");
    }
    setSavingSettings(false);
  }

  async function testConnection() {
    setTestingConnection(true);
    setTestResult(null);
    const res = await fetch("/api/admin/notifications/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientPhone: testRecipientPhone.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTestResult({
        ok: false,
        text: data.error ?? "Test connection failed",
      });
    } else {
      setTestResult({
        ok: true,
        text: data.externalId
          ? `Test message sent (ID: ${data.externalId})`
          : "Test message sent",
      });
    }
    setTestingConnection(false);
  }

  async function saveTemplate(eventType: TemplateRow["eventType"], body: string) {
    setSavingTemplate(eventType);
    setMessage("");
    const res = await fetch("/api/admin/notifications/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to save template");
    } else {
      setTemplates((prev) =>
        prev.map((t) => (t.eventType === eventType ? { ...t, body: data.body } : t))
      );
      setMessage(`${EVENT_LABELS[eventType]} template saved`);
    }
    setSavingTemplate(null);
  }

  function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading || !settings) {
    return <p className="text-center text-sm text-slate-500">Loading…</p>;
  }

  const provider = settings.provider;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">WhatsApp Automation</h2>
        <p className="text-xs text-slate-500">
          Configure automated customer messages. Business workflows stay unchanged — only
          notification settings are managed here.
        </p>
      </div>

      {message && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Automation Toggles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ToggleRow
            label="Master WhatsApp Automation"
            checked={settings.masterEnabled}
            onChange={(v) => updateSettings("masterEnabled", v)}
          />
          <ToggleRow
            label="Enable Job Card Created Message"
            checked={settings.jobCreatedEnabled}
            onChange={(v) => updateSettings("jobCreatedEnabled", v)}
          />
          <ToggleRow
            label="Enable Ready For Delivery Message"
            checked={settings.jobReadyEnabled}
            onChange={(v) => updateSettings("jobReadyEnabled", v)}
          />
          <ToggleRow
            label="Enable Return Message"
            checked={settings.jobReturnEnabled}
            onChange={(v) => updateSettings("jobReturnEnabled", v)}
          />
          <ToggleRow
            label="Enable Tracking Link"
            checked={settings.trackingLinkEnabled}
            onChange={(v) => updateSettings("trackingLinkEnabled", v)}
          />
        </CardContent>
      </Card>

      {provider === "meta" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inbound Webhook (Customer Replies)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p className="text-xs text-slate-500">
              API-only numbers cannot use Meta Business Suite Inbox. Configure this
              webhook so customer replies appear in{" "}
              <Link href="/admin?tab=inbox" className="font-medium text-emerald-700 hover:underline">
                Admin → Inbox
              </Link>
              .
            </p>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Callback URL</p>
              <code className="block break-all rounded-md bg-slate-100 px-2 py-1.5 text-xs">
                {webhookUrl || "…"}
              </code>
            </div>
            <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-600">
              <li>
                Set <code className="rounded bg-slate-100 px-1">WHATSAPP_WEBHOOK_VERIFY_TOKEN</code>{" "}
                and <code className="rounded bg-slate-100 px-1">META_APP_SECRET</code> in Vercel env
              </li>
              <li>
                Meta Developer → App → WhatsApp → Configuration → paste Callback URL and verify token
              </li>
              <li>Subscribe webhook field: <strong>messages</strong></li>
              <li>Reply to a template message from your phone to test</li>
            </ol>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-medium text-emerald-700 hover:underline"
            >
              Meta webhook documentation →
            </a>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">WhatsApp API Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={provider}
            onChange={(e) =>
              updateSettings("provider", e.target.value as Settings["provider"])
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {(provider === "meta" || provider === "custom") && (
            <Field
              label="API URL"
              value={settings.apiUrl ?? ""}
              onChange={(v) => updateSettings("apiUrl", v || null)}
              placeholder={
                provider === "meta"
                  ? "Optional — defaults to https://graph.facebook.com"
                  : "https://your-api.example/send"
              }
            />
          )}

          {(provider === "meta" ||
            provider === "interakt" ||
            provider === "twilio" ||
            provider === "custom") && (
            <Field
              label={provider === "twilio" ? "API Key (Account SID)" : "API Key"}
              value={settings.apiKey ?? ""}
              onChange={(v) => updateSettings("apiKey", v || null)}
            />
          )}

          {(provider === "meta" ||
            provider === "twilio" ||
            provider === "custom") && (
            <Field
              label={provider === "twilio" ? "Access Token (Auth Token)" : "Access Token"}
              value={settings.accessToken ?? ""}
              onChange={(v) => updateSettings("accessToken", v || null)}
              secret
              placeholder={
                provider === "meta" ? "Paste Meta Cloud API Access Token" : undefined
              }
            />
          )}

          {(provider === "meta" || provider === "custom") && (
            <Field
              label="Phone Number ID"
              value={settings.phoneNumberId ?? ""}
              onChange={(v) => updateSettings("phoneNumberId", v || null)}
              placeholder={provider === "meta" ? "Example: 1285705461286056" : undefined}
            />
          )}

          {provider === "meta" && (
            <Field
              label="WhatsApp Business Account ID"
              value={settings.whatsappBusinessAccountId ?? ""}
              onChange={(v) => updateSettings("whatsappBusinessAccountId", v || null)}
              placeholder="Example: 806112179180416"
            />
          )}

          {(provider === "twilio" || provider === "custom") && (
            <Field
              label="WhatsApp Phone Number"
              value={settings.businessNumber ?? ""}
              onChange={(v) => updateSettings("businessNumber", v || null)}
              placeholder={
                provider === "twilio" ? "whatsapp:+14155238886" : "Example: +919842241388"
              }
            />
          )}

          {provider === "meta" && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">
                Sender is determined by Phone Number ID. WhatsApp Phone Number is not
                required for Meta Cloud API.
              </p>
              <Field
                label="Test recipient phone number"
                value={testRecipientPhone}
                onChange={setTestRecipientPhone}
                placeholder="Verified Meta test number (e.g. +919876543210)"
              />
              <p className="text-xs text-slate-500">
                Leave blank to use META_TEST_RECIPIENT_PHONE from the server environment.
              </p>
              <button
                type="button"
                onClick={testConnection}
                disabled={testingConnection}
                className="w-full rounded-md border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {testingConnection ? "Testing…" : "Test Connection"}
              </button>
              {testResult && (
                <p
                  className={`text-xs ${testResult.ok ? "text-emerald-700" : "text-red-700"}`}
                >
                  {testResult.text}
                </p>
              )}
            </div>
          )}

          {provider === "interakt" && (
            <Field
              label="API URL"
              value={settings.apiUrl ?? ""}
              onChange={(v) => updateSettings("apiUrl", v || null)}
              placeholder="Optional — defaults to Interakt API"
            />
          )}

          {provider === "custom" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Additional Headers (optional JSON)
              </label>
              <textarea
                value={settings.additionalHeaders ?? ""}
                onChange={(e) =>
                  updateSettings("additionalHeaders", e.target.value || null)
                }
                rows={3}
                placeholder='{"X-Custom-Header":"value"}'
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </div>
          )}

          <button
            type="button"
            onClick={saveSettings}
            disabled={savingSettings}
            className="w-full rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingSettings ? "Saving…" : "Save Settings"}
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Message Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Variables: {TEMPLATE_VARIABLE_HINTS.join(", ")}
          </p>
          {templates.map((template) => (
            <div key={template.eventType} className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {EVENT_LABELS[template.eventType]}
              </p>
              <textarea
                value={template.body}
                onChange={(e) =>
                  setTemplates((prev) =>
                    prev.map((t) =>
                      t.eventType === template.eventType
                        ? { ...t, body: e.target.value }
                        : t
                    )
                  )
                }
                rows={10}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed"
              />
              <button
                type="button"
                onClick={() => saveTemplate(template.eventType, template.body)}
                disabled={savingTemplate === template.eventType}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {savingTemplate === template.eventType ? "Saving…" : "Save Template"}
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <CustomerPreferencesSection />
    </div>
  );
}

type PreferenceCustomer = {
  id: string;
  name: string | null;
  mobile: string;
  allowWhatsappNotifications: boolean;
  jobCount: number;
};

function CustomerPreferencesSection() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<PreferenceCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/admin/notifications/customers${params}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    search("");
  }, [search]);

  async function toggleCustomer(customer: PreferenceCustomer) {
    setSavingId(customer.id);
    const res = await fetch("/api/admin/notifications/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.id,
        allowWhatsappNotifications: !customer.allowWhatsappNotifications,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id
            ? { ...c, allowWhatsappNotifications: updated.allowWhatsappNotifications }
            : c
        )
      );
    }
    setSavingId(null);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Customer Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          All customers receive WhatsApp notifications by default. Disable here when a
          customer opts out — applies to all future jobs.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mobile or name"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
        </form>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {customers.map((customer) => (
              <li
                key={customer.id}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {customer.name ?? customer.mobile}
                  </p>
                  <p className="text-xs text-slate-500">
                    {customer.mobile} · {customer.jobCount} job(s)
                  </p>
                </div>
                <ToggleRow
                  label="WhatsApp"
                  checked={customer.allowWhatsappNotifications}
                  onChange={() => {
                    if (savingId === customer.id) return;
                    toggleCustomer(customer);
                  }}
                />
              </li>
            ))}
            {customers.length === 0 && (
              <p className="text-sm text-slate-500">No customers found</p>
            )}
          </ul>
        )}
        {savingId && (
          <p className="text-xs text-slate-500">Saving preference…</p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
