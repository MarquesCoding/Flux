import { describe, expect, it } from 'vitest';
import { nameForViewer } from './nameForViewer';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const profile = (over: Partial<ViewerProfile> = {}): ViewerProfile => ({
  id: '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f',
  name: 'Dan',
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  askStillWatchingAfter: 4,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

describe('nameForViewer', () => {
  it('names the profile the session said it was', () => {
    const held = [profile(), profile({ id: 'aadaab3e-476a-495d-bfa0-fab0ad750504', name: 'Jeff' })];

    expect(nameForViewer(held, 'aadaab3e-476a-495d-bfa0-fab0ad750504')).toBe('Jeff');
  });

  it('names the account holder where the session named nobody', () => {
    const held = [profile(), profile({ id: 'aadaab3e-476a-495d-bfa0-fab0ad750504', name: 'Jeff' })];

    expect(nameForViewer(held, null)).toBe('Dan');
  });

  it('names the account holder where the session named somebody who has gone', () => {
    expect(nameForViewer([profile()], 'e91bc198-569e-4da4-92f4-4173880ac05e')).toBe('Dan');
  });

  it('has no name for an account carrying no profile at all', () => {
    expect(nameForViewer([], null)).toBeNull();
  });
});
