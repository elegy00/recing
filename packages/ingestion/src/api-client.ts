import type { RecipeExtraction } from "@recing/schema";
import type { JobStatus, LlmErrorCode } from "@recing/schema";

/** A job returned by the web API's GET /api/recipes endpoint. */
export interface WebJob {
  _id: string;
  url: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  result: unknown | null;
  error?: string | null;
}

/** Configuration for the web API client. */
export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
}

class ApiClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Fetch all pending jobs from the web API. */
export async function fetchPendingJobs(config: ApiClientConfig): Promise<WebJob[]> {
  const res = await fetch(`${config.baseUrl}/api/recipes?status=PENDING`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });

  if (!res.ok) {
    throw new ApiClientError(res.status, `Failed to fetch pending jobs: ${res.statusText}`);
  }

  const data = await res.json() as { recipes: WebJob[] };
  return data.recipes;
}

/** Submit a new recipe URL job to the web API. */
export async function submitJob(config: ApiClientConfig, url: string): Promise<string> {
  const res = await fetch(`${config.baseUrl}/api/recipes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    throw new ApiClientError(res.status, `Failed to submit job: ${res.statusText}`);
  }

  const data = await res.json() as { jobId: string };
  return data.jobId;
}

/** Post an extraction result back to the web API. */
export async function postResult(
  config: ApiClientConfig,
  jobId: string,
  extraction: RecipeExtraction,
  metadata: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${config.baseUrl}/api/recipes/${jobId}/result`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ result: extraction, isValid: true }),
  });

  if (!res.ok) {
    throw new ApiClientError(res.status, `Failed to post result: ${res.statusText}`);
  }
}

/** Report a failed job back to the web API. */
export async function reportFailure(
  config: ApiClientConfig,
  jobId: string,
  errorCode: LlmErrorCode,
  errorMessage: string
): Promise<void> {
  const res = await fetch(`${config.baseUrl}/api/recipes/${jobId}/result`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      isValid: false,
      error: errorMessage,
      errorCode,
    }),
  });

  if (!res.ok) {
    throw new ApiClientError(res.status, `Failed to report failure: ${res.statusText}`);
  }
}
