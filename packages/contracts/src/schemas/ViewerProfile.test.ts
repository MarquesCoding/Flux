import { describe, expect, it } from 'vitest';
import {
  ViewerProfileSchema,
  ViewerProfileRequestSchema,
  ViewerProfileListSchema,
  AvatarSchema,
  PROFILE_COLOURS,
  AVATAR_STYLES,
  NAME_MAX,
  profileInitial,
  profileAvatarUrl,
} from './ViewerProfile';

const PROFILE = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Marques',
  colour: PROFILE_COLOURS[0],
  avatar: { kind: 'initial' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as const;

describe('ViewerProfileSchema', () => {
  it('reads a profile', () => {
    expect(ViewerProfileSchema.safeParse(PROFILE).success).toBe(true);
  });

  it('refuses a colour outside the set everything is tuned against', () => {
    expect(ViewerProfileSchema.safeParse({ ...PROFILE, colour: '#123456' }).success).toBe(false);
  });

  it('refuses a name too long to be drawn under a portrait', () => {
    expect(
      ViewerProfileSchema.safeParse({ ...PROFILE, name: 'x'.repeat(NAME_MAX + 1) }).success,
    ).toBe(false);
  });

  it('refuses a profile with no name at all', () => {
    expect(ViewerProfileSchema.safeParse({ ...PROFILE, name: '' }).success).toBe(false);
  });

  it('insists on knowing when a profile last changed, since its picture is addressed by it', () => {
    const { updatedAt, ...without } = PROFILE;

    expect(updatedAt).not.toBe('');
    expect(ViewerProfileSchema.safeParse(without).success).toBe(false);
  });
});

describe('AvatarSchema', () => {
  it('reads a letter, which is what a profile made in four seconds wears', () => {
    expect(AvatarSchema.safeParse({ kind: 'initial' }).success).toBe(true);
  });

  it('reads a drawn face', () => {
    expect(
      AvatarSchema.safeParse({ kind: 'drawn', style: AVATAR_STYLES[0], seed: 'abc' }).success,
    ).toBe(true);
  });

  it('refuses a drawn style nothing can draw', () => {
    expect(
      AvatarSchema.safeParse({ kind: 'drawn', style: 'oil-painting', seed: 'abc' }).success,
    ).toBe(false);
  });

  it('reads a photograph, and assumes it does not move unless told', () => {
    const parsed = AvatarSchema.parse({ kind: 'photo' });

    expect(parsed).toEqual({ kind: 'photo', isVideo: false });
  });

  it('reads a picture that moves, which needs a video element rather than an image', () => {
    expect(AvatarSchema.parse({ kind: 'photo', isVideo: true })).toEqual({
      kind: 'photo',
      isVideo: true,
    });
  });
});

describe('ViewerProfileRequestSchema', () => {
  it('leaves out what was left out, so an edit that says nothing changes nothing', () => {
    expect(
      ViewerProfileRequestSchema.parse({ name: 'Sam', colour: PROFILE_COLOURS[1] }),
    ).not.toHaveProperty('askStillWatchingAfter');
  });

  it('trims a name, so leading space is not part of what somebody is called', () => {
    expect(
      ViewerProfileRequestSchema.parse({ name: '  Sam ', colour: PROFILE_COLOURS[1] }),
    ).toEqual({ name: 'Sam', colour: PROFILE_COLOURS[1] });
  });

  it('lets a picture be left out, which keeps whatever the profile already wears', () => {
    expect(
      ViewerProfileRequestSchema.safeParse({ name: 'Sam', colour: PROFILE_COLOURS[1] }).success,
    ).toBe(true);
  });

  it('refuses a name of nothing but space', () => {
    expect(
      ViewerProfileRequestSchema.safeParse({ name: '   ', colour: PROFILE_COLOURS[1] }).success,
    ).toBe(false);
  });
});

describe('ViewerProfileListSchema', () => {
  it('reads a wall of faces', () => {
    expect(ViewerProfileListSchema.safeParse({ profiles: [PROFILE] }).success).toBe(true);
  });

  it('reads a server nobody has an account on yet', () => {
    expect(ViewerProfileListSchema.safeParse({ profiles: [] }).success).toBe(true);
  });
});

describe('profileInitial', () => {
  it('draws one large letter rather than two small ones', () => {
    expect(profileInitial('Margaret Anne Fitzgerald')).toBe('M');
  });

  it('draws it as a capital, whatever the name was typed as', () => {
    expect(profileInitial('sam')).toBe('S');
  });

  it('ignores the space somebody left in front of their name', () => {
    expect(profileInitial('  Sam')).toBe('S');
  });

  it('has something to draw even for a name that is nothing', () => {
    expect(profileInitial('   ')).toBe('?');
  });
});

describe('profileAvatarUrl', () => {
  it('serves a picture through Flux rather than from wherever it was drawn', () => {
    expect(profileAvatarUrl(PROFILE).startsWith('/api/profiles/')).toBe(true);
  });

  it('changes address when the picture changes', () => {
    expect(profileAvatarUrl(PROFILE)).not.toBe(
      profileAvatarUrl({ ...PROFILE, updatedAt: '2026-02-02T00:00:00.000Z' }),
    );
  });

  it('keeps the same address while the picture is the same', () => {
    expect(profileAvatarUrl(PROFILE)).toBe(profileAvatarUrl({ ...PROFILE }));
  });

  it('escapes the version, which carries colons', () => {
    expect(profileAvatarUrl(PROFILE)).toContain('%3A');
  });
});
