import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { ReceptionDashboard } from "@/components/dashboard/ReceptionDashboard";
import {
  getAdminDashboardData,
  getReceptionDashboardData,
} from "@/lib/dashboard-data";
import { getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/");
  }

  if (session.role === "technician") {
    redirect("/jobs/pending?scope=my");
  }

  if (session.role === "admin") {
    const data = await getAdminDashboardData();
    return (
      <AppShell>
        <AdminDashboard data={data} />
      </AppShell>
    );
  }

  const data = await getReceptionDashboardData();
  return (
    <AppShell>
      <ReceptionDashboard data={data} />
    </AppShell>
  );
}
