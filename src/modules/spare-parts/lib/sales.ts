import { getSpaSupabase } from "./supabase";

export type SaleItemInput = {
  spare_part_id: string;
  name: string;
  code: string;
  unit_price: number;
  qty: number;
};

export async function createSale(items: SaleItemInput[]) {
  if (items.length === 0) throw new Error("Add at least one item");
  const lines = items.map((item) => ({
    ...item,
    qty: Math.max(1, Math.round(item.qty)),
    unit_price: Number(item.unit_price) || 0,
    line_total: Math.max(1, Math.round(item.qty)) * (Number(item.unit_price) || 0),
  }));
  const total = lines.reduce((sum, line) => sum + line.line_total, 0);
  const billNo = `SPA-${Date.now().toString().slice(-8)}`;

  const { data: sale, error } = await getSpaSupabase()
    .from("spa_sales")
    .insert({ bill_no: billNo, total })
    .select("id, bill_no, total, created_at")
    .single();
  if (error) throw error;

  const { error: itemError } = await getSpaSupabase().from("spa_sale_items").insert(
    lines.map((line) => ({
      sale_id: sale.id,
      spare_part_id: line.spare_part_id,
      name: line.name,
      code: line.code,
      unit_price: line.unit_price,
      qty: line.qty,
      line_total: line.line_total,
    })),
  );
  if (itemError) throw itemError;

  return {
    id: sale.id as string,
    bill_no: sale.bill_no as string,
    total: Number(sale.total),
    created_at: sale.created_at as string,
    items: lines.map((line) => ({
      name: line.name,
      code: line.code,
      qty: line.qty,
      unit_price: line.unit_price,
      line_total: line.line_total,
    })),
  };
}
