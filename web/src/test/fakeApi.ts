import type { Reader } from '../api/account';

/**
 * A stand-in for the API in tests. It replaces `fetch`, answers the routes a test sets up with `on()`,
 * and records every request so the test can check what was sent.
 *
 * By default nobody is signed in (GET /api/account/me answers 401) and every other route answers 404.
 */

export interface RecordedRequest {
  method: string;
  path: string;
  search: string;
  body: unknown;
  headers: Headers;
}

export interface FakeResponse {
  status: number;
  body?: unknown;
}

/** An answer, a function that makes one from the request, or 'network-error' to act as if the API is down. */
type Responder = FakeResponse | ((request: RecordedRequest) => FakeResponse) | 'network-error';

export const sampleReader: Reader = {
  id: '01a18876-6037-7327-a574-7e6c7a1054a2',
  displayName: 'Ingrid',
  email: 'ingrid@example.no',
  emailConfirmed: true,
};

export function problem(status: number, detail: string, title = "That didn't work"): FakeResponse {
  return { status, body: { title, status, detail } };
}

export function validationProblem(errors: Record<string, string[]>): FakeResponse {
  return { status: 400, body: { title: 'Some fields need attention.', status: 400, errors } };
}

class FakeApi {
  requests: RecordedRequest[] = [];
  private routes = new Map<string, Responder>();

  reset() {
    this.requests = [];
    this.routes.clear();
    this.signedOut();
  }

  on(method: string, path: string, responder: Responder) {
    this.routes.set(`${method} ${path}`, responder);
    return this;
  }

  signedIn(reader: Reader = sampleReader) {
    return this.on('GET', '/api/account/me', { status: 200, body: reader });
  }

  signedOut() {
    return this.on('GET', '/api/account/me', { status: 401 });
  }

  /** The requests sent to one route, oldest first. */
  sent(method: string, path: string) {
    return this.requests.filter((r) => r.method === method && r.path === path);
  }

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
    const request: RecordedRequest = {
      method: (init.method ?? 'GET').toUpperCase(),
      path: url.pathname,
      search: url.search,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: new Headers(init.headers),
    };
    this.requests.push(request);

    const responder = this.routes.get(`${request.method} ${request.path}`) ?? { status: 404 };
    if (responder === 'network-error') throw new TypeError('Failed to fetch');
    const response = typeof responder === 'function' ? responder(request) : responder;

    if (response.body === undefined) return new Response(null, { status: response.status });
    const type = response.status >= 400 ? 'application/problem+json' : 'application/json';
    return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'Content-Type': type } });
  };
}

export const fakeApi = new FakeApi();
