export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error(
      response.ok
        ? "Empty response from server"
        : `Request failed (${response.status})`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? "Invalid JSON response from server"
        : text.slice(0, 200) || `Request failed (${response.status})`,
    );
  }
}

export function formatApiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  if (/Can't reach database server/i.test(message)) {
    return "Cannot reach PostgreSQL. Start Postgres on localhost:5432 and ensure DATABASE_URL is correct.";
  }
  return message.replace(/\s+/g, " ").trim() || fallback;
}

