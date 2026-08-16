import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('offers a step per star when it can be rated', () => {
    render(<StarRating stars={null} label="Arrival" onRate={vi.fn()} />);

    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('says which star is the one given', () => {
    render(<StarRating stars={3} label="Arrival" onRate={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Arrival: 3 of 5' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Arrival: 4 of 5' })).not.toBeChecked();
  });

  it('reports the star that was pressed', async () => {
    const onRate = vi.fn();

    render(<StarRating stars={null} label="Arrival" onRate={onRate} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Arrival: 4 of 5' }));

    expect(onRate).toHaveBeenCalledWith(4);
  });

  it('takes the rating back when the star already given is pressed', async () => {
    const onRate = vi.fn();
    const onClear = vi.fn();

    render(<StarRating stars={4} label="Arrival" onRate={onRate} onClear={onClear} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Arrival: 4 of 5' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onRate).not.toHaveBeenCalled();
  });

  it('rates rather than clears when a different star is pressed', async () => {
    const onRate = vi.fn();
    const onClear = vi.fn();

    render(<StarRating stars={4} label="Arrival" onRate={onRate} onClear={onClear} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Arrival: 2 of 5' }));

    expect(onRate).toHaveBeenCalledWith(2);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('cannot be rated while it is inert', async () => {
    const onRate = vi.fn();

    render(<StarRating stars={null} label="Arrival" onRate={onRate} isDisabled />);

    await userEvent.click(screen.getByRole('radio', { name: 'Arrival: 3 of 5' }));

    expect(onRate).not.toHaveBeenCalled();
  });

  it('is a picture rather than a control when there is no way to report a rating', () => {
    render(<StarRating stars={4.2} label="Household" />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Household: 4.2 out of 5' })).toBeInTheDocument();
  });

  it('reads an unrated row as nothing rather than as an absence', () => {
    render(<StarRating stars={null} label="Household" />);

    expect(screen.getByRole('img', { name: 'Household: 0.0 out of 5' })).toBeInTheDocument();
  });

  it('names the whole row for anybody not looking at it', () => {
    render(<StarRating stars={2} label="Arrival" onRate={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Arrival' })).toBeInTheDocument();
  });
});
