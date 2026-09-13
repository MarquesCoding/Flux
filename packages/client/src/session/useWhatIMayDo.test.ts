import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHookInACache } from '@ValenceClient/testing/renderHookInACache';
import { useWhatIMayDo } from './useWhatIMayDo';
import type { MyPermissions } from '@ValenceContracts/schemas/Permission';

const fetchMyPermissions = vi.fn<() => Promise<MyPermissions>>();

vi.mock('@ValenceClient/session/fetchMyPermissions', () => ({
  fetchMyPermissions: () => fetchMyPermissions(),
}));

beforeEach(() => {
  fetchMyPermissions.mockReset().mockResolvedValue({ permissions: [], isAdministrator: false });
});

describe('useWhatIMayDo', () => {
  it('says an administrator may administer the server', async () => {
    fetchMyPermissions.mockResolvedValue({
      permissions: ['administrator'],
      isAdministrator: true,
    });

    const { result } = renderHookInACache(() => useWhatIMayDo());

    await waitFor(() => {
      expect(result.current.mayAdminister).toBe(true);
    });
  });

  it('says a viewer may not', async () => {
    const { result } = renderHookInACache(() => useWhatIMayDo());

    await waitFor(() => {
      expect(fetchMyPermissions).toHaveBeenCalled();
    });

    expect(result.current.mayAdminister).toBe(false);
  });

  it('grants nothing until the server has answered, so nothing privileged is shown and taken away', () => {
    fetchMyPermissions.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHookInACache(() => useWhatIMayDo());

    expect(result.current.mayAdminister).toBe(false);
    expect(result.current.may('library.create')).toBe(false);
  });

  it('grants nothing when the answer could not be read', async () => {
    fetchMyPermissions.mockRejectedValue(new Error('offline'));

    const { result } = renderHookInACache(() => useWhatIMayDo());

    await waitFor(() => {
      expect(fetchMyPermissions).toHaveBeenCalled();
    });

    expect(result.current.mayAdminister).toBe(false);
    expect(result.current.may('library.create')).toBe(false);
  });

  it('answers for a permission that was granted, and for one that was not', async () => {
    fetchMyPermissions.mockResolvedValue({
      permissions: ['library.create'],
      isAdministrator: false,
    });

    const { result } = renderHookInACache(() => useWhatIMayDo());

    await waitFor(() => {
      expect(result.current.may('library.create')).toBe(true);
    });

    expect(result.current.may('server.logs')).toBe(false);
  });

  it('reads the answer as it stands rather than implying one permission from another', async () => {
    fetchMyPermissions.mockResolvedValue({
      permissions: ['administrator'],
      isAdministrator: true,
    });

    const { result } = renderHookInACache(() => useWhatIMayDo());

    await waitFor(() => {
      expect(result.current.mayAdminister).toBe(true);
    });

    expect(result.current.may('server.logs')).toBe(false);
  });

  it('asks once however many screens ask it', async () => {
    const { result } = renderHookInACache(() => ({
      one: useWhatIMayDo(),
      two: useWhatIMayDo(),
    }));

    await waitFor(() => {
      expect(fetchMyPermissions).toHaveBeenCalledTimes(1);
    });

    expect(result.current.two.mayAdminister).toBe(false);
  });
});
