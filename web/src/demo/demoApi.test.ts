import { ApiError, apiRequest } from '../api/client';
import { fakeApi } from '../test/fakeApi';
import { DEMO_MESSAGE, DEMO_TODAY, demoAnswer, searchBooks, searchReaders } from './demoApi';

describe('the demo’s stand-in for the API', () => {
  it('answers with what the API answered when it was recorded', async () => {
    const me = (await demoAnswer('GET', '/api/account/me')) as { displayName: string };

    expect(me.displayName).toBe('Alex');
    expect(DEMO_TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('refuses every change, with a message the pages show', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const refused = demoAnswer(method, '/api/shelves/anything');
      await expect(refused).rejects.toBeInstanceOf(ApiError);
      await expect(refused).rejects.toMatchObject({ status: 403, message: DEMO_MESSAGE });
    }
  });

  it('says so when there is nothing recorded at an address, as the API would', async () => {
    await expect(demoAnswer('GET', '/api/readers/nobody-at-all')).rejects.toMatchObject({ status: 404 });
  });

  it('finds books in the example catalogue by title or author, without accents', () => {
    expect(searchBooks('erikson').results.map((r) => r.title)).toEqual(
      expect.arrayContaining(['Gardens of the Moon', 'Deadhouse Gates', 'Memories of Ice', 'House of Chains', 'Midnight Tides']),
    );
    expect(searchBooks('godel').results.map((r) => r.title)).toEqual(['Gödel, Escher, Bach']);
    const memories = searchBooks('memories of ice').results[0];
    expect(memories).toMatchObject({ shelf: 'reading', bookId: expect.any(String) });
    expect(searchBooks('a book nobody has written')).toMatchObject({ total: 0, results: [] });
  });

  it('needs two letters to search, like the API', () => {
    expect(() => searchBooks('e')).toThrow(ApiError);
    expect(() => searchReaders(' j ')).toThrow(ApiError);
  });

  it('finds the example readers by name or address', () => {
    expect(searchReaders('jo').map((r) => r.displayName)).toEqual(['Jonas']);
    expect(searchReaders('HENRIK')[0]).toMatchObject({ relation: 'asksYou' });
  });

  it('takes the place of the API in the demo build', async () => {
    vi.stubEnv('VITE_DEMO', 'true');
    try {
      const profile = await apiRequest<{ handle: string }>('GET', '/api/profile');
      expect(profile.handle).toBe('alex');
      expect(fakeApi.sent('GET', '/api/profile')).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
