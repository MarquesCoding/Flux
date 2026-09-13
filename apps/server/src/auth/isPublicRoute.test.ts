import { describe, expect, it } from 'vitest';
import { isPublicRoute } from './isPublicRoute';

describe('isPublicRoute', () => {
  it('lets an orchestrator poll health', () => {
    expect(isPublicRoute('GET', '/api/health')).toBe(true);
  });

  it('lets a browser ask whether setup is needed, and complete it', () => {
    expect(isPublicRoute('GET', '/api/setup/status')).toBe(true);
    expect(isPublicRoute('POST', '/api/setup')).toBe(true);
  });

  it('leaves better-auth to answer for its own routes', () => {
    expect(isPublicRoute('GET', '/api/auth/get-session')).toBe(true);
    expect(isPublicRoute('POST', '/api/auth/sign-in/email')).toBe(true);
  });

  describe('the sign-in screen', () => {
    it('keeps who lives here to itself until the server says otherwise', () => {
      expect(isPublicRoute('GET', '/api/profiles/everyone')).toBe(false);
      expect(isPublicRoute('GET', '/api/profiles/prf_1/avatar')).toBe(false);
    });

    it('shows the faces where the server is set to show them', () => {
      expect(isPublicRoute('GET', '/api/profiles/everyone', true)).toBe(true);
      expect(isPublicRoute('GET', '/api/profiles/prf_1/avatar', true)).toBe(true);
    });

    it('draws the generated ones either way, since they say nothing about anybody', () => {
      expect(isPublicRoute('GET', '/api/profiles/avatars/rings')).toBe(true);
      expect(isPublicRoute('GET', '/api/profiles/avatars/rings', true)).toBe(true);
    });

    it('takes a password for a face either way, which needs the identifier already', () => {
      expect(isPublicRoute('POST', '/api/profiles/prf_1/sign-in')).toBe(true);
      expect(isPublicRoute('POST', '/api/profiles/prf_1/sign-in', true)).toBe(true);
    });
  });

  it('publishes the specification and the reference', () => {
    expect(isPublicRoute('GET', '/api/openapi.json')).toBe(true);
    expect(isPublicRoute('GET', '/api/reference')).toBe(true);
  });

  describe('everything else', () => {
    it('keeps the catalogue behind a session', () => {
      expect(isPublicRoute('GET', '/api/libraries')).toBe(false);
      expect(isPublicRoute('GET', '/api/libraries/lib_1/items')).toBe(false);
    });

    it('keeps the media itself behind a session', () => {
      expect(isPublicRoute('GET', '/api/playback/med_1/file')).toBe(false);
      expect(isPublicRoute('GET', '/api/playback/med_1/trickplay')).toBe(false);
    });

    it('keeps every way of changing a library behind a session', () => {
      expect(isPublicRoute('POST', '/api/libraries')).toBe(false);
      expect(isPublicRoute('POST', '/api/libraries/lib_1/reset')).toBe(false);
      expect(isPublicRoute('POST', '/api/libraries/lib_1/scan')).toBe(false);
    });

    it('keeps what somebody watched to themselves', () => {
      expect(isPublicRoute('GET', '/api/progress')).toBe(false);
      expect(isPublicRoute('GET', '/api/favourites')).toBe(false);
    });

    it('keeps the admin area behind a session', () => {
      expect(isPublicRoute('GET', '/api/admin/overview')).toBe(false);
      expect(isPublicRoute('GET', '/api/admin/monitor')).toBe(false);
    });
  });

  describe('matching', () => {
    it('reads a path being public as no licence to write to it', () => {
      expect(isPublicRoute('POST', '/api/profiles/prf_1/avatar')).toBe(false);
      expect(isPublicRoute('POST', '/api/health')).toBe(false);
      expect(isPublicRoute('GET', '/api/setup')).toBe(false);
    });

    it('accepts the method however the request spells it', () => {
      expect(isPublicRoute('get', '/api/health')).toBe(true);
    });

    it('does not let a public path prefix carry a longer one in with it', () => {
      expect(isPublicRoute('GET', '/api/health/secrets')).toBe(false);
      expect(isPublicRoute('GET', '/api/profiles/everyone/detail')).toBe(false);
      expect(isPublicRoute('GET', '/api/profiles/prf_1/avatar/original')).toBe(false);
    });

    it('does not treat a nested profile path as one of the faces', () => {
      expect(isPublicRoute('GET', '/api/profiles/prf_1')).toBe(false);
      expect(isPublicRoute('GET', '/api/profiles')).toBe(false);
    });
  });
});
