import { Suspense } from "react";
import AdminContent from "./AdminContent";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-slate-500">Loading…</p>}>
      <AdminContent />
    </Suspense>
  );
}
