import { ReactNode } from "react";
import { AppNav } from "./AppNav";

export function AppShell({
  children,
  whatsappPending = 0,
}: {
  children: ReactNode;
  whatsappPending?: number;
}) {
  return (
    <div className="min-h-full bg-slate-50">
      <AppNav whatsappPending={whatsappPending} />
      <main className="mx-auto max-w-lg px-4 py-4 pb-8">{children}</main>
    </div>
  );
}
