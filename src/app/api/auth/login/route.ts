import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isValidMobile,
  normalizeMobile,
  verifyPassword,
} from "@/lib/password";
import {
  countApprovedDevices,
  staffRoleToSessionRole,
  upsertStaffDevice,
} from "@/lib/staff-auth";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const mobileRaw = body.mobile;
  const password = body.password;
  const deviceId = body.deviceId;
  const deviceLabel = body.deviceLabel;
  const platform = body.platform === "android" ? "android" : "web";

  if (
    !mobileRaw ||
    typeof mobileRaw !== "string" ||
    !password ||
    typeof password !== "string" ||
    !deviceId ||
    typeof deviceId !== "string"
  ) {
    return NextResponse.json(
      { error: "Mobile, password, and device ID are required" },
      { status: 400 }
    );
  }

  if (!isValidMobile(mobileRaw)) {
    return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
  }

  const mobile = normalizeMobile(mobileRaw);
  const staffUser = await prisma.staffUser.findUnique({
    where: { mobile },
    include: { technician: true },
  });

  if (!staffUser || !staffUser.active) {
    return NextResponse.json(
      { error: "Invalid mobile or password" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, staffUser.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid mobile or password" },
      { status: 401 }
    );
  }

  const approvedCount = await countApprovedDevices();
  const autoApprove =
    staffUser.role === "admin" && approvedCount === 0;

  const device = await upsertStaffDevice({
    staffUserId: staffUser.id,
    deviceId: deviceId.trim(),
    deviceLabel: typeof deviceLabel === "string" ? deviceLabel : null,
    platform,
    autoApprove,
    approvedById: autoApprove ? staffUser.id : undefined,
  });

  const session = await getSession();
  session.isLoggedIn = true;
  session.staffUserId = staffUser.id;
  session.staffName = staffUser.name;
  session.role = staffRoleToSessionRole(staffUser.role);
  session.deviceId = device.deviceId;
  session.deviceStatus = device.status;

  if (staffUser.role === "technician" && staffUser.technician) {
    session.technicianId = staffUser.technician.id;
    session.technicianName = staffUser.technician.name;
  } else {
    session.technicianId = undefined;
    session.technicianName = undefined;
  }

  await session.save();

  if (device.status === "pending") {
    return NextResponse.json(
      {
        error: "device_pending",
        deviceStatus: "pending",
        staffName: staffUser.name,
        role: session.role,
      },
      { status: 403 }
    );
  }

  if (device.status === "revoked") {
    return NextResponse.json(
      { error: "device_revoked", deviceStatus: "revoked" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    role: session.role,
    staffName: staffUser.name,
    deviceStatus: device.status,
    technicianId: session.technicianId,
    technicianName: session.technicianName,
  });
}
