import { describe, expect, it } from 'vitest';
import { readServerAddress } from './readServerAddress';

describe('readServerAddress', () => {
  it('keeps an address given in full', () => {
    expect(readServerAddress('https://flux.example.com')).toEqual({
      address: 'https://flux.example.com',
    });
  });

  it('assumes https for a bare host, which is what people type', () => {
    expect(readServerAddress('flux.example.com')).toEqual({
      address: 'https://flux.example.com',
    });
  });

  it('keeps a port, which a server on a home network will be on', () => {
    expect(readServerAddress('192.168.1.20:8420')).toEqual({
      address: 'https://192.168.1.20:8420',
    });
  });

  it('keeps http where somebody asked for it, since a home server may not have a certificate', () => {
    expect(readServerAddress('http://192.168.1.20:8420')).toEqual({
      address: 'http://192.168.1.20:8420',
    });
  });

  it('drops a trailing slash, since every path is joined onto this', () => {
    expect(readServerAddress('https://flux.example.com/')).toEqual({
      address: 'https://flux.example.com',
    });
  });

  it('keeps a path, for a Valence served under one', () => {
    expect(readServerAddress('https://example.com/flux/')).toEqual({
      address: 'https://example.com/flux',
    });
  });

  it('ignores the space somebody pasted with it', () => {
    expect(readServerAddress('  https://flux.example.com  ')).toEqual({
      address: 'https://flux.example.com',
    });
  });

  it('asks for something rather than accepting nothing', () => {
    expect(readServerAddress('')).toHaveProperty('problem');
    expect(readServerAddress('   ')).toHaveProperty('problem');
  });

  it('refuses something that is not an address at all', () => {
    expect(readServerAddress('not a server')).toHaveProperty('problem');
  });

  it('refuses a scheme a server is not reached over', () => {
    expect(readServerAddress('ftp://flux.example.com')).toHaveProperty('problem');
  });

  it('says why, rather than refusing without a reason', () => {
    const read = readServerAddress('not a server');

    expect('problem' in read && read.problem.length > 0).toBe(true);
  });
});
