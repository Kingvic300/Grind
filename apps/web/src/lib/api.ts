export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * The app always calls the API on its own origin: the Vite proxy forwards /api in dev and a
 * Vercel rewrite forwards it in production. That keeps the session cookie first-party, which
 * mobile browsers (Safari and every iOS browser) require: they drop cross-site cookies even
 * with SameSite=None, so logins appeared to work but every later request came back 401.
 */
export const API_URL = '';

/** Direct API address for links used outside the app, such as calendar feeds. */
export const PUBLIC_API_URL = import.meta.env.DEV ? '' : 'https://grind-c1o3.onrender.com';

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
