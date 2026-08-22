import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@ValenceScreens/testing/renderInAShell';
import { AdminPage } from './AdminPage';
import type { AdminAreaProps } from '@ValenceScreens/components/AdminArea/AdminArea.types';

const drawn = vi.hoisted((): { props: AdminAreaProps | null } => ({ props: null }));

vi.mock('@ValenceScreens/components/AdminArea/AdminArea', () => ({
  AdminArea: (props: AdminAreaProps) => {
    drawn.props = props;

    return <p>the server</p>;
  },
}));

beforeEach(() => {
  drawn.props = null;
  window.history.replaceState(null, '', '/admin');
});

describe('AdminPage', () => {
  it('opens the panel and the job the address names', () => {
    window.history.replaceState(null, '', '/admin?panel=jobs&job=library.scan');

    renderInAShell(<AdminPage />);

    expect(drawn.props?.initialPanel).toBe('jobs');
    expect(drawn.props?.initialJob).toBe('library.scan');
  });

  it('writes the panel into the address without leaving a history behind', async () => {
    renderInAShell(<AdminPage />);

    drawn.props?.onPanelChange?.('logs');

    await vi.waitFor(() => {
      expect(window.location.search).toContain('panel=logs');
    });
  });

  it('writes the job being looked at into the address', async () => {
    renderInAShell(<AdminPage />);

    drawn.props?.onJobChange?.('library.scan');

    await vi.waitFor(() => {
      expect(window.location.search).toContain('job=library.scan');
    });
  });
});
