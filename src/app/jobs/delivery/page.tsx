import { Suspense } from "react";
import DeliveryContent from "./DeliveryContent";

export default function DeliveryPage() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-slate-500">Loading…</p>}>
      <DeliveryContent />
    </Suspense>
  );
}
