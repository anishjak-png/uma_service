"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SHOP_NAME } from "@/lib/constants";

type StaffRole = "reception" | "technician" | "admin";

const receptionLinks = [
  { href: "/dashboard", label: "Home" },
  { href: "/jobs/new", label: "New Job" },
  { href: "/jobs/delivery", label: "Delivery" },
  { href: "/jobs/search", label: "Search" },
  { href: "/whatsapp-pending", label: "WhatsApp" },
];

const technicianLinks = [
  { href: "/jobs/pending", label: "Pending" },
  { href: "/jobs/search", label: "Search" },
];

const adminLinks = [
  { href: "/dashboard", label: "Home" },
  { href: "/jobs/new", label: "New Job" },
  { href: "/jobs/delivery", label: "Delivery" },
  { href: "/jobs/pending", label: "Pending" },
  { href: "/jobs/search", label: "Search" },
  { href: "/whatsapp-pending", label: "WhatsApp" },
  { href: "/admin", label: "Admin" },
];

export function AppNav({ whatsappPending = 0 }: { whatsappPending?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [technicianName, setTechnicianName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.isLoggedIn) {
          setRole(data.role);
          setTechnicianName(data.technicianName ?? null);
        }
      });
  }, []);

  const links =
    role === "technician"
      ? technicianLinks
      : role === "admin"
        ? adminLinks
        : receptionLinks;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-orange-200 bg-orange-600 text-white shadow-md">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs font-medium text-orange-100">Home Appliance Service</p>
          <h1 className="text-lg font-bold">{SHOP_NAME}</h1>
          {technicianName && (
            <p className="text-xs text-orange-100">{technicianName}</p>
          )}
        </div>
        <button
          onClick={logout}
          className="rounded-lg bg-orange-700 px-3 py-1.5 text-sm font-medium hover:bg-orange-800"
        >
          Logout
        </button>
      </div>
      <nav className="mx-auto flex max-w-lg overflow-x-auto px-2 pb-2">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const isWhatsApp = link.href === "/whatsapp-pending";
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative mr-1 shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
                active ? "bg-white text-orange-700" : "text-orange-100 hover:bg-orange-500"
              }`}
            >
              {link.label}
              {isWhatsApp && whatsappPending > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {whatsappPending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
