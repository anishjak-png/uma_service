import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <p className="text-6xl font-bold text-slate-300">404</p>
      <p className="mt-2 text-lg font-medium text-slate-700">Job not found</p>
      <Link href="/" className="mt-6 text-emerald-600 hover:underline">
        Go to login
      </Link>
    </div>
  );
}
