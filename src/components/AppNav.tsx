"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SHOP_NAME } from "@/lib/constants";
import { useAuth } from "./AuthProvider";

const receptionQuickActions = [
  { href: "/dashboard", label: "Home" },
  { href: "/jobs/new", label: "New Job" },
  { href: "/jobs/delivery", label: "Delivery" },
  { href: "/jobs/search", label: "Search" },
];

const technicianLinks = [
  { href: "/jobs/pending", label: "Dashboard" },
  { href: "/jobs/search", label: "Search" },
];

const adminLinks = [
  { href: "/dashboard", label: "Home" },
  { href: "/jobs/new", label: "New Job" },
  { href: "/jobs/delivery", label: "Delivery" },
  { href: "/jobs/pending", label: "Pending" },
  { href: "/jobs/search", label: "Search" },
  { href: "/admin", label: "Admin" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, technicianName } = useAuth();

  const links = role === "technician" ? technicianLinks : adminLinks;
  const showReceptionQuickActions = role === "reception" || role === null;
  const homeHref = role === "technician" ? "/jobs/pending" : "/dashboard";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-700 bg-emerald-900 px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href={homeHref} className="min-w-0">
            <p className="text-xs text-emerald-200">Home Appliance Service</p>
            <h1 className="text-lg font-bold text-white">{SHOP_NAME}</h1>
            {technicianName && (
              <p className="text-xs text-emerald-200">{technicianName}</p>
            )}
          </Link>
          <button
            onClick={logout}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-800 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>
      {showReceptionQuickActions ? (
        <nav className="border-b border-emerald-700 bg-emerald-900">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-2 p-3">
            {receptionQuickActions.map((action) => {
              const active =
                pathname === action.href ||
                pathname.startsWith(`${action.href}/`);
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`rounded-md px-2 py-2.5 text-center text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-emerald-800"
                      : "bg-emerald-700 text-white hover:bg-emerald-600"
                  }`}
                >
                  {action.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : (
        <nav className="border-b border-emerald-700 bg-emerald-900">
          <div className="mx-auto flex max-w-lg overflow-x-auto p-3">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative mr-1 shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-700 text-white"
                      : "text-emerald-100 hover:bg-emerald-800 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
