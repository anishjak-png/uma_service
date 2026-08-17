import { getSpaSupabase } from "./supabase";
import { signedUrl, signedUrls } from "./storage";
import type { SparePart, SparePartImage, SparePartWithImages } from "../types";

function toPart(row: Record<string, unknown>): SparePart {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    category: String(row.category ?? ""),
    brand: String(row.brand ?? ""),
    selling_price: Number(row.selling_price ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toImage(row: Record<string, unknown>, url?: string | null): SparePartImage {
  return {
    id: String(row.id),
    spare_part_id: String(row.spare_part_id),
    storage_path: String(row.storage_path),
    sort_order: Number(row.sort_order),
    embedding_model: String(row.embedding_model),
    created_at: String(row.created_at),
    url: url ?? null,
  };
}

export async function listParts(search = ""): Promise<SparePartWithImages[]> {
  let query = getSpaSupabase()
    .from("spa_spare_parts")
    .select("*")
    .order("created_at", { ascending: false });

  const term = search.trim().replace(/[%_,()]/g, " ").slice(0, 80);
  if (term) {
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,brand.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const parts = (data ?? []).map(toPart);
  if (parts.length === 0) return [];

  const { data: images, error: imageError } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .select("id, spare_part_id, storage_path, sort_order, embedding_model, created_at")
    .in(
      "spare_part_id",
      parts.map((part) => part.id),
    )
    .order("sort_order", { ascending: true });
  if (imageError) throw imageError;

  const urls = await signedUrls((images ?? []).map((row) => String(row.storage_path)));
  const byPart = new Map<string, SparePartImage[]>();
  for (const row of images ?? []) {
    const list = byPart.get(String(row.spare_part_id)) ?? [];
    list.push(toImage(row, urls[String(row.storage_path)] ?? null));
    byPart.set(String(row.spare_part_id), list);
  }

  return parts.map((part) => ({ ...part, images: byPart.get(part.id) ?? [] }));
}

export async function getPart(id: string): Promise<SparePartWithImages | null> {
  const { data, error } = await getSpaSupabase()
    .from("spa_spare_parts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: images, error: imageError } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .select("id, spare_part_id, storage_path, sort_order, embedding_model, created_at")
    .eq("spare_part_id", id)
    .order("sort_order", { ascending: true });
  if (imageError) throw imageError;

  const withUrls: SparePartImage[] = [];
  for (const row of images ?? []) {
    withUrls.push(toImage(row, await signedUrl(String(row.storage_path))));
  }
  return { ...toPart(data), images: withUrls };
}

export async function createPart(input: {
  name: string;
  code: string;
  category: string;
  brand: string;
  selling_price: number;
}): Promise<SparePart> {
  const { data, error } = await getSpaSupabase()
    .from("spa_spare_parts")
    .insert({
      name: input.name,
      code: input.code,
      category: input.category,
      brand: input.brand,
      selling_price: input.selling_price,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toPart(data);
}

export async function updatePart(
  id: string,
  input: {
    name: string;
    code: string;
    category: string;
    brand: string;
    selling_price: number;
  },
): Promise<SparePart> {
  const { data, error } = await getSpaSupabase()
    .from("spa_spare_parts")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return toPart(data);
}

export async function deletePart(id: string): Promise<void> {
  const { error } = await getSpaSupabase().from("spa_spare_parts").delete().eq("id", id);
  if (error) throw error;
}

export async function nextSortOrder(partId: string): Promise<number> {
  const { data, error } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .select("sort_order")
    .eq("spare_part_id", partId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.sort_order ?? 0) + 1;
}
