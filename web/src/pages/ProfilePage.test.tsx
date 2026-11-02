import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProfileSettings, ReaderProfile, VisibilitySettings } from '../api/profile';
import { fakeApi, sampleReader, validationProblem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const YEAR = new Date().getFullYear();
const visibility: VisibilitySettings = { progress: 'friends', reading: 'everyone', reviews: 'friends', friends: 'onlyYou' };
const settings: ProfileSettings = { handle: 'ingrid', bio: 'Slow reader of long books.', visibility };

const own: ReaderProfile = {
  handle: 'ingrid',
  displayName: sampleReader.displayName,
  portrait: 'knight',
  bio: 'Slow reader of long books.',
  since: 2025,
  viewedAs: 'you',
  isOwner: true,
  year: { year: YEAR, pagesRead: 4200, goalPages: 10000, booksFinished: 7, level: 9, title: 'Reader' },
  readingNow: [{ bookId: '01a18876-0000-7000-8000-000000000001', title: 'Memories of Ice', authors: ['Steven Erikson'], percent: 54 }],
  volumes: [
    { year: YEAR, pages: 4200, books: 7, level: 9, quests: 1 },
    { year: YEAR - 1, pages: 9100, books: 15, level: 12, quests: 3 },
  ],
  somethingHidden: false,
  visibility,
  relation: null,
  fellowship: [{ handle: 'tormod', displayName: 'Tormod', portrait: null, relation: 'friend', since: '2026-10-01T10:00:00Z' }],
};

// Reading now is shared with everyone; the rest is for friends.
const asStranger: ReaderProfile = {
  ...own,
  viewedAs: 'stranger',
  year: null,
  volumes: null,
  somethingHidden: true,
  visibility: null,
  fellowship: null,
};

describe('the profile page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', '/api/profile', { status: 200, body: settings });
    fakeApi.on('GET', '/api/readers/ingrid', (request) => ({
      status: 200,
      body: request.search === '?as=stranger' ? asStranger : request.search === '?as=friend' ? { ...own, viewedAs: 'friend', visibility: null } : own,
    }));
  });

  it('shows your own profile with its address and who can see each part', async () => {
    renderApp('/profile');

    expect(await screen.findByRole('heading', { level: 1, name: sampleReader.displayName })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.host}/readers/ingrid`)).toBeInTheDocument();
    expect(screen.getByText('Slow reader of long books.')).toBeInTheDocument();
    expect(screen.getByText('Keeping a chronicle since 2025')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile/edit');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');

    const year = screen.getByRole('region', { name: 'The year so far' });
    expect(year).toHaveTextContent('4,200 pages of a 10,000-page goal · 42 percent');
    expect(year).toHaveTextContent('7 books finished · Level 9, Reader');
    expect(year).toHaveTextContent('Visible to: Friends');
    const reading = screen.getByRole('region', { name: 'Reading now' });
    expect(within(reading).getByRole('link', { name: 'Memories of Ice' })).toBeInTheDocument();
    expect(reading).toHaveTextContent('Steven Erikson · 54 percent');
    expect(reading).toHaveTextContent('Visible to: Everyone');
    expect(screen.getByRole('region', { name: 'Volumes' })).toHaveTextContent('Still being written');

    const who = screen.getByRole('region', { name: 'Who can see what' });
    expect(within(within(who).getByRole('group', { name: 'Fellowship' })).getByRole('radio', { name: 'Only you' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'You' })).toHaveAttribute('aria-pressed', 'true');
    await vi.waitFor(() => expect(document.title).toBe(`${sampleReader.displayName} – Tomekeeper`));
  });

  it('shows your profile as someone who isn’t your friend sees it', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    await screen.findByRole('region', { name: 'The year so far' });

    await user.click(screen.getByRole('button', { name: 'Someone else' }));

    expect(await screen.findByText(`${sampleReader.displayName} shares more with friends.`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Someone else' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('This is what someone who isn’t your friend sees.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'The year so far' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Volumes' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Reading now' })).not.toHaveTextContent('Visible to');
    expect(screen.queryByRole('region', { name: 'Who can see what' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(fakeApi.sent('GET', '/api/readers/ingrid').at(-1)?.search).toBe('?as=stranger');
  });

  it('saves who can see a part as soon as you choose', async () => {
    const user = userEvent.setup();
    fakeApi.on('PUT', '/api/profile/visibility', { status: 200, body: { ...settings, visibility: { ...visibility, progress: 'everyone' } } });
    renderApp('/profile');
    const group = await screen.findByRole('group', { name: 'Year and volumes' });

    await user.click(within(group).getByRole('radio', { name: 'Everyone' }));

    expect(await screen.findByText('Saved: Year and volumes is visible to Everyone.')).toBeInTheDocument();
    expect(fakeApi.sent('PUT', '/api/profile/visibility')[0]?.body).toEqual({ progress: 'everyone' });
    expect(within(group).getByRole('radio', { name: 'Everyone' })).toBeChecked();
    expect(screen.getByRole('region', { name: 'The year so far' })).toHaveTextContent('Visible to: Everyone');
  });

  it('puts the choice back when it can’t be saved', async () => {
    const user = userEvent.setup();
    fakeApi.on('PUT', '/api/profile/visibility', 'network-error');
    renderApp('/profile');
    const group = await screen.findByRole('group', { name: 'Reviews' });

    await user.click(within(group).getByRole('radio', { name: 'Only you' }));

    expect(await screen.findByText(/^Not saved: /)).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'Friends' })).toBeChecked();
  });

  it('lists your friends', async () => {
    renderApp('/profile');

    const friends = await screen.findByRole('region', { name: 'Fellowship' });
    expect(within(friends).getByRole('link', { name: 'Tormod' })).toHaveAttribute('href', '/readers/tormod');
    expect(within(friends).getByRole('link', { name: 'Find readers and answer requests' })).toHaveAttribute('href', '/fellowship');
    expect(friends).toHaveTextContent('Visible to: Only you');
  });

  it('shows another reader’s profile without the owner’s controls', async () => {
    fakeApi.on('GET', '/api/readers/tormod', { status: 200, body: { ...asStranger, handle: 'tormod', displayName: 'Tormod', isOwner: false, relation: 'none' } });
    renderApp('/readers/tormod');

    expect(await screen.findByRole('heading', { level: 1, name: 'Tormod' })).toBeInTheDocument();
    expect(screen.getByText('Tormod shares more with friends.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'See your profile as' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Not in your fellowship.')).toBeInTheDocument();
  });

  it('asks another reader to be friends from their profile', async () => {
    const user = userEvent.setup();
    const tormod = { ...asStranger, handle: 'tormod', displayName: 'Tormod', isOwner: false };
    let relation: ReaderProfile['relation'] = 'none';
    fakeApi.on('GET', '/api/readers/tormod', () => ({ status: 200, body: { ...tormod, relation } }));
    fakeApi.on('POST', '/api/fellowship/tormod/ask', () => {
      relation = 'asked';
      return { status: 200, body: { relation } };
    });
    renderApp('/readers/tormod');

    await user.click(await screen.findByRole('button', { name: 'Ask to be friends with Tormod' }));

    const line = await screen.findByText('You asked Tormod to be friends.');
    await vi.waitFor(() => expect(line).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Withdraw request to Tormod' })).toBeInTheDocument();
  });

  it('accepts a request on the profile of the reader who asked, and shows what friends see', async () => {
    const user = userEvent.setup();
    const tormod = { ...asStranger, handle: 'tormod', displayName: 'Tormod', isOwner: false, relation: 'asksYou' as const };
    let friends = false;
    fakeApi.on('GET', '/api/readers/tormod', () => ({
      status: 200,
      body: friends ? { ...own, handle: 'tormod', displayName: 'Tormod', isOwner: false, viewedAs: 'friend', visibility: null, relation: 'friend' } : tormod,
    }));
    fakeApi.on('POST', '/api/fellowship/tormod/accept', () => {
      friends = true;
      return { status: 200, body: { relation: 'friend' } };
    });
    renderApp('/readers/tormod');
    expect(await screen.findByText('Tormod asks to be your friend.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept Tormod' }));

    expect(await screen.findByRole('region', { name: 'The year so far' })).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByText('Tormod is in your fellowship.')).toHaveFocus());
  });

  it('says so when no reader has the address', async () => {
    renderApp('/readers/nobody');

    expect(await screen.findByRole('heading', { level: 1, name: 'Reader not found' })).toBeInTheDocument();
    await vi.waitFor(() => expect(document.title).toBe('Reader not found – Tomekeeper'));
  });
});

describe('the edit profile page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', '/api/profile', { status: 200, body: settings });
    fakeApi.on('GET', '/api/readers/ingrid-reads', { status: 200, body: { ...own, handle: 'ingrid-reads' } });
  });

  it('changes the address and the text, then goes back to the profile', async () => {
    const user = userEvent.setup();
    fakeApi.on('PUT', '/api/profile', { status: 200, body: { ...settings, handle: 'ingrid-reads', bio: 'Long books only.' } });
    renderApp('/profile/edit');
    const handle = await screen.findByRole('textbox', { name: 'Your address' });
    expect(handle).toHaveValue('ingrid');
    expect(screen.getByRole('textbox', { name: 'About you' })).toHaveAccessibleDescription(
      'A few words, always shown on your profile. 274 characters left.',
    );

    await user.clear(handle);
    await user.type(handle, 'ingrid-reads');
    await user.clear(screen.getByRole('textbox', { name: 'About you' }));
    await user.type(screen.getByRole('textbox', { name: 'About you' }), 'Long books only.');
    fakeApi.on('GET', '/api/profile', { status: 200, body: { ...settings, handle: 'ingrid-reads' } });
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText(`${window.location.host}/readers/ingrid-reads`)).toBeInTheDocument();
    expect(fakeApi.sent('PUT', '/api/profile')[0]?.body).toEqual({ handle: 'ingrid-reads', bio: 'Long books only.' });
  });

  it('shows the API’s reason when the address is taken', async () => {
    const user = userEvent.setup();
    fakeApi.on('PUT', '/api/profile', validationProblem({ handle: ['Another reader has that address. Try another.'] }));
    renderApp('/profile/edit');
    const handle = await screen.findByRole('textbox', { name: 'Your address' });

    await user.clear(handle);
    await user.type(handle, 'tormod');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    const summary = await screen.findByRole('group', { name: 'There is a problem' });
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole('link', { name: 'Another reader has that address. Try another.' })).toHaveAttribute('href', '#handle');
    expect(handle).toHaveAttribute('aria-invalid', 'true');
  });
});
