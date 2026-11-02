import { screen, within } from '@testing-library/react';
import type { Character } from '../api/character';
import type { Quests } from '../api/quests';
import { toRoman } from '../game/roman';
import { fakeApi, sampleReader } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const YEAR = new Date().getFullYear();
const sheet: Character = {
  year: YEAR,
  xp: 12080,
  pagesXp: 10400,
  finishXp: 1680,
  level: 14,
  title: 'Wayfarer',
  levelStartsAt: 11050,
  nextLevelAt: 12250,
  titles: [
    { name: 'Novice', from: 1, to: 4 },
    { name: 'Reader', from: 5, to: 9 },
    { name: 'Wayfarer', from: 10, to: 14 },
    { name: 'Scholar', from: 15, to: 19 },
    { name: 'Sage', from: 20, to: null },
  ],
};

const quests: Quests = {
  year: YEAR,
  quests: [
    { id: 'binder', name: 'The Bookbinder', task: 'Finish ten books.', state: 'done', percent: 100, progress: 'Done in May with Going Postal.', reward: 'Bookbinder’s Gloves', slot: 'Hands', item: 'gloves' },
    { id: 'road', name: 'The Long Road', task: 'Finish a book over 1,000 pages.', state: 'active', percent: 54, progress: 'Memories of Ice, page 640 of 1,187.', reward: 'Pilgrim’s Satchel', slot: 'Satchel', item: 'satchel' },
    { id: 'nights', name: 'The Long Nights', task: 'Read 1,500 pages in December.', state: 'soon', percent: 0, progress: 'Opens 1 December.', reward: 'Lantern of Long Nights', slot: 'Lantern', item: 'lantern' },
  ],
  gear: [
    { item: 'spectacles', name: 'Scholar’s Spectacles', slot: 'Head', quest: 'The Scholar', task: 'Read 2,000 pages of nonfiction.', earnedIn: null },
    { item: 'cloak', name: 'Wayfarer’s Cloak', slot: 'Cloak', quest: 'Five Decades', task: 'Read books first published in five different decades.', earnedIn: null },
    { item: 'gloves', name: 'Bookbinder’s Gloves', slot: 'Hands', quest: 'The Bookbinder', task: 'Finish ten books.', earnedIn: 2025 },
    { item: 'satchel', name: 'Pilgrim’s Satchel', slot: 'Satchel', quest: 'The Long Road', task: 'Finish a book over 1,000 pages.', earnedIn: null },
    { item: 'lantern', name: 'Lantern of Long Nights', slot: 'Lantern', quest: 'The Long Nights', task: 'Read 1,500 pages in December.', earnedIn: null },
    { item: 'quill', name: 'Chronicler’s Quill', slot: 'Quill', quest: 'The Chronicler', task: 'Write five reviews.', earnedIn: null },
  ],
};

describe('the quests page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', `/api/character/${YEAR}`, { status: 200, body: sheet });
    fakeApi.on('GET', `/api/quests/${YEAR}`, { status: 200, body: quests });
  });

  it('shows the reader with their title, level and XP for the year', async () => {
    renderApp('/quests');

    expect(await screen.findByRole('heading', { level: 1, name: `${sampleReader.displayName} the Wayfarer` })).toBeInTheDocument();
    expect(screen.getByText(`Volume ${toRoman(YEAR)} · Level 14`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quests' })).toHaveAttribute('aria-current', 'page');
    const level = screen.getByRole('region', { name: 'Level' });
    expect(level).toHaveTextContent('12,080 XP this year');
    expect(level).toHaveTextContent('170 XP to level 15. So far: 10,400 for pages and 1,680 for finishing books.');
    await vi.waitFor(() => expect(document.title).toBe('Character and quests – Tomekeeper'));
  });

  it('marks the reader’s title among the five', async () => {
    renderApp('/quests');

    const titles = within(await screen.findByRole('list', { name: 'Titles' })).getAllByRole('listitem');
    expect(titles.map((t) => t.textContent)).toEqual([
      'Novice · levels 1 to 4',
      'Reader · levels 5 to 9',
      'Wayfarer · levels 10 to 14',
      'Scholar · levels 15 to 19',
      'Sage · level 20 and up',
    ]);
    expect(titles[2]).toHaveAttribute('aria-current', 'true');
  });

  it('shows the gear around the portrait and tells where a piece comes from', async () => {
    const { user } = renderApp('/quests');

    const left = await screen.findByRole('list', { name: 'Gear, left side' });
    const gloves = within(left).getByRole('button', { name: 'Hands: Bookbinder’s Gloves, earned' });
    const chosen = screen.getByRole('region', { name: 'Chosen gear' });
    // The first piece not yet earned is chosen to begin with.
    expect(chosen).toHaveTextContent('Not yet earned. From the quest The Scholar: read 2,000 pages of nonfiction.');
    await user.click(gloves);
    expect(gloves).toHaveAttribute('aria-pressed', 'true');
    expect(chosen).toHaveTextContent('Earned in 2025 from the quest The Bookbinder.');
    expect(within(screen.getByRole('list', { name: 'Gear, right side' })).getAllByRole('button')).toHaveLength(3);
  });

  it('lists the quests of the year and filters them', async () => {
    const { user } = renderApp('/quests');

    const frame = await screen.findByRole('region', { name: `Quests of ${toRoman(YEAR)}` });
    const list = within(frame).getByRole('list', { name: 'Quests' });
    expect(within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['The Bookbinder', 'The Long Road', 'The Long Nights']);
    expect(list).toHaveTextContent('Memories of Ice, page 640 of 1,187.');
    expect(list).toHaveTextContent('Reward: Pilgrim’s Satchel (Satchel)');

    await user.click(within(frame).getByRole('button', { name: 'Complete' }));

    expect(within(frame).getByRole('button', { name: 'Complete' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(within(frame).getByRole('list', { name: 'Quests' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('writes years in Roman numerals', () => {
    expect([toRoman(2026), toRoman(2025), toRoman(1999), toRoman(2024)]).toEqual(['MMXXVI', 'MMXXV', 'MCMXCIX', 'MMXXIV']);
  });
});
