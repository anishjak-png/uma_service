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
  technicianId: string | null;
  technicianName: string | null;
  loaded: boolean;
};

type AuthContextValue = AuthState & {
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  role: null,
  technicianId: null,
  technicianName: null,
  loaded: false,
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false,
    role: null,
    technicianId: null,
    technicianName: null,
    loaded: false,
  });

  const refreshAuth = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me");
      const data = await r.json();
      setAuth({
        isLoggedIn: Boolean(data.isLoggedIn),
        role: data.role ?? null,
        technicianId: data.technicianId ?? null,
        technicianName: data.technicianName ?? null,
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
