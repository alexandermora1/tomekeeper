import { screen, within } from '@testing-library/react';
import { fakeApi } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

describe('the privacy policy', () => {
  it('names who runs the site and where to write, for anyone signed in or not', async () => {
    fakeApi.on('GET', '/api/site', { status: 200, body: { operatorName: 'Kari Nordmann', contactEmail: 'kari@example.no' } });
    renderApp('/privacy');

    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    expect(await screen.findByText(/run by Kari Nordmann, who is responsible for your data/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'kari@example.no' })).toHaveAttribute('href', 'mailto:kari@example.no');
    expect(within(screen.getByRole('region', { name: 'In short' })).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Datatilsynet' })).toHaveAttribute('href', 'https://www.datatilsynet.no/en/');
    await vi.waitFor(() => expect(document.title).toBe('Privacy – Tomekeeper'));
  });

  it('says where the name will be when the site isn’t online', async () => {
    fakeApi.on('GET', '/api/site', { status: 200, body: { operatorName: null, contactEmail: null } });
    renderApp('/privacy');

    expect(await screen.findByText(/When the site is online, the name of the person who runs it/)).toBeInTheDocument();
    expect(screen.getByText(/the contact address is shown here when the site is online/)).toBeInTheDocument();
  });
});

describe('the accessibility statement', () => {
  it('gives the contact address for problems', async () => {
    fakeApi.on('GET', '/api/site', { status: 200, body: { operatorName: 'Kari Nordmann', contactEmail: 'kari@example.no' } });
    renderApp('/accessibility');

    expect(await screen.findByRole('heading', { level: 1, name: 'Accessibility statement' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Known problems' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'kari@example.no' })).toHaveAttribute('href', 'mailto:kari@example.no');
    await vi.waitFor(() => expect(document.title).toBe('Accessibility statement – Tomekeeper'));
  });
});

describe('the footer', () => {
  it('links to the privacy policy, the accessibility statement and the credits', async () => {
    fakeApi.on('GET', '/api/site', { status: 200, body: { operatorName: null, contactEmail: null } });
    const { user } = renderApp('/privacy');
    await screen.findByRole('heading', { level: 1, name: 'Privacy' });
    const footer = screen.getByRole('contentinfo');

    await user.click(within(footer).getByRole('link', { name: 'Image credits' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Image credits' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Accessibility statement' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Accessibility statement' })).toBeInTheDocument();
  });
});
