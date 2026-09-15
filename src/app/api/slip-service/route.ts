import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSlipServiceAccess } from "@/lib/auth";
import { parseServiceAmount } from "@/lib/currency";
import { staffActorName } from "@/lib/jobs";
import {
  addDaysYmd,
  isYmd,
  shopTodayYmd,
  utcDateToYmd,
  ymdToUtcDate,
} from "@/lib/slip-service";

function serialize(row: {
  date: Date;
  amount: number;
  enteredBy: string | null;
  updatedAt: Date;
}) {
  return {
    date: utcDateToYmd(row.date),
    amount: row.amount,
    enteredBy: row.enteredBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const session = await requireSlipServiceAccess();
  if (!session) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const today = shopTodayYmd();
  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");
  const from = fromParam && isYmd(fromParam) ? fromParam : addDaysYmd(today, -40);
  const to = toParam && isYmd(toParam) ? toParam : today;

  if (from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const rows = await prisma.slipServiceValue.findMany({
    where: {
      date: {
        gte: ymdToUtcDate(from),
        lte: ymdToUtcDate(to),
      },
    },
    orderBy: { date: "desc" },
  });

  const todayRow = rows.find((row) => utcDateToYmd(row.date) === today);

  return NextResponse.json({
    today,
    from,
    to,
    todayAmount: todayRow?.amount ?? null,
    canEditExisting: session.role === "admin",
    entries: rows.map(serialize),
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireSlipServiceAccess();
  if (!session) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const today = shopTodayYmd();
  const date = typeof body.date === "string" ? body.date : today;

  if (!isYmd(date)) {
    return NextResponse.json({ error: "Valid date required" }, { status: 400 });
  }
  if (date > today) {
    return NextResponse.json(
      { error: "Cannot enter a future date" },
      { status: 400 }
    );
  }

  const amount = parseServiceAmount(body.amount);
  if (amount == null) {
    return NextResponse.json(
      { error: "Enter a valid amount (0 or more)" },
      { status: 400 }
    );
  }

  const enteredBy = staffActorName(session);
  const dateUtc = ymdToUtcDate(date);
  const existing = await prisma.slipServiceValue.findUnique({
    where: { date: dateUtc },
  });

  if (existing && session.role !== "admin") {
    return NextResponse.json(
      { error: "Only admin can edit a saved day's slip value" },
      { status: 403 }
    );
  }

  try {
    const row = existing
      ? await prisma.slipServiceValue.update({
          where: { date: dateUtc },
          data: { amount, enteredBy },
        })
      : await prisma.slipServiceValue.create({
          data: {
            date: dateUtc,
            amount,
            enteredBy,
          },
        });

    return NextResponse.json(serialize(row));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Slip value already entered for this date" },
        { status: 409 }
      );
    }
    throw error;
  }
}
