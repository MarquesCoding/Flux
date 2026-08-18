import { describe, expect, it } from 'vitest';
import { createMemoryShareService } from './createMemoryShareService';

const FILM = '9c858901-8a57-4791-81fe-4c455b099bc9';
const SHOW = '5d3e2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';

const build = () =>
  createMemoryShareService({
    shares: [],
    titles: { [FILM]: 'Arrival', [SHOW]: 'The Bear' },
    names: { ada: 'Ada', grace: 'Grace' },
  });

describe('createMemoryShareService', () => {
  it('has nothing for somebody who has shared nothing', async () => {
    await expect(build().list('ada')).resolves.toEqual([]);
  });

  it('hands back a token once, when the link is made', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });

    expect(made?.token).toBeTruthy();
    expect(made?.title).toBe('Arrival');
  });

  it('never keeps the token itself, only its hash', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });
    const held = shares.state.shares[0];

    expect(held?.tokenHash).not.toBe(made?.token);
    expect(JSON.stringify(shares.state)).not.toContain(made?.token ?? 'nothing');
  });

  it('never shows the token again, however the link is read back', async () => {
    const shares = build();

    await shares.create('ada', { kind: 'item', mediaId: FILM });

    expect(JSON.stringify(await shares.list('ada'))).not.toContain('token');
  });

  it('will not share something that is not there', async () => {
    const shares = build();

    await expect(
      shares.create('ada', { kind: 'item', mediaId: '00000000-0000-4000-8000-000000000000' }),
    ).resolves.toBeNull();
  });

  it('resolves a link from its token', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });
    const found = await shares.resolve(made?.token ?? '');

    expect(found?.mediaId).toBe(FILM);
  });

  it('resolves nothing for a token nobody was given', async () => {
    await expect(build().resolve('not-a-real-token')).resolves.toBeNull();
  });

  it('counts a joiner once however often they come back', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });
    const id = made?.id ?? '';

    await shares.join(id, 'guest-1');
    await shares.join(id, 'guest-1');
    await shares.join(id, 'guest-1');

    expect((await shares.resolve(made?.token ?? ''))?.views).toBe(1);
  });

  it('counts two people as two', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });
    const id = made?.id ?? '';

    await shares.join(id, 'guest-1');
    await shares.join(id, 'guest-2');

    expect((await shares.resolve(made?.token ?? ''))?.views).toBe(2);
  });

  it('revokes a link', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });

    await expect(shares.revoke('ada', made?.id ?? '')).resolves.toBe(true);
    expect((await shares.resolve(made?.token ?? ''))?.revokedAt).not.toBeNull();
  });

  it('will not let somebody revoke a link that is not theirs', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });

    await expect(shares.revoke('grace', made?.id ?? '')).resolves.toBe(false);
    expect((await shares.resolve(made?.token ?? ''))?.revokedAt).toBeNull();
  });

  it('lists only what this person shared', async () => {
    const shares = build();

    await shares.create('ada', { kind: 'item', mediaId: FILM });
    await shares.create('grace', { kind: 'series', seriesId: SHOW });

    await expect(shares.list('ada')).resolves.toHaveLength(1);
    await expect(shares.list('grace')).resolves.toHaveLength(1);
  });

  it('says a link is spent once its views are used up', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM, viewCap: 1 });

    await shares.join(made?.id ?? '', 'guest-1');

    expect((await shares.list('ada'))[0]?.isSpent).toBe(true);
  });

  it('says a link is spent once it has expired', async () => {
    const shares = build();

    await shares.create('ada', {
      kind: 'item',
      mediaId: FILM,
      expiresAt: '2020-01-01T00:00:00.000Z',
    });

    expect((await shares.list('ada'))[0]?.isSpent).toBe(true);
  });

  it('lists everybody’s links together, saying who handed each one out', async () => {
    const shares = build();

    await shares.create('ada', { kind: 'item', mediaId: FILM });
    await shares.create('grace', { kind: 'series', seriesId: SHOW });

    const everybody = await shares.listEverybody();

    expect(everybody).toHaveLength(2);
    expect(everybody.map((one) => one.createdByName).sort()).toEqual(['Ada', 'Grace']);
  });

  it('names somebody it has no name for rather than leaving the column empty', async () => {
    const shares = build();

    await shares.create('nobody-on-record', { kind: 'item', mediaId: FILM });

    expect((await shares.listEverybody())[0]?.createdByName).toBe('Somebody');
  });

  it('withdraws anybody’s link, and says whose it was so they can be told', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });

    await expect(shares.revokeAnybody(made?.id ?? '')).resolves.toEqual({
      createdBy: 'ada',
      title: 'Arrival',
    });

    expect((await shares.list('ada'))[0]?.isRevoked).toBe(true);
  });

  it('withdraws a link only once, so nobody is told about it twice', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'item', mediaId: FILM });

    await shares.revokeAnybody(made?.id ?? '');

    await expect(shares.revokeAnybody(made?.id ?? '')).resolves.toBeNull();
  });

  it('has nothing to withdraw for a link nobody handed out', async () => {
    await expect(build().revokeAnybody('not-a-link')).resolves.toBeNull();
  });

  it('shares a whole series when that is what was asked for', async () => {
    const shares = build();

    const made = await shares.create('ada', { kind: 'series', seriesId: SHOW });

    expect(made?.kind).toBe('series');
    expect(made?.seriesId).toBe(SHOW);
    expect(made?.mediaId).toBeNull();
  });
});
