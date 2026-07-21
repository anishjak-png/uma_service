import { NextRequest, NextResponse } from "next/server";
import { roleFromPin, getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }

  const role = roleFromPin(pin);
  if (!role) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const session = await getSession();
  session.role = role;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ role });
}
