import { screen, within } from '@testing-library/react';
import type { Character } from '../api/character';
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

describe('the quests page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', `/api/character/${YEAR}`, { status: 200, body: sheet });
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

  it('writes years in Roman numerals', () => {
    expect([toRoman(2026), toRoman(2025), toRoman(1999), toRoman(2024)]).toEqual(['MMXXVI', 'MMXXV', 'MCMXCIX', 'MMXXIV']);
  });
});
