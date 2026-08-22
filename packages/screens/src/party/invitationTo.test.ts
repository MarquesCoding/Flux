import { describe, expect, it } from 'vitest';
import { invitationTo } from './invitationTo';
import { readLocation } from '@ValenceClient/navigation/readLocation';

describe('invitationTo', () => {
  it('names the party', () => {
    expect(invitationTo('party-1', 'a-film', 'https://valence.local')).toContain('party-1');
  });

  it('names what the party is watching', () => {
    expect(invitationTo('party-1', 'a-film', 'https://valence.local')).toContain('a-film');
  });

  it('is absolute, since it is going somewhere else', () => {
    expect(invitationTo('party-1', 'a-film', 'https://valence.local')).toMatch(
      /^https:\/\/valence\.local\//,
    );
  });

  it('arrives where it was made, read back by the application itself', () => {
    const invitation = invitationTo('party-1', 'a-film', 'https://valence.local');
    const arrived = readLocation(invitation);

    expect(arrived.party).toBe('party-1');
    expect(arrived.playing).toBe('a-film');
  });

  it('carries no credential of its own, only where to go', () => {
    const invitation = invitationTo('party-1', 'a-film', 'https://valence.local');

    expect(invitation).not.toMatch(/token|secret|key/i);
  });

  it('survives a party identifier that needs escaping', () => {
    const invitation = invitationTo('party one/two', 'a-film', 'https://valence.local');

    expect(readLocation(invitation).party).toBe('party one/two');
  });
});
