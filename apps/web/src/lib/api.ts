export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Deployed API. Local dev uses a relative path so the Vite proxy forwards to localhost:3000. */
export const API_URL = import.meta.env.DEV ? '' : 'https://grind-c1o3.onrender.com';

/** Calls the Grind API and returns the parsed JSON body. Throws ApiError with a readable message. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('Grind could not reach the server. Check your connection and try again.', 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = data?.message;
    const message = Array.isArray(raw) ? raw.join(' ') : (raw ?? 'Something went wrong. Try again.');
    throw new ApiError(res.status === 429 ? 'Too many attempts. Wait a minute and try again.' : message, res.status);
  }
  return data as T;
}
