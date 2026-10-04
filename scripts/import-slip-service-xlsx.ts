/**
 * Upsert SlipServiceValue from Karthi datewise Excel (Date + Service value).
 * Overwrites existing rows for the same calendar date.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/import-slip-service-xlsx.ts --file "C:\\path\\file.xlsx"
 */

import { execFileSync } from "child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "../src/lib/db";
import { isYmd, ymdToUtcDate } from "../src/lib/slip-service";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function parseDmy(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const ymd = `${match[3]}-${month}-${day}`;
  return isYmd(ymd) ? ymd : null;
}

function cellText(xml: string, row: number, col: string): string | null {
  const inline = new RegExp(
    `<c r="${col}${row}"[^>]*t="inlineStr"[^>]*>\\s*<is>\\s*<t[^>]*>([^<]*)</t>`,
    "i"
  );
  const inlineMatch = xml.match(inline);
  if (inlineMatch) return inlineMatch[1];

  const numeric = new RegExp(
    `<c r="${col}${row}"[^>]*>\\s*<v>([^<]*)</v>`,
    "i"
  );
  const numericMatch = xml.match(numeric);
  return numericMatch ? numericMatch[1] : null;
}

function parseSheet(xml: string): Array<{ date: string; amount: number }> {
  const dim = xml.match(/dimension ref="A1:B(\d+)"/i);
  const maxRow = dim ? Number(dim[1]) : 0;
  const rows: Array<{ date: string; amount: number }> = [];

  for (let row = 2; row <= maxRow; row += 1) {
    const dateRaw = cellText(xml, row, "A");
    const amountRaw = cellText(xml, row, "B");
    if (!dateRaw && !amountRaw) continue;
    const date = dateRaw ? parseDmy(dateRaw) : null;
    const amount = amountRaw != null && amountRaw !== "" ? Number(amountRaw) : NaN;
    if (!date || !Number.isFinite(amount) || amount < 0) {
      console.warn(`Skip row ${row}: date=${dateRaw ?? ""} amount=${amountRaw ?? ""}`);
      continue;
    }
    rows.push({ date, amount });
  }
  return rows;
}

function extractSheetXml(xlsxPath: string): string {
  const dir = mkdtempSync(join(tmpdir(), "slip-xlsx-"));
  try {
    const zipPath = join(dir, "book.zip");
    copyFileSync(xlsxPath, zipPath);
    execFileSync("tar", ["-xf", zipPath, "-C", dir], { stdio: "pipe" });
    return readFileSync(join(dir, "xl", "worksheets", "sheet1.xml"), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const file = argValue("--file");
  if (!file) {
    console.error("Pass --file path to the xlsx");
    process.exit(1);
  }

  const xml = extractSheetXml(file);
  const rows = parseSheet(xml);
  if (rows.length === 0) {
    console.error("No rows parsed");
    process.exit(1);
  }

  const dates = rows.map((row) => row.date).sort();
  console.log(`Parsed ${rows.length} rows, ${dates[0]} … ${dates[dates.length - 1]}`);

  let upserted = 0;
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((row) =>
        prisma.slipServiceValue.upsert({
          where: { date: ymdToUtcDate(row.date) },
          create: {
            date: ymdToUtcDate(row.date),
            amount: row.amount,
            enteredBy: "excel-import",
          },
          update: {
            amount: row.amount,
            enteredBy: "excel-import",
          },
        })
      )
    );
    upserted += batch.length;
    console.log(`Upserted ${upserted}/${rows.length}`);
  }

  console.log("Done");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
