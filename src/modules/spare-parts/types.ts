export type SparePart = {
  id: string;
  name: string;
  code: string;
  category: string;
  brand: string;
  selling_price: number;
  created_at: string;
  updated_at: string;
};

export type SparePartImage = {
  id: string;
  spare_part_id: string;
  storage_path: string;
  sort_order: number;
  embedding_model: string;
  created_at: string;
  url?: string | null;
};

export type SparePartWithImages = SparePart & {
  images: SparePartImage[];
};

export type AppSettings = {
  confidence_threshold: number;
  ambiguity_margin: number;
  embedding_model: string;
};

export type MatchCandidate = {
  similarity: number;
  product: SparePartWithImages;
};

export type MatchResult = {
  confident: boolean;
  similarity: number | null;
  runnerUpSimilarity: number | null;
  meanSimilarity: number | null;
  product: SparePartWithImages | null;
  candidates: MatchCandidate[];
  message?: string;
};
