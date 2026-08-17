import { EMBEDDING_DIMS, EMBEDDING_MODEL } from "../constants";

export { EMBEDDING_MODEL };

type VoyageResponse = {
  data?: { embedding: number[] }[];
  detail?: string;
  message?: string;
};

export async function embedImage(
  buffer: Buffer,
  mimeType = "image/jpeg",
): Promise<{ embedding: number[]; model: string }> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error("VOYAGE_API_KEY is not set. Add it to .env to generate embeddings.");
  }

  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const response = await fetch("https://api.voyageai.com/v1/multimodalembeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      output_dimension: EMBEDDING_DIMS,
      inputs: [
        {
          content: [{ type: "image_base64", image_base64: dataUrl }],
        },
      ],
    }),
  });

  const payload = (await response.json()) as VoyageResponse;
  if (!response.ok) {
    throw new Error(
      payload.detail || payload.message || `Voyage embedding failed (${response.status})`,
    );
  }

  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Unexpected embedding size ${embedding?.length ?? 0}; expected ${EMBEDDING_DIMS}`,
    );
  }

  return { embedding: l2Normalize(embedding), model: EMBEDDING_MODEL };
}

export function l2Normalize(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (!norm) return embedding;
  return embedding.map((value) => value / norm);
}

export function embeddingToSql(embedding: number[]): string {
  return `[${l2Normalize(embedding).join(",")}]`;
}
