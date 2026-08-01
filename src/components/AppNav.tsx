"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { useAuth } from "./AuthProvider";

type NavLink = { href: string; label: string };

function getNavLinks(
  role: "reception" | "technician" | "admin" | null,
  pendingDeviceCount: number
): NavLink[] {
  if (role === "technician") {
    return [
      { href: "/jobs/pending?scope=my", label: "Home" },
      { href: "/jobs/new", label: "New Job" },
      { href: "/jobs/delivery", label: "Delivery" },
      { href: "/jobs/search", label: "Search" },
    ];
  }

  if (role === "admin") {
    return [
      { href: "/dashboard", label: "Home" },
      { href: "/jobs/pending", label: "Pending" },
      { href: "/admin?tab=devices", label: pendingDeviceCount > 0 ? `Devices (${pendingDeviceCount})` : "Devices" },
      { href: "/admin?tab=reports", label: "Reports" },
      { href: "/admin", label: "Settings" },
    ];
  }

  return [
    { href: "/dashboard", label: "Home" },
    { href: "/jobs/new", label: "New Job" },
    { href: "/jobs/delivery", label: "Delivery" },
    { href: "/jobs/pending", label: "Pending" },
    { href: "/jobs/search", label: "Search" },
  ];
}

function getUserSubtitle(
  role: "reception" | "technician" | "admin" | null,
  staffName: string | null,
  technicianName: string | null
) {
  if (staffName) {
    if (role === "technician") return `${staffName} · Technician`;
    if (role === "reception") return `${staffName} · Reception`;
    if (role === "admin") return `${staffName} · Admin`;
  }
  if (role === "technician") {
    return technicianName ? `${technicianName} (Technician)` : "Technician";
  }
  if (role === "reception") return "Reception";
  if (role === "admin") return "Admin";
  return null;
}

export function AppNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { role, staffName, technicianName, pendingDeviceCount, refreshAuth } =
    useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const links = getNavLinks(role, pendingDeviceCount);
  const homeHref =
    role === "technician" ? "/jobs/pending?scope=my" : "/dashboard";
  const userSubtitle = getUserSubtitle(role, staffName, technicianName);
  const adminTab = searchParams.get("tab");
  const showUniversalSearch = Boolean(role);

  function handleUniversalSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/jobs/search?q=${encodeURIComponent(q)}` : "/jobs/search");
  }

  function isLinkActive(href: string) {
    if (href.startsWith("/admin")) {
      if (pathname !== "/admin") return false;
      if (href.includes("tab=devices")) return adminTab === "devices";
      if (href.includes("tab=reports")) return adminTab === "reports";
      // Settings: any admin tab except dedicated Devices/Reports nav targets
      return adminTab !== "reports" && adminTab !== "devices";
    }
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (href === "/jobs/pending") {
      return pathname === "/jobs/pending";
    }
    const baseHref = href.split("?")[0];
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshAuth();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-700 bg-emerald-900 px-3 py-2 shadow-sm">
        <div className="mx-auto max-w-lg space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Link href={homeHref} className="min-w-0">
              <h1 className="truncate text-sm font-bold uppercase tracking-wide text-white">
                {APP_NAME}
              </h1>
              {userSubtitle && (
                <p className="truncate text-xs text-emerald-200">{userSubtitle}</p>
              )}
            </Link>
            <button
              onClick={logout}
              className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-800 hover:text-white"
            >
              Logout
            </button>
          </div>
          {showUniversalSearch && (
            <form onSubmit={handleUniversalSearch} className="flex gap-1.5">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search UT, mobile, or name"
                className="h-8 min-w-0 flex-1 rounded-md border border-emerald-600 bg-emerald-950/40 px-2.5 text-sm text-white placeholder:text-emerald-300/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-white px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                Search
              </button>
            </form>
          )}
        </div>
      </header>
      <nav className="border-b border-emerald-700 bg-emerald-900">
        <div
          className={`mx-auto grid max-w-lg gap-1 p-2 ${
            links.length === 4 ? "grid-cols-4" : links.length === 3 ? "grid-cols-3" : "grid-cols-5"
          }`}
        >
          {links.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-1 py-2 text-center text-xs font-medium transition-colors ${
                  active
                    ? "bg-white text-emerald-800"
                    : "bg-emerald-700 text-white hover:bg-emerald-600"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
