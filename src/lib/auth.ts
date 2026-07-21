import { getSession } from "./session";

export async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    return null;
  }
  return session;
}
