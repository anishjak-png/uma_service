import { NextResponse } from "next/server";
import { enqueueSalePrint } from "@/lib/print-queue";
import { asErrorMessage, jsonError, requireSparePartsAdmin } from "../lib/http";
import { createSale, type SaleItemInput } from "../lib/sales";
import { buildSaleReceiptData } from "../lib/thermal-sale";

export async function POST(request: Request) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json()) as { items?: SaleItemInput[] };
    const sale = await createSale(body.items ?? []);
    const printJob = await enqueueSalePrint(buildSaleReceiptData(sale));
    return NextResponse.json(
      { sale: { ...sale, printJobId: printJob.id }, printJobId: printJob.id },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
