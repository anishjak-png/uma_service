import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type StaffRole = "reception" | "technician" | "admin";

export interface SessionData {
  role: StaffRole;
  isLoggedIn: boolean;
  technicianId?: string;
  technicianName?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "fallback-dev-secret-min-32-characters!!",
  cookieName: "uma_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export function roleFromPin(pin: string): StaffRole | null {
  if (pin === process.env.RECEPTION_PIN) return "reception";
  if (pin === process.env.TECHNICIAN_PIN) return "technician";
  if (pin === process.env.ADMIN_PIN) return "admin";
  return null;
}
