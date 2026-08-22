import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConcernsBanner } from './ConcernsBanner';
import type { Concern } from '@ValenceScreens/components/AdminArea/collectConcerns';

const concern = (over: Partial<Concern> = {}): Concern => ({
  id: 'transcoder-unreachable',
  tone: 'broken',
  title: 'The media service is unreachable',
  detail: 'Nothing that needs converting will play until it is back.',
  panel: 'overview',
  ...over,
});

describe('ConcernsBanner', () => {
  it('draws nothing when nothing needs a person', () => {
    const { container } = render(<ConcernsBanner concerns={[]} onOpenPanel={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('reports what is wrong', () => {
    render(<ConcernsBanner concerns={[concern()]} onOpenPanel={vi.fn()} />);

    expect(screen.getByText('The media service is unreachable')).toBeInTheDocument();
  });

  it('opens the panel that explains one', async () => {
    const onOpenPanel = vi.fn<(panel: string) => void>();
    const user = userEvent.setup();

    render(
      <ConcernsBanner
        concerns={[
          concern({
            id: 'library-never-scanned',
            tone: 'setup',
            title: 'Films has never been scanned',
            detail: 'It holds nothing until it is.',
            panel: 'libraries',
          }),
        ]}
        onOpenPanel={onOpenPanel}
      />,
    );

    await user.click(screen.getByRole('button', { name: /never been scanned/ }));

    expect(onOpenPanel).toHaveBeenCalledWith('libraries');
  });
});
