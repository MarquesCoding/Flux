import { describe, expect, it } from 'vitest';
import { createMemoryWatchProgressService } from './createMemoryWatchProgressService';

const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const OTHER_ID = '00000000-0000-4000-8000-000000000001';

const REPORT = {
  mediaId: MEDIA_ID,
  positionSeconds: 600,
  durationSeconds: 7200,
  isFinished: false,
};

describe('createMemoryWatchProgressService', () => {
  it('has nothing on somebody who has watched nothing', async () => {
    const service = createMemoryWatchProgressService();

    await expect(service.list('sam')).resolves.toEqual([]);
  });

  it('remembers where somebody got to', async () => {
    const service = createMemoryWatchProgressService();

    await service.record('sam', REPORT);

    await expect(service.list('sam')).resolves.toMatchObject([{ positionSeconds: 600 }]);
  });

  it('keeps one position per item rather than a history of them', async () => {
    const service = createMemoryWatchProgressService();

    await service.record('sam', REPORT);
    await service.record('sam', { ...REPORT, positionSeconds: 1200 });

    await expect(service.list('sam')).resolves.toMatchObject([{ positionSeconds: 1200 }]);
  });

  it('puts what was watched most recently first', async () => {
    const service = createMemoryWatchProgressService();

    await service.record('sam', REPORT);
    await service.record('sam', { ...REPORT, mediaId: OTHER_ID });

    await expect(service.list('sam')).resolves.toMatchObject([
      { mediaId: OTHER_ID },
      { mediaId: MEDIA_ID },
    ]);
  });

  it('does not let a household share a place in a film', async () => {
    const service = createMemoryWatchProgressService();

    await service.record('sam', REPORT);

    await expect(service.list('mum')).resolves.toEqual([]);
  });

  it('forgets an item when asked', async () => {
    const service = createMemoryWatchProgressService();

    await service.record('sam', REPORT);
    await service.forget('sam', MEDIA_ID);

    await expect(service.list('sam')).resolves.toEqual([]);
  });

  it('leaves everything else alone when forgetting one item', async () => {
    const service = createMemoryWatchProgressService();

    await service.record('sam', REPORT);
    await service.record('sam', { ...REPORT, mediaId: OTHER_ID });
    await service.forget('sam', MEDIA_ID);

    await expect(service.list('sam')).resolves.toMatchObject([{ mediaId: OTHER_ID }]);
  });

  it('is untroubled by being asked to forget something nobody watched', async () => {
    const service = createMemoryWatchProgressService();

    await expect(service.forget('sam', MEDIA_ID)).resolves.toBeUndefined();
  });

  it('can be started with somebody already partway through something', async () => {
    const service = createMemoryWatchProgressService({
      sam: [{ ...REPORT, updatedAt: new Date(0).toISOString() }],
    });

    await expect(service.list('sam')).resolves.toHaveLength(1);
  });
});
