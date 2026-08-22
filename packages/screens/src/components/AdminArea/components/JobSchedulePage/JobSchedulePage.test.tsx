import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JobSchedulePage } from './JobSchedulePage';
import type { JobTrigger } from '@ValenceClient/admin/fetchAdmin';

const NIGHTLY: JobTrigger = {
  id: 'trigger-1',
  trigger: { kind: 'daily', hour: 3, minute: 0 },
};

const ON_STARTUP: JobTrigger = { id: 'trigger-2', trigger: { kind: 'startup' } };

const build = (props: Partial<Parameters<typeof JobSchedulePage>[0]> = {}) => (
  <JobSchedulePage triggers={[]} onAdd={vi.fn()} onRemove={vi.fn()} {...props} />
);

describe('JobSchedulePage', () => {
  it('says the job only runs when pressed while it has no triggers', () => {
    render(build());

    expect(screen.getByText('No triggers. This only runs when you press Run.')).toBeInTheDocument();
  });

  it('lists every trigger in words rather than in its stored shape', () => {
    render(build({ triggers: [NIGHTLY, ON_STARTUP] }));

    expect(screen.getByText('Daily at 03:00')).toBeInTheDocument();
    expect(screen.getByText('On application startup')).toBeInTheDocument();
    expect(screen.queryByText('No triggers. This only runs when you press Run.')).toBeNull();
  });

  it('reports the trigger removed when its remove button is pressed', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(build({ triggers: [NIGHTLY], onRemove }));

    await user.click(screen.getByRole('button', { name: 'Remove Daily at 03:00' }));

    expect(onRemove).toHaveBeenCalledWith('trigger-1');
  });

  it('adds a trigger through the Add trigger dialog', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();

    render(build({ onAdd }));

    await user.click(screen.getByRole('button', { name: 'Add trigger' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'daily', hour: 3, minute: 0 });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(JobSchedulePage.displayName).toBe('JobSchedulePage');
  });
});
