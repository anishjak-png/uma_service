import { getSpaSupabase } from "./supabase";
import type { AppSettings } from "../types";

const DEFAULTS: AppSettings = {
  confidence_threshold: 0.78,
  ambiguity_margin: 0.06,
  embedding_model: "voyage-multimodal-3.5",
};

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await getSpaSupabase()
    .from("spa_app_settings")
    .select("confidence_threshold, ambiguity_margin, embedding_model")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULTS;
  return {
    confidence_threshold: Number(data.confidence_threshold),
    ambiguity_margin: Number(data.ambiguity_margin),
    embedding_model: data.embedding_model,
  };
}
