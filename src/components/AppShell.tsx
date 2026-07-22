import { ReactNode, Suspense } from "react";
import { AppNav } from "./AppNav";

function NavFallback() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-700 bg-emerald-900 px-4 py-3 shadow-sm">
        <div className="mx-auto h-12 max-w-lg" />
      </header>
      <nav className="border-b border-emerald-700 bg-emerald-900">
        <div className="mx-auto h-14 max-w-lg" />
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="flex flex-1 flex-col">
        <Suspense fallback={<NavFallback />}>
          <AppNav />
        </Suspense>
        <main className="mx-auto w-full max-w-lg flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
