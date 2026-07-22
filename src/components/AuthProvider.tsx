"use client";

import {
  createContext,
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

const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  role: null,
  technicianId: null,
  technicianName: null,
  loaded: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false,
    role: null,
    technicianId: null,
    technicianName: null,
    loaded: false,
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setAuth({
          isLoggedIn: Boolean(data.isLoggedIn),
          role: data.role ?? null,
          technicianId: data.technicianId ?? null,
          technicianName: data.technicianName ?? null,
          loaded: true,
        });
      })
      .catch(() => {
        setAuth((prev) => ({ ...prev, loaded: true }));
      });
  }, []);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
