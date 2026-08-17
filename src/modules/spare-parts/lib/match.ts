import { embeddingToSql } from "./embedder";
import { getPart } from "./parts";
import { getSettings } from "./settings";
import { getSpaSupabase } from "./supabase";
import type { MatchCandidate, MatchResult } from "../types";
import { TOP_MATCH_THRESHOLD, type ReferenceLimit } from "../constants";

type ImageHit = {
  id: string;
  spare_part_id: string;
  similarity: number;
  sort_order: number;
  storage_path: string;
};

type ProductScore = {
  sparePartId: string;
  maxSimilarity: number;
  meanSimilarity: number;
};

export async function matchSparePart(
  embedding: number[],
  referenceLimit: ReferenceLimit = 3,
): Promise<MatchResult> {
  const settings = await getSettings();
  const { data, error } = await getSpaSupabase().rpc("spa_match_spare_part_images", {
    query_embedding: embeddingToSql(embedding),
    reference_limit: referenceLimit,
    match_count: 30,
  });

  if (error) throw error;
  const hits = (data ?? []) as ImageHit[];
  if (hits.length === 0) {
    return {
      confident: false,
      similarity: null,
      runnerUpSimilarity: null,
      meanSimilarity: null,
      product: null,
      candidates: [],
      message: "Unable to confidently identify this part. Please take another photo.",
    };
  }

  const grouped = new Map<string, number[]>();
  for (const hit of hits) {
    const list = grouped.get(hit.spare_part_id) ?? [];
    list.push(Number(hit.similarity));
    grouped.set(hit.spare_part_id, list);
  }

  const scores: ProductScore[] = [...grouped.entries()].map(([sparePartId, values]) => ({
    sparePartId,
    maxSimilarity: Math.max(...values),
    meanSimilarity: values.reduce((sum, value) => sum + value, 0) / values.length,
  }));
  scores.sort((a, b) => b.maxSimilarity - a.maxSimilarity);

  const top = scores[0];
  const runner = scores[1];
  const gap = top.maxSimilarity - (runner?.maxSimilarity ?? 0);
  const confident =
    top.maxSimilarity >= Math.max(settings.confidence_threshold, TOP_MATCH_THRESHOLD) &&
    gap >= settings.ambiguity_margin;

  const topScores = scores.slice(0, 3);
  const loaded = await Promise.all(
    topScores.map(async (score) => {
      const product = await getPart(score.sparePartId);
      if (!product) return null;
      return { similarity: score.maxSimilarity, product } satisfies MatchCandidate;
    }),
  );
  const candidates = loaded.filter((item): item is MatchCandidate => item != null);

  return {
    confident,
    similarity: top.maxSimilarity,
    runnerUpSimilarity: runner?.maxSimilarity ?? null,
    meanSimilarity: top.meanSimilarity,
    product: candidates[0]?.product ?? null,
    candidates,
    message: confident
      ? undefined
      : top.maxSimilarity < TOP_MATCH_THRESHOLD
        ? "Below 80% — closest matches. Take another photo if none of these look right."
        : "Unable to confidently identify this part. Please take another photo.",
  };
}
