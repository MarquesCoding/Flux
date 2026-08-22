import { describe, expect, it } from 'vitest';
import { redactSecrets } from './redactSecrets';

describe('redactSecrets', () => {
  it('hides the catalogue key from a request URL', () => {
    const line = redactSecrets(
      'catalogue: https://api.themoviedb.org/3/search/movie?api_key=abcdef0123456789&query=Alien failed',
    );

    expect(line).not.toContain('abcdef0123456789');
    expect(line).toContain('query=Alien');
  });

  it('keeps enough of the URL to say what failed', () => {
    const line = redactSecrets('catalogue: https://api.themoviedb.org/3/search/movie?api_key=k');

    expect(line).toContain('api.themoviedb.org/3/search/movie');
  });

  it('hides a bearer token', () => {
    expect(redactSecrets('authorization: Bearer sk-live-01234567890abcdef')).not.toContain(
      'sk-live-01234567890abcdef',
    );
  });

  it('says which scheme was used, since that is diagnostic', () => {
    expect(redactSecrets('authorization: Bearer sk-live-01234567890abcdef')).toContain('Bearer');
  });

  it('hides a JSON web token wherever it appears', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1g';

    expect(redactSecrets(`session ${jwt} expired`)).not.toContain(jwt);
  });

  it('hides a share token in a link, since a logged share link is a working share link', () => {
    const line = redactSecrets('share opened /api/share/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5');

    expect(line).not.toContain('Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5');
  });

  it('hides a share token in the guest link as well as the api one', () => {
    expect(redactSecrets('sent /share/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5')).not.toContain(
      'Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5',
    );
  });

  it('hides a share cookie', () => {
    expect(redactSecrets('cookie: valence_share=Zm9vYmFyYmF6cXV4MTIz; other=1')).not.toContain(
      'Zm9vYmFyYmF6cXV4MTIz',
    );
  });

  it('leaves an unrelated cookie alone', () => {
    expect(redactSecrets('cookie: valence_share=abc12345; theme=dark')).toContain('theme=dark');
  });

  it('hides a password reset link, which is a way into an account', () => {
    const line = redactSecrets(
      'password reset for sam@example.com: https://valence.local/reset?token=Zm9vYmFyYmF6cXV4MTIz',
    );

    expect(line).not.toContain('Zm9vYmFyYmF6cXV4MTIz');
  });

  it('hides who a reset was for, keeping the domain', () => {
    const line = redactSecrets('password reset for sam@example.com');

    expect(line).not.toContain('sam@');
    expect(line).toContain('@example.com');
  });

  it('hides a secret written as a key and value', () => {
    expect(redactSecrets('settings { catalogueApiKey: abcdef0123456789 }')).not.toContain(
      'abcdef0123456789',
    );
  });

  it('hides a secret written as JSON', () => {
    expect(redactSecrets('{"token":"abcdef0123456789","kind":"scan"}')).not.toContain(
      'abcdef0123456789',
    );
  });

  it('keeps what a JSON record was about', () => {
    expect(redactSecrets('{"token":"abcdef0123456789","kind":"scan"}')).toContain('"kind":"scan"');
  });

  it('leaves a file path alone, which is most of what makes a scan log useful', () => {
    const path = 'skipped /Volumes/Media/Films/The Matrix (1999)/The Matrix.mkv: unreadable';

    expect(redactSecrets(path)).toBe(path);
  });

  it('leaves a path containing a long word alone', () => {
    const path = 'skipped /media/films/AVeryLongTitleWithoutAnySpaces2160pHDR.mkv: no audio';

    expect(redactSecrets(path)).toBe(path);
  });

  it('leaves an identifier alone, since a log is unreadable without one', () => {
    const line = 'scan 2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f finished';

    expect(redactSecrets(line)).toBe(line);
  });

  it('leaves an ordinary sentence alone', () => {
    const line = 'job queue: the media service did not answer';

    expect(redactSecrets(line)).toBe(line);
  });

  it('leaves a duration and a count alone', () => {
    const line = 'scan finished: 4000 files in 12.5s';

    expect(redactSecrets(line)).toBe(line);
  });

  it('hides every secret in a line carrying more than one', () => {
    const line = redactSecrets('GET /x?api_key=abcdef0123456789&token=zyxwvu9876543210');

    expect(line).not.toContain('abcdef0123456789');
    expect(line).not.toContain('zyxwvu9876543210');
  });

  it('leaves an empty line alone', () => {
    expect(redactSecrets('')).toBe('');
  });
});

describe('a cookie set before the rename', () => {
  it('is still taken out, since it is still in somebody browser and still works', () => {
    expect(redactSecrets('cookie: flux_share=abc123def456')).not.toContain('abc123def456');
  });
});
