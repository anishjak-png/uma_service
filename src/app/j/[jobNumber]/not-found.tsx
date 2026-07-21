import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gray-50 px-4">
      <p className="text-6xl font-bold text-gray-300">404</p>
      <p className="mt-2 text-lg font-medium text-gray-700">Job not found</p>
      <Link href="/" className="mt-6 text-orange-600 hover:underline">
        Go to login
      </Link>
    </div>
  );
}
