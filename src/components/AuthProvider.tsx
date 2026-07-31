"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type StaffRole = "reception" | "technician" | "admin";

type AuthState = {
  isLoggedIn: boolean;
  role: StaffRole | null;
  staffName: string | null;
  technicianId: string | null;
  technicianName: string | null;
  deviceStatus: "pending" | "approved" | "revoked" | null;
  deviceApproved: boolean;
  pendingDeviceCount: number;
  loaded: boolean;
};

type AuthContextValue = AuthState & {
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  role: null,
  staffName: null,
  technicianId: null,
  technicianName: null,
  deviceStatus: null,
  deviceApproved: false,
  pendingDeviceCount: 0,
  loaded: false,
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false,
    role: null,
    staffName: null,
    technicianId: null,
    technicianName: null,
    deviceStatus: null,
    deviceApproved: false,
    pendingDeviceCount: 0,
    loaded: false,
  });

  const refreshAuth = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me");
      const data = await r.json();
      setAuth({
        isLoggedIn: Boolean(data.isLoggedIn),
        role: data.role ?? null,
        staffName: data.staffName ?? null,
        technicianId: data.technicianId ?? null,
        technicianName: data.technicianName ?? null,
        deviceStatus: data.deviceStatus ?? null,
        deviceApproved: Boolean(data.deviceApproved),
        pendingDeviceCount: data.pendingDeviceCount ?? 0,
        loaded: true,
      });
    } catch {
      setAuth((prev) => ({ ...prev, loaded: true }));
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  return (
    <AuthContext.Provider value={{ ...auth, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
