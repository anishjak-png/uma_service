"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";

type Partner = { id: string; name: string; active: boolean };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function OutsourceTab() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const all = await fetchJson<Partner[]>("/api/outsource-partners/all");
      setPartners(all);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load partners"
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addPartner() {
    if (!newName.trim()) return;
    setMessage("");
    try {
      await fetchJson("/api/outsource-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      setMessage("Partner added.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Add failed");
    }
  }

  async function updatePartner(id: string, patch: Record<string, unknown>) {
    setMessage("");
    try {
      await fetchJson(`/api/outsource-partners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setEditingId(null);
      setMessage("Partner updated.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-800">Outsource partners</h2>
      <p className="text-sm text-slate-500">
        Outside repair persons (Hanuram, Perumal, etc.) — jobs sent to them are
        tracked separately from store technicians.
      </p>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="New partner name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-11 flex-1 rounded-md border border-slate-300 px-3"
        />
        <button
          type="button"
          onClick={addPartner}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Add
        </button>
      </div>

      {partners.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-2 pt-4">
            {editingId === p.id ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => updatePartner(p.id, { name: editName })}
                  className="rounded-md bg-emerald-600 px-3 text-xs font-medium text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-slate-300 px-3 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">{p.name}</p>
                  {!p.active && (
                    <span className="text-xs text-slate-400">inactive</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(p.id);
                      setEditName(p.name);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePartner(p.id, { active: !p.active })}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium"
                  >
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {partners.length === 0 && !loadError && (
        <p className="text-center text-sm text-slate-500">No outsource partners yet.</p>
      )}
    </div>
  );
}
