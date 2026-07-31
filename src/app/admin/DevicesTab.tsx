"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/AuthProvider";
import { useCallback, useEffect, useState } from "react";

type DeviceRow = {
  id: string;
  deviceLabel: string | null;
  platform: "android" | "web";
  status: "pending" | "approved" | "revoked";
  createdAt: string;
  lastSeenAt: string;
  staffUser: {
    id: string;
    name: string;
    mobile: string;
    role: string;
  };
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DevicesTab() {
  const { refreshAuth } = useAuth();
  const [filter, setFilter] = useState<"pending" | "approved" | "revoked" | "all">(
    "pending"
  );
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const query =
        filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const data = await fetchJson<{
        devices: DeviceRow[];
        pendingCount: number;
      }>(`/api/admin/devices${query}`);
      setDevices(data.devices);
      setPendingCount(data.pendingCount);
      await refreshAuth();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load devices");
    }
  }, [filter, refreshAuth]);

  useEffect(() => {
    load();
  }, [load]);

  async function setDeviceStatus(id: string, action: "approve" | "revoke") {
    setBusyId(id);
    setMessage("");
    try {
      await fetchJson(`/api/admin/devices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setMessage(action === "approve" ? "Device approved." : "Device revoked.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Device approval</h2>
        {pendingCount > 0 && filter !== "pending" && (
          <p className="text-sm text-amber-700">{pendingCount} device(s) waiting</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-0.5">
        {(["pending", "approved", "revoked", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 rounded px-2 py-2 text-xs font-medium capitalize ${
              filter === f
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f === "pending" && pendingCount > 0 ? `Pending (${pendingCount})` : f}
          </button>
        ))}
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      {devices.map((d) => (
        <Card key={d.id}>
          <CardContent className="space-y-3 pt-4">
            <div>
              <p className="font-medium text-slate-800">{d.staffUser.name}</p>
              <p className="text-sm text-slate-500">{d.staffUser.mobile}</p>
              <p className="text-xs capitalize text-slate-400">
                {d.staffUser.role} · {d.platform}
              </p>
              <p className="text-sm text-slate-600">
                {d.deviceLabel ?? "Unknown device"}
              </p>
              <p className="text-xs text-slate-400">
                Requested {formatWhen(d.createdAt)}
              </p>
            </div>

            {d.status === "pending" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => setDeviceStatus(d.id, "approve")}
                  className="h-11 rounded-md bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => setDeviceStatus(d.id, "revoke")}
                  className="h-11 rounded-md border border-red-300 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}

            {d.status === "approved" && (
              <button
                type="button"
                disabled={busyId === d.id}
                onClick={() => setDeviceStatus(d.id, "revoke")}
                className="h-10 w-full rounded-md border border-red-300 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Revoke access
              </button>
            )}

            {d.status === "revoked" && (
              <button
                type="button"
                disabled={busyId === d.id}
                onClick={() => setDeviceStatus(d.id, "approve")}
                className="h-10 w-full rounded-md bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve again
              </button>
            )}
          </CardContent>
        </Card>
      ))}

      {devices.length === 0 && !loadError && (
        <p className="text-center text-sm text-slate-500">
          {filter === "pending"
            ? "No devices waiting for approval."
            : "No devices in this list."}
        </p>
      )}
    </div>
  );
}
