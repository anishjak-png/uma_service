"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";

type StaffRole = "reception" | "technician" | "admin";

type StaffRow = {
  id: string;
  mobile: string;
  name: string;
  role: StaffRole;
  active: boolean;
  technicianId: string | null;
  technicianName: string | null;
  deviceCount: number;
};

type TechnicianOption = { id: string; name: string };

type EditForm = {
  mobile: string;
  name: string;
  role: StaffRole;
  technicianId: string;
  password: string;
};

function PasswordField({
  value,
  onChange,
  placeholder,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-md border border-slate-300 px-3 pr-20"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function emptyEditForm(): EditForm {
  return {
    mobile: "",
    name: "",
    role: "technician",
    technicianId: "",
    password: "",
  };
}

function editFormFromStaff(s: StaffRow): EditForm {
  return {
    mobile: s.mobile,
    name: s.name,
    role: s.role,
    technicianId: s.technicianId ?? "",
    password: "",
  };
}

export function StaffTab() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    mobile: "",
    name: "",
    role: "technician" as StaffRole,
    password: "",
    technicianId: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm());

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [staffRes, techs] = await Promise.all([
        fetchJson<{ staff: StaffRow[] }>("/api/admin/staff"),
        fetchJson<TechnicianOption[]>("/api/technicians"),
      ]);
      setStaff(staffRes.staff);
      setTechnicians(techs.filter((t) => t.name));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load staff");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(s: StaffRow) {
    setEditingId(s.id);
    setEditForm(editFormFromStaff(s));
    setShowForm(false);
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyEditForm());
  }

  async function createStaff() {
    setMessage("");
    try {
      await fetchJson("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: form.mobile,
          name: form.name,
          role: form.role,
          password: form.password,
          technicianId:
            form.role === "technician" ? form.technicianId || null : null,
        }),
      });
      setForm({
        mobile: "",
        name: "",
        role: "technician",
        password: "",
        technicianId: "",
      });
      setShowForm(false);
      setMessage("Staff account created.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Create failed");
    }
  }

  async function saveEdit(id: string) {
    setMessage("");
    try {
      const patch: Record<string, unknown> = {
        mobile: editForm.mobile,
        name: editForm.name,
        role: editForm.role,
        technicianId:
          editForm.role === "technician" ? editForm.technicianId || null : null,
      };
      if (editForm.password.trim()) {
        patch.password = editForm.password;
      }

      await fetchJson(`/api/admin/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      cancelEdit();
      setMessage("Staff updated.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setMessage("");
    try {
      await fetchJson(`/api/admin/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      setMessage(active ? "Staff deactivated." : "Staff activated.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Staff accounts</h2>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            cancelEdit();
          }}
          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
        >
          {showForm ? "Cancel" : "Add staff"}
        </button>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New staff account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="tel"
              placeholder="Mobile (10 digits)"
              value={form.mobile}
              onChange={(e) =>
                setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))
              }
              className="h-11 w-full rounded-md border border-slate-300 px-3"
            />
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-11 w-full rounded-md border border-slate-300 px-3"
            />
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as StaffRole,
                }))
              }
              className="h-11 w-full rounded-md border border-slate-300 px-3"
            >
              <option value="technician">Technician</option>
              <option value="reception">Reception</option>
              <option value="admin">Admin</option>
            </select>
            {form.role === "technician" && (
              <select
                value={form.technicianId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, technicianId: e.target.value }))
                }
                className="h-11 w-full rounded-md border border-slate-300 px-3"
              >
                <option value="">Link to technician…</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <PasswordField
              value={form.password}
              onChange={(password) => setForm((f) => ({ ...f, password }))}
              placeholder="Password (min 6 chars)"
            />
            <button
              type="button"
              onClick={createStaff}
              className="h-11 w-full rounded-md bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Create account
            </button>
          </CardContent>
        </Card>
      )}

      {staff.map((s) => (
        <Card key={s.id}>
          <CardContent className="space-y-3 pt-4">
            {editingId === s.id ? (
              <>
                <p className="text-sm font-medium text-slate-700">Edit staff</p>
                <input
                  type="tel"
                  placeholder="Mobile (10 digits)"
                  value={editForm.mobile}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      mobile: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  className="h-11 w-full rounded-md border border-slate-300 px-3"
                />
                <input
                  type="text"
                  placeholder="Full name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="h-11 w-full rounded-md border border-slate-300 px-3"
                />
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      role: e.target.value as StaffRole,
                    }))
                  }
                  className="h-11 w-full rounded-md border border-slate-300 px-3"
                >
                  <option value="technician">Technician</option>
                  <option value="reception">Reception</option>
                  <option value="admin">Admin</option>
                </select>
                {editForm.role === "technician" && (
                  <select
                    value={editForm.technicianId}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, technicianId: e.target.value }))
                    }
                    className="h-11 w-full rounded-md border border-slate-300 px-3"
                  >
                    <option value="">Link to technician…</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <PasswordField
                  value={editForm.password}
                  onChange={(password) =>
                    setEditForm((f) => ({ ...f, password }))
                  }
                  placeholder="New password (leave blank to keep current)"
                  hint="Current password is stored securely and cannot be shown. Use Show to view what you type here."
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="h-11 rounded-md border border-slate-300 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(s.id)}
                    className="h-11 rounded-md bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <p className="text-sm text-slate-500">{s.mobile}</p>
                    <p className="text-xs capitalize text-slate-400">
                      {s.role}
                      {s.technicianName ? ` · ${s.technicianName}` : ""}
                      {!s.active ? " · inactive" : ""}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{s.deviceCount} devices</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(s.id, s.active)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium"
                  >
                    {s.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {staff.length === 0 && !loadError && (
        <p className="text-center text-sm text-slate-500">No staff accounts yet.</p>
      )}
    </div>
  );
}
