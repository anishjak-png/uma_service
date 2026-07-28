export type MetaHttpRequest = {
  url: string;
  accessToken: string;
  body: Record<string, unknown>;
  diagnosticContext?: "test-connection";
};

export type MetaHttpResponse = {
  httpStatus: number;
  bodyText: string;
  executionTimeMs: number;
};

export async function postMetaCloudApi(
  request: MetaHttpRequest
): Promise<MetaHttpResponse> {
  const startedAt = Date.now();
  const isTestDiagnostic = request.diagnosticContext === "test-connection";

  if (isTestDiagnostic) {
    console.log("[TestConnection] postMetaCloudApi — HTTP POST", {
      url: request.url,
      payload: request.body,
    });
  }

  const res = await fetch(request.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request.body),
  });

  const bodyText = await res.text();

  if (isTestDiagnostic) {
    console.log("[TestConnection] postMetaCloudApi — HTTP response", {
      url: request.url,
      httpStatus: res.status,
      responseBody: bodyText,
      executionTimeMs: Date.now() - startedAt,
    });
  }

  return {
    httpStatus: res.status,
    bodyText,
    executionTimeMs: Date.now() - startedAt,
  };
}

/** Safe request payload for logs — never includes Authorization or tokens. */
export function serializeRequestForLog(
  url: string,
  body: Record<string, unknown>
): string {
  return JSON.stringify({ url, body });
}
