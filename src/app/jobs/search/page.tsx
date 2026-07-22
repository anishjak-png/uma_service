import { Suspense } from "react";
import SearchContent from "./SearchContent";

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-slate-500">Loading…</p>}>
      <SearchContent />
    </Suspense>
  );
}
