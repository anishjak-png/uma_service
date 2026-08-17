import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SparePartsNav } from "@/modules/spare-parts/components/SparePartsNav";
import { isSparePartsEnabled } from "@/modules/spare-parts/enabled";
import { getSession, isDeviceApproved } from "@/lib/session";

export default async function SparePartsLayout({ children }: { children: React.ReactNode }) {
  if (!isSparePartsEnabled()) redirect("/dashboard");
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin" || !isDeviceApproved(session)) {
    redirect("/dashboard");
  }
  return (
    <AppShell>
      <SparePartsNav />
      {children}
    </AppShell>
  );
}
