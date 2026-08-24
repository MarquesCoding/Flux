import { describe, expect, it } from 'vitest';
import { createMemoryProfileService } from './createMemoryProfileService';

const REQUEST = { name: 'Sam', colour: '#3ac47d' } as const;

describe('createMemoryProfileService', () => {
  it('has nobody on an account nobody has used', async () => {
    const profiles = createMemoryProfileService();

    await expect(profiles.list('marques')).resolves.toEqual([]);
  });

  it('makes a profile for an account that has none', async () => {
    const profiles = createMemoryProfileService();

    const made = await profiles.ensureDefault('marques', 'Marques');

    expect(made.name).toBe('Marques');
  });

  it('does not make a second one for an account that has one', async () => {
    const profiles = createMemoryProfileService();

    const first = await profiles.ensureDefault('marques', 'Marques');
    const again = await profiles.ensureDefault('marques', 'Marques');

    expect(again.id).toBe(first.id);
  });

  it('adds somebody to an account', async () => {
    const profiles = createMemoryProfileService();

    await profiles.ensureDefault('marques', 'Marques');
    await profiles.create('marques', REQUEST);

    await expect(profiles.list('marques')).resolves.toHaveLength(2);
  });

  it('keeps the people of one account out of another', async () => {
    const profiles = createMemoryProfileService();

    await profiles.create('marques', REQUEST);

    await expect(profiles.list('somebody-else')).resolves.toEqual([]);
  });

  it('changes what somebody is called', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await profiles.rename('marques', made.id, { name: 'Samuel', colour: '#3ac47d' });

    await expect(profiles.list('marques')).resolves.toMatchObject([{ name: 'Samuel' }]);
  });

  it('changes when a profile last changed, since its picture is addressed by that', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await profiles.rename('marques', made.id, { name: 'Samuel', colour: '#3ac47d' });

    const [changed] = await profiles.list('marques');

    expect(changed?.updatedAt).not.toBe(made.updatedAt);
  });

  it('will not let one account rename a profile held by another', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await expect(
      profiles.rename('somebody-else', made.id, { name: 'Mine', colour: '#3ac47d' }),
    ).resolves.toBe(false);
  });

  it('removes somebody', async () => {
    const profiles = createMemoryProfileService();

    await profiles.ensureDefault('marques', 'Marques');

    const made = await profiles.create('marques', REQUEST);

    await profiles.remove('marques', made.id);

    await expect(profiles.list('marques')).resolves.toHaveLength(1);
  });

  it('will not remove the last one, which would leave nowhere to record viewing', async () => {
    const profiles = createMemoryProfileService();
    const only = await profiles.ensureDefault('marques', 'Marques');

    await expect(profiles.remove('marques', only.id)).resolves.toBe(false);
  });

  it('says a profile belongs to the account holding it', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await expect(profiles.belongsTo('marques', made.id)).resolves.toBe(true);
    await expect(profiles.belongsTo('somebody-else', made.id)).resolves.toBe(false);
  });

  it('hands somebody an account of their own without losing the profile', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await profiles.moveTo(made.id, 'sam');

    await expect(profiles.list('sam')).resolves.toMatchObject([{ id: made.id }]);
    await expect(profiles.list('marques')).resolves.toEqual([]);
  });

  it('draws a face that was chosen rather than storing a picture of one', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', {
      ...REQUEST,
      avatar: { kind: 'drawn', style: 'bottts', seed: 'abc' },
    });

    const picture = await profiles.readAvatar(made.id);

    expect(picture?.contentType).toBe('image/svg+xml');
  });

  it('has no picture for somebody wearing a letter', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await expect(profiles.readAvatar(made.id)).resolves.toBeNull();
  });

  it('keeps a photograph that was uploaded, and says the profile wears one', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await profiles.savePhoto('marques', made.id, {
      body: new TextEncoder().encode('a picture'),
      contentType: 'image/webp',
    });

    const [changed] = await profiles.list('marques');

    expect(changed?.avatar).toEqual({ kind: 'photo', isVideo: false });
  });

  it('knows a photograph that moves needs an element that can play it', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await profiles.savePhoto('marques', made.id, {
      body: new TextEncoder().encode('a clip'),
      contentType: 'video/webm',
    });

    const [changed] = await profiles.list('marques');

    expect(changed?.avatar).toEqual({ kind: 'photo', isVideo: true });
  });

  it('will not let one account put a photograph on a profile held by another', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await expect(
      profiles.savePhoto('somebody-else', made.id, {
        body: new TextEncoder().encode('a picture'),
        contentType: 'image/webp',
      }),
    ).resolves.toBe(false);
  });

  it('says everybody who could sign in, across accounts', async () => {
    const profiles = createMemoryProfileService();

    await profiles.create('marques', REQUEST);
    await profiles.create('sam', { name: 'Sam', colour: '#3a8ee8' });

    await expect(profiles.listEveryone()).resolves.toHaveLength(2);
  });

  it('knows the address behind a face, which never leaves the server', async () => {
    const profiles = createMemoryProfileService();
    const made = await profiles.create('marques', REQUEST);

    await expect(profiles.findSignInEmail(made.id)).resolves.toContain('marques');
  });

  it('knows no address for a face that does not exist', async () => {
    const profiles = createMemoryProfileService();

    await expect(profiles.findSignInEmail('nobody')).resolves.toBeNull();
  });

  it('has nothing to remove for a profile that is not there', async () => {
    const profiles = createMemoryProfileService();

    await profiles.ensureDefault('marques', 'Marques');
    await profiles.create('marques', REQUEST);

    await expect(profiles.remove('marques', '3f2504e0-4f89-41d3-9a0c-0305e82c3301')).resolves.toBe(
      false,
    );
  });

  it('has nowhere to put a photograph for a profile that is not there', async () => {
    const profiles = createMemoryProfileService();

    await expect(
      profiles.savePhoto('marques', '3f2504e0-4f89-41d3-9a0c-0305e82c3301', {
        body: new Uint8Array([1]),
        contentType: 'image/webp',
      }),
    ).resolves.toBe(false);
  });

  it('has no owner to change for a profile that is not there', async () => {
    const profiles = createMemoryProfileService();

    await expect(profiles.moveTo('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'somebody')).resolves.toBe(
      false,
    );
  });

  it('offers the household in alphabetical order, not the order they were made', async () => {
    const profiles = createMemoryProfileService();

    await profiles.ensureDefault('user-zoe', 'Zoe');
    await profiles.ensureDefault('user-ada', 'Ada');
    await profiles.ensureDefault('user-milo', 'Milo');

    const everyone = await profiles.listEveryone();

    expect(everyone.map((one) => one.name)).toEqual(['Ada', 'Milo', 'Zoe']);
  });
});
