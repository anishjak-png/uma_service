import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  addApplianceBrand,
  addApplianceComplaint,
  addApplianceAccessory,
  getApplianceLookups,
  removeApplianceBrand,
  removeApplianceComplaint,
  removeApplianceAccessory,
} from "@/lib/lookups";

function formatLookupApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    process.env.NODE_ENV === "development" &&
    (/applianceBrand|applianceComplaint|Cannot read properties of undefined/i.test(
      message
    ) ||
      message.includes("Unknown model"))
  ) {
    return "Dev server is using an outdated Prisma client. Stop npm run dev, run npx prisma generate, then start npm run dev again.";
  }

  if (process.env.NODE_ENV === "development") {
    return message;
  }

  return "Failed to load product lookups. Check database connection.";
}

export async function GET(request: NextRequest) {
  try {
    const applianceType = request.nextUrl.searchParams.get("applianceType")?.trim();

    if (!applianceType) {
      return NextResponse.json(
        { error: "applianceType query parameter required" },
        { status: 400 }
      );
    }

    const lookups = await getApplianceLookups(applianceType);
    return NextResponse.json(lookups);
  } catch (error) {
    console.error("GET /api/appliance-lookups failed:", error);
    return NextResponse.json(
      { error: formatLookupApiError(error) },
      { status: 503 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const applianceType = String(body.applianceType ?? "").trim();
    const category = body.category as "brand" | "complaint" | "accessory";
    const value = String(body.value ?? "").trim();

    if (!applianceType || !value) {
      return NextResponse.json(
        { error: "applianceType and value required" },
        { status: 400 }
      );
    }

    if (category !== "brand" && category !== "complaint" && category !== "accessory") {
      return NextResponse.json(
        { error: "category must be brand, complaint, or accessory" },
        { status: 400 }
      );
    }

    const result =
      category === "brand"
        ? await addApplianceBrand(applianceType, value)
        : category === "complaint"
          ? await addApplianceComplaint(applianceType, value)
          : await addApplianceAccessory(applianceType, value);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.mapping);
  } catch (error) {
    console.error("PUT /api/appliance-lookups failed:", error);
    return NextResponse.json(
      { error: formatLookupApiError(error) },
      { status: 503 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const applianceType = String(body.applianceType ?? "").trim();
    const category = body.category as "brand" | "complaint" | "accessory";
    const value = String(body.value ?? "").trim();

    if (!applianceType || !value) {
      return NextResponse.json(
        { error: "applianceType and value required" },
        { status: 400 }
      );
    }

    if (category !== "brand" && category !== "complaint" && category !== "accessory") {
      return NextResponse.json(
        { error: "category must be brand, complaint, or accessory" },
        { status: 400 }
      );
    }

    const result =
      category === "brand"
        ? await removeApplianceBrand(applianceType, value)
        : category === "complaint"
          ? await removeApplianceComplaint(applianceType, value)
          : await removeApplianceAccessory(applianceType, value);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/appliance-lookups failed:", error);
    return NextResponse.json(
      { error: formatLookupApiError(error) },
      { status: 503 }
    );
  }
}
