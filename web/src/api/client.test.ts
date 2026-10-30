import { fakeApi, problem, validationProblem } from '../test/fakeApi';
import { ApiError, apiRequest, NetworkError, REQUEST_HEADER } from './client';

describe('apiRequest', () => {
  it('sends JSON with the request header the API requires', async () => {
    fakeApi.on('POST', '/api/thing', { status: 201, body: { id: 7 } });

    const result = await apiRequest<{ id: number }>('POST', '/api/thing', { name: 'Quire' });

    expect(result).toEqual({ id: 7 });
    const [request] = fakeApi.sent('POST', '/api/thing');
    expect(request?.body).toEqual({ name: 'Quire' });
    expect(request?.headers.get(REQUEST_HEADER)).toBe('1');
    expect(request?.headers.get('Content-Type')).toBe('application/json');
  });

  it('returns undefined for 204 No Content', async () => {
    fakeApi.on('POST', '/api/thing', { status: 204 });
    await expect(apiRequest('POST', '/api/thing')).resolves.toBeUndefined();
  });

  it('throws ApiError with the messages per field', async () => {
    fakeApi.on('POST', '/api/thing', validationProblem({ email: ['Enter your email address.'] }));

    const error = await apiRequest('POST', '/api/thing', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).fieldErrors).toEqual({ email: ['Enter your email address.'] });
  });

  it('uses the problem detail as the message', async () => {
    fakeApi.on('POST', '/api/thing', problem(401, "That email and password don't match an account."));
    await expect(apiRequest('POST', '/api/thing')).rejects.toThrow("That email and password don't match an account.");
  });

  it('throws NetworkError when the API cannot be reached', async () => {
    fakeApi.on('GET', '/api/thing', 'network-error');
    await expect(apiRequest('GET', '/api/thing')).rejects.toBeInstanceOf(NetworkError);
  });
});
