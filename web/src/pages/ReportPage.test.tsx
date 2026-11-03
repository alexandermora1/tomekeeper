import { screen, within } from '@testing-library/react';
import type { ReaderProfile } from '../api/profile';
import { fakeApi, problem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const BOOK = '01a18876-0000-7000-8000-000000000009';
const tormod: ReaderProfile = {
  handle: 'tormod',
  displayName: 'Tormod',
  portrait: null,
  bio: null,
  since: 2026,
  viewedAs: 'stranger',
  isOwner: false,
  year: null,
  readingNow: null,
  volumes: null,
  somethingHidden: true,
  visibility: null,
  relation: 'none',
  fellowship: null,
  reviews: null,
};

describe('the report page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', '/api/readers/tormod', { status: 200, body: tormod });
    fakeApi.on('POST', '/api/reports', { status: 200, body: { id: '01a18876-0000-7000-8000-0000000000aa' } });
  });

  it('reports a reader to the moderator', async () => {
    const { user } = renderApp('/report/tormod');

    expect(await screen.findByRole('heading', { level: 1, name: 'Report Tormod' })).toBeInTheDocument();
    expect(screen.getByText('Reports go to Tomekeeper’s moderator. Tormod isn’t told.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Tormod’s profile' })).toHaveAttribute('href', '/readers/tormod');
    await user.click(screen.getByRole('radio', { name: 'Harassment or bullying' }));
    await user.type(screen.getByRole('textbox', { name: 'Tell the moderator more' }), 'Rude messages in every review.');
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText('Thank you. The report is sent.')).toBeInTheDocument();
    expect(fakeApi.sent('POST', '/api/reports')[0]?.body).toEqual({
      handle: 'tormod',
      bookId: null,
      reason: 'harassment',
      details: 'Rude messages in every review.',
    });
    await vi.waitFor(() => expect(document.title).toBe('Report sent – Tomekeeper'));
  });

  it('reports a review, naming the book', async () => {
    fakeApi.on('GET', `/api/books/${BOOK}`, {
      status: 200,
      body: { id: BOOK, openLibraryKey: 'OL1W', title: 'Piranesi', subtitle: null, authors: ['Susanna Clarke'], firstPublishedYear: 2020, pageCount: 272, coverId: null, fiction: true },
    });
    const { user } = renderApp(`/report/tormod?book=${BOOK}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Report a review' })).toBeInTheDocument();
    expect(await screen.findByText('Tormod’s review of Piranesi.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Piranesi' })).toHaveAttribute('href', `/books/${BOOK}`);
    await user.click(screen.getByRole('radio', { name: 'Spam or advertising' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText('Thank you. The report is sent.')).toBeInTheDocument();
    expect(fakeApi.sent('POST', '/api/reports')[0]?.body).toEqual({ handle: 'tormod', bookId: BOOK, reason: 'spam', details: '' });
  });

  it('needs a reason, and words for something else', async () => {
    const { user } = renderApp('/report/tormod');
    await screen.findByRole('heading', { level: 1, name: 'Report Tormod' });

    await user.click(screen.getByRole('button', { name: 'Send report' }));
    const summary = await screen.findByRole('group', { name: 'There is a problem' });
    expect(within(summary).getByRole('link', { name: 'Choose what is wrong.' })).toHaveAttribute('href', '#reason-spam');

    await user.click(screen.getByRole('radio', { name: 'Something else' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await within(screen.getByRole('group', { name: 'There is a problem' })).findByRole('link', {
      name: 'Say what is wrong, so the moderator knows what to look for.',
    })).toHaveAttribute('href', '#report-details');
    expect(fakeApi.sent('POST', '/api/reports')).toHaveLength(0);
  });

  it('uses the address when the reader is hidden by a block, and shows the API’s reason', async () => {
    fakeApi.on('GET', '/api/readers/tormod', { status: 404 });
    fakeApi.on('POST', '/api/reports', problem(429, 'You have sent 20 reports today. Try again tomorrow.'));
    const { user } = renderApp('/report/tormod');

    expect(await screen.findByRole('heading', { level: 1, name: 'Report tormod' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Hateful or offensive' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('group', { name: 'There is a problem' })).toHaveTextContent('You have sent 20 reports today. Try again tomorrow.');
  });
});
