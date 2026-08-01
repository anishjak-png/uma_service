import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type StaffRole = "reception" | "technician" | "admin";
export type DeviceStatus = "pending" | "approved" | "revoked";

export interface SessionData {
  role: StaffRole;
  isLoggedIn: boolean;
  staffUserId?: string;
  staffName?: string;
  deviceId?: string;
  deviceStatus?: DeviceStatus;
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
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export function isDeviceApproved(session: SessionData): boolean {
  return session.deviceStatus === "approved";
}

export async function clearSession(session: Awaited<ReturnType<typeof getSession>>) {
  session.role = "reception";
  session.isLoggedIn = false;
  session.staffUserId = undefined;
  session.staffName = undefined;
  session.deviceId = undefined;
  session.deviceStatus = undefined;
  session.technicianId = undefined;
  session.technicianName = undefined;
  await session.save();
}
