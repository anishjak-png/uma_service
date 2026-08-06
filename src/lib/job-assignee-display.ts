type StaffRole = "admin" | "reception" | "technician" | null;

export function shouldShowJobAssignee(
  status: string,
  role: StaffRole,
  technicianScope: "my" | "all" = "my"
): boolean {
  if (
    status === "Outsourced" ||
    status === "WarrantyPending" ||
    status === "WarrantyWithCompany"
  ) {
    return false;
  }
  if (role === "admin" || role === "reception") return true;
  if (role === "technician" && technicianScope === "all") return true;
  return false;
}

export function jobAssigneeName(
  assignedTechnician?: { name: string } | null
): string | null {
  return assignedTechnician?.name ?? null;
}

/** Ready/Return jobs always show amount when set; others follow showServiceAmount. */
export function shouldShowJobServiceAmount(
  status: string,
  serviceAmount: number | null | undefined,
  showServiceAmount: boolean
): boolean {
  if (serviceAmount == null) return false;
  if (status === "Ready" || status === "Return") return true;
  return showServiceAmount;
}
