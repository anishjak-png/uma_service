import { NextRequest, NextResponse } from "next/server";
import {
  claimPendingPrintJobs,
  verifyPrintAgentKey,
} from "@/lib/print-queue";
import { buildEscPosReceipt, buildReceiptData } from "@/lib/thermal";

export async function GET(request: NextRequest) {
  if (!verifyPrintAgentKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await claimPendingPrintJobs(10);

  const payload = jobs.map((job) => {
    const receiptData = buildReceiptData({
      jobNumber: job.jobCard.jobNumber,
      receivedAt: job.jobCard.receivedAt,
      customer: job.jobCard.customer,
      applianceType: job.jobCard.applianceType,
      brand: job.jobCard.brand,
      model: job.jobCard.model,
      complaint: job.jobCard.complaint,
    });

    return {
      id: job.id,
      jobCardId: job.jobCardId,
      jobNumber: job.jobCard.jobNumber,
      attempts: job.attempts,
      escPosBase64: buildEscPosReceipt(receiptData).toString("base64"),
    };
  });

  return NextResponse.json(payload);
}
