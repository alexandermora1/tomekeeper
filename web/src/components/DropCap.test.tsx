import { render, screen } from '@testing-library/react';
import { DropCap } from './DropCap';

describe('DropCap', () => {
  it('keeps the whole text readable, first letter included', () => {
    render(<DropCap text="So far this year you have read 9,840 pages." />);
    const paragraph = screen.getByText((_, element) => element?.tagName === 'P');
    expect(paragraph).toHaveTextContent('So far this year you have read 9,840 pages.');
  });

  it('shows the initial as a decorative image', () => {
    const { container } = render(<DropCap text="Memories of Ice" />);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('falls back to plain text when there is no initial', () => {
    const { container } = render(<DropCap text="1984 is a novel." />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('1984 is a novel.')).toBeInTheDocument();
  });
});
