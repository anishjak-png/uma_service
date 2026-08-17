import { randomUUID } from "node:crypto";
import { MAX_REFERENCE_IMAGES } from "../constants";
import { embedImage, embeddingToSql } from "./embedder";
import { nextSortOrder } from "./parts";
import { deleteObject, uploadJpeg } from "./storage";
import { getSpaSupabase } from "./supabase";

export async function addReferenceImage(partId: string, jpeg: Buffer) {
  const sortOrder = await nextSortOrder(partId);
  if (sortOrder > MAX_REFERENCE_IMAGES) {
    throw new Error("Each part can have at most 3 reference photos.");
  }

  const { embedding, model } = await embedImage(jpeg);
  const imageId = randomUUID();
  const storagePath = `parts/${partId}/${imageId}.jpg`;
  await uploadJpeg(storagePath, jpeg);

  const { data, error } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .insert({
      id: imageId,
      spare_part_id: partId,
      storage_path: storagePath,
      sort_order: sortOrder,
      embedding: embeddingToSql(embedding),
      embedding_model: model,
    })
    .select("id, spare_part_id, storage_path, sort_order, embedding_model, created_at")
    .single();

  if (error) {
    await deleteObject(storagePath).catch(() => undefined);
    throw error;
  }
  return data;
}

export async function replaceReferenceImage(imageId: string, jpeg: Buffer) {
  const { data: existing, error } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .select("id, spare_part_id, storage_path, sort_order")
    .eq("id", imageId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) throw new Error("Image not found");

  const { embedding, model } = await embedImage(jpeg);
  await uploadJpeg(existing.storage_path, jpeg);

  const { data, error: updateError } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .update({
      embedding: embeddingToSql(embedding),
      embedding_model: model,
    })
    .eq("id", imageId)
    .select("id, spare_part_id, storage_path, sort_order, embedding_model, created_at")
    .single();
  if (updateError) throw updateError;
  return data;
}

export async function removeReferenceImage(imageId: string) {
  const { data: existing, error } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .select("id, spare_part_id, storage_path, sort_order")
    .eq("id", imageId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) throw new Error("Image not found");

  await deleteObject(existing.storage_path).catch(() => undefined);
  const { error: deleteError } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .delete()
    .eq("id", imageId);
  if (deleteError) throw deleteError;

  const { data: remaining, error: remainingError } = await getSpaSupabase()
    .from("spa_spare_part_images")
    .select("id, sort_order")
    .eq("spare_part_id", existing.spare_part_id)
    .order("sort_order", { ascending: true });
  if (remainingError) throw remainingError;

  for (let index = 0; index < (remaining ?? []).length; index += 1) {
    const row = remaining![index];
    if (row.sort_order !== index + 1) {
      await getSpaSupabase()
        .from("spa_spare_part_images")
        .update({ sort_order: index + 1 })
        .eq("id", row.id);
    }
  }
}
