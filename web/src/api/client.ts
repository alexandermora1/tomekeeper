/**
 * A small wrapper around fetch for Tomekeeper's own API.
 *
 * - Every request carries the X-Tomekeeper-Request header. The API refuses changes without it, and a form
 *   on another site can't add it, so other sites can't act on a signed-in reader's behalf.
 * - The sign-in cookie is HttpOnly and same-site, so the browser sends it by itself. The front-end never
 *   sees a token.
 * - Errors come back as problem details (RFC 9457) and are thrown as ApiError.
 */

export const REQUEST_HEADER = 'X-Tomekeeper-Request';

/** The error format the API uses. `errors` holds messages per form field. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

/** The API answered, but with an error status. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `The request failed with status ${status}.`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }

  /** Messages per field, such as `{ email: ['Enter your email address.'] }`. Empty when there are none. */
  get fieldErrors(): Record<string, string[]> {
    return this.problem.errors ?? {};
  }
}

/** The API couldn't be reached at all: the reader is offline, or the server is down. */
export class NetworkError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Tomekeeper could not be reached.', options);
    this.name = 'NetworkError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Sends a request to the API and returns the JSON answer, or `undefined` when there is none (204 No Content).
 * Throws ApiError for error answers and NetworkError when the API can't be reached.
 */
export async function apiRequest<T = undefined>(method: Method, path: string, body?: unknown): Promise<T> {
  // The demo build answers from recorded data (src/demo). Other builds leave this out entirely.
  if (import.meta.env.VITE_DEMO === 'true') return (await (await import('../demo/demoApi')).demoAnswer(method, path)) as T;
  const headers: Record<string, string> = { Accept: 'application/json', [REQUEST_HEADER]: '1' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch (cause) {
    throw new NetworkError({ cause });
  }

  if (!response.ok) throw new ApiError(response.status, await readProblem(response));

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  const fallback: ProblemDetails = { status: response.status, title: response.statusText || undefined };
  if (!(response.headers.get('Content-Type') ?? '').includes('json')) return fallback;
  try {
    return { ...fallback, ...((await response.json()) as ProblemDetails) };
  } catch {
    return fallback;
  }
}
