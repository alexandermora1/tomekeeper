import { render, screen, within } from '@testing-library/react';
import { TwelveLabours } from './TwelveLabours';

const pages = [1120, 860, 1240, 780, 690, 1050, 1310, 1180, 870, 300, 0, 0];

describe('the Twelve Labours', () => {
  it('lists the pages of each month, with the months to come and this month marked', () => {
    render(<TwelveLabours year={2026} pagesByMonth={pages} pagesRead={9400} goalPages={12000} now={new Date(2026, 9, 15)} />);

    const months = within(screen.getByRole('list', { name: 'Pages read each month in 2026' })).getAllByRole('listitem');
    expect(months).toHaveLength(12);
    expect(months[0]).toHaveTextContent('JanuaryFeasting1,120 pages');
    expect(months[9]).toHaveAttribute('aria-current', 'date');
    expect(months[9]).toHaveTextContent('OctoberSowing300 pages');
    expect(months[10]).toHaveTextContent('NovemberAcorn harvestTo come');
  });

  it('has no months to come in a year gone by', () => {
    render(<TwelveLabours year={2025} pagesByMonth={pages} pagesRead={9400} goalPages={null} now={new Date(2026, 9, 15)} />);
    expect(screen.queryByText('To come')).not.toBeInTheDocument();
    expect(screen.getByRole('list').querySelector('[aria-current]')).toBeNull();
  });

  it('draws the wheel as a picture that screen readers skip, with the year in the middle', () => {
    const { container } = render(
      <TwelveLabours year={2026} pagesByMonth={pages} pagesRead={9400} goalPages={12000} now={new Date(2026, 9, 15)} />,
    );
    const wheel = container.querySelector('svg')!;
    expect(wheel).toHaveAttribute('aria-hidden', 'true');
    expect(wheel).toHaveTextContent('9,400');
    expect(wheel).toHaveTextContent('of 12,000 pages');
    expect(wheel).toHaveTextContent('78 percent');
    expect(wheel).toHaveTextContent('Today');
  });
});
