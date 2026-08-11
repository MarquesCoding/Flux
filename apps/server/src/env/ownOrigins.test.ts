import { describe, expect, it, vi } from 'vitest';
import { ownOrigins, ownAddresses, portsIn } from './ownOrigins';

vi.mock('node:os', () => ({
  networkInterfaces: () => ({
    lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    en0: [
      { address: '192.168.1.165', family: 'IPv4', internal: false },
      { address: 'fe80::1', family: 'IPv6', internal: false },
    ],
    awdl0: undefined,
  }),
}));

describe('ownAddresses', () => {
  it('answers with the addresses the network can reach', () => {
    expect(ownAddresses()).toEqual(['192.168.1.165']);
  });

  it('leaves out the address that means this machine', () => {
    // Already trusted by name, and offering it as a network address is how a
    // television ends up fetching from itself.
    expect(ownAddresses()).not.toContain('127.0.0.1');
  });
});

describe('portsIn', () => {
  it('takes the ports somebody is already reading Flux at', () => {
    expect(portsIn(['http://localhost:5173', 'http://localhost:8420'], 8420)).toEqual([5173, 8420]);
  });

  it('includes the port the server answers on, whatever was configured', () => {
    expect(portsIn(['http://localhost:5173'], 8420)).toContain(8420);
  });

  it('says each port once', () => {
    expect(portsIn(['http://localhost:8420', 'http://localhost:8420'], 8420)).toEqual([8420]);
  });

  it('passes over something that is not an address', () => {
    expect(portsIn(['nonsense'], 8420)).toEqual([8420]);
  });
});

describe('ownOrigins', () => {
  it('trusts this machine at every address and port it can be read at', () => {
    expect(ownOrigins(['http://localhost:5173'], 8420)).toEqual([
      'http://192.168.1.165:5173',
      'https://192.168.1.165:5173',
      'http://192.168.1.165:8420',
      'https://192.168.1.165:8420',
    ]);
  });

  it('trusts either scheme, since a certificate can appear at any time', () => {
    // Casting is offered by browsers only over a secure connection, so a home
    // server grows a certificate the moment somebody wants to use it.
    expect(ownOrigins([], 8420)).toContain('https://192.168.1.165:8420');
  });

  it('trusts only addresses this machine actually holds', () => {
    // A different thing from trusting the network: somebody else's laptop
    // cannot borrow this by asking.
    expect(ownOrigins([], 8420)).toEqual([
      'http://192.168.1.165:8420',
      'https://192.168.1.165:8420',
    ]);
  });
});
