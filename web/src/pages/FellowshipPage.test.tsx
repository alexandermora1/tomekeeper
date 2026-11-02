import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FellowshipLists, ReaderCard } from '../api/fellowship';
import { fakeApi, problem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const tormod: ReaderCard = { handle: 'tormod', displayName: 'Tormod', portrait: 'astrologer', relation: 'friend', since: '2026-10-01T10:00:00Z' };
const kari: ReaderCard = { handle: 'kari', displayName: 'Kari', portrait: null, relation: 'asksYou', since: '2026-11-01T09:00:00Z' };
const ase: ReaderCard = { handle: 'ase-odegard', displayName: 'Åse Ødegård', portrait: 'knight', relation: 'asked', since: '2026-10-30T09:00:00Z' };
const settings = { handle: 'ingrid', bio: null, visibility: { progress: 'friends', reading: 'friends', reviews: 'friends', friends: 'friends' } };

describe('the fellowship page', () => {
  let lists: FellowshipLists;

  beforeEach(() => {
    lists = { friends: [tormod], askingYou: [kari], youAsked: [ase] };
    fakeApi.signedIn();
    fakeApi.on('GET', '/api/profile', { status: 200, body: settings });
    fakeApi.on('GET', '/api/fellowship', () => ({ status: 200, body: lists }));
  });

  it('lists friends, requests to answer and requests sent', async () => {
    renderApp('/fellowship');

    expect(await screen.findByRole('heading', { level: 1, name: 'Fellowship' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fellowship' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('link', { name: `${window.location.host}/readers/ingrid` })).toHaveAttribute('href', '/profile');
    const asking = screen.getByRole('region', { name: 'Asking to be your friend' });
    expect(within(asking).getByRole('link', { name: 'Kari' })).toHaveAttribute('href', '/readers/kari');
    expect(asking).toHaveTextContent('Asked on 1 November 2026');
    expect(within(asking).getByRole('button', { name: 'Accept Kari' })).toBeInTheDocument();
    expect(within(asking).getByRole('button', { name: 'Ignore Kari' })).toBeInTheDocument();
    const friends = screen.getByRole('region', { name: 'Your fellowship' });
    expect(friends).toHaveTextContent('Friends since 1 October 2026');
    expect(within(friends).getByRole('button', { name: 'Remove Tormod from your fellowship' })).toBeInTheDocument();
    const asked = screen.getByRole('region', { name: 'You asked' });
    expect(within(asked).getByRole('button', { name: 'Withdraw request to Åse Ødegård' })).toBeInTheDocument();
    await vi.waitFor(() => expect(document.title).toBe('Fellowship – Tomekeeper'));
  });

  it('accepts a request, moving the reader to the fellowship', async () => {
    const user = userEvent.setup();
    fakeApi.on('POST', '/api/fellowship/kari/accept', () => {
      lists = { friends: [{ ...kari, relation: 'friend' }, tormod], askingYou: [], youAsked: [ase] };
      return { status: 200, body: { relation: 'friend' } };
    });
    renderApp('/fellowship');

    await user.click(await screen.findByRole('button', { name: 'Accept Kari' }));

    expect(await screen.findByText('You and Kari are friends now.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Asking to be your friend' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Your fellowship' })).getByRole('link', { name: 'Kari' })).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByText('You and Kari are friends now.')).toHaveFocus());
  });

  it('asks before removing a friend', async () => {
    const user = userEvent.setup();
    fakeApi.on('DELETE', '/api/fellowship/tormod', () => {
      lists = { ...lists, friends: [] };
      return { status: 200, body: { relation: 'none' } };
    });
    renderApp('/fellowship');

    await user.click(await screen.findByRole('button', { name: 'Remove Tormod from your fellowship' }));
    const question = screen.getByText(/^Remove Tormod from your fellowship\?/);
    await vi.waitFor(() => expect(question).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Keep Tormod' }));
    expect(fakeApi.sent('DELETE', '/api/fellowship/tormod')).toHaveLength(0);
    expect(screen.getByText('Tormod is in your fellowship.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Tormod from your fellowship' }));
    await user.click(screen.getByRole('button', { name: 'Yes, remove Tormod' }));

    expect(await screen.findByText('Tormod is no longer in your fellowship.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your fellowship' })).toHaveTextContent('No friends yet.');
  });

  it('finds readers and asks one to be friends', async () => {
    const user = userEvent.setup();
    const found: ReaderCard[] = [
      { handle: 'ingvild', displayName: 'Ingvild', portrait: null, relation: 'none', since: null },
      { ...tormod, since: null },
    ];
    fakeApi.on('GET', '/api/readers', { status: 200, body: { readers: found } });
    fakeApi.on('POST', '/api/fellowship/ingvild/ask', { status: 200, body: { relation: 'asked' } });
    renderApp('/fellowship');

    await user.type(await screen.findByRole('searchbox', { name: 'Name or address' }), 'ing');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('2 readers found for “ing”.')).toBeInTheDocument();
    expect(fakeApi.sent('GET', '/api/readers')[0]?.search).toBe('?q=ing');
    const results = screen.getByRole('region', { name: 'Find readers' });
    expect(within(results).getByText('Tormod is in your fellowship.')).toBeInTheDocument();

    await user.click(within(results).getByRole('button', { name: 'Ask to be friends with Ingvild' }));

    const line = await within(results).findByText('You asked Ingvild to be friends.');
    await vi.waitFor(() => expect(line).toHaveFocus());
  });

  it('needs two letters to search', async () => {
    const user = userEvent.setup();
    renderApp('/fellowship');

    await user.type(await screen.findByRole('searchbox', { name: 'Name or address' }), 'i');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('searchbox', { name: 'Name or address' })).toHaveAccessibleDescription(
      'At least 2 letters, such as Ingrid or ingrid-reads. Error: Type at least 2 letters of a name or address.',
    );
    expect(fakeApi.sent('GET', '/api/readers')).toHaveLength(0);
  });

  it('says so when nobody matches, and when an answer fails', async () => {
    const user = userEvent.setup();
    fakeApi.on('GET', '/api/readers', { status: 200, body: { readers: [] } });
    fakeApi.on('POST', '/api/fellowship/kari/ignore', problem(404, 'Kari hasn’t asked you to be friends, or has withdrawn the request.'));
    renderApp('/fellowship');

    await user.type(await screen.findByRole('searchbox', { name: 'Name or address' }), 'zz');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No readers found for “zz”.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ignore Kari' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kari hasn’t asked you to be friends, or has withdrawn the request.');
  });
});
