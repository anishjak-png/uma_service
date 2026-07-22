import { ReactNode } from "react";
import { AppNav } from "./AppNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="flex flex-1 flex-col">
        <AppNav />
        <main className="mx-auto w-full max-w-lg flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
