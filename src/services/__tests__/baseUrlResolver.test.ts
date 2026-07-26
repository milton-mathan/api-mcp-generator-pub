/**
 * The UI passes the raw parsed specification straight to MCPGenerator, so the
 * base URL has to be derived from whichever fields that spec version uses.
 *
 * Swagger 2.0 has no `servers`; before this was handled, every 2.0 spec fell
 * through to a hardcoded placeholder and the generated server raised an httpx
 * connection error against a domain that does not resolve.
 */
import { describe, it, expect } from 'vitest';
import { resolveBaseUrl } from '../baseUrlResolver';

describe('resolveBaseUrl', () => {
  it('uses servers[0].url for OpenAPI 3.x', () => {
    expect(resolveBaseUrl({ servers: [{ url: 'https://api.example.org/v1' }] }))
      .toBe('https://api.example.org/v1');
  });

  it('builds the URL from schemes/host/basePath for Swagger 2.0', () => {
    expect(resolveBaseUrl({
      host: 'petstore.swagger.io',
      basePath: '/v2',
      schemes: ['https', 'http'],
    })).toBe('https://petstore.swagger.io/v2');
  });

  it('prefers https when the spec offers both', () => {
    expect(resolveBaseUrl({ host: 'api.test', schemes: ['http', 'https'] }))
      .toBe('https://api.test');
  });

  it('falls back to the single declared scheme', () => {
    expect(resolveBaseUrl({ host: 'api.test', basePath: '/v3', schemes: ['http'] }))
      .toBe('http://api.test/v3');
  });

  it('defaults to https when no scheme is declared', () => {
    expect(resolveBaseUrl({ host: 'api.test', basePath: '/v1' }))
      .toBe('https://api.test/v1');
  });

  it('never invents an unreachable placeholder host', () => {
    // An empty string surfaces as "you must set this"; a made-up domain
    // produces a server that fails at runtime instead.
    expect(resolveBaseUrl({})).toBe('');
    expect(resolveBaseUrl({})).not.toContain('example.com');
  });

  it('prefers servers over the Swagger 2.0 fields when both exist', () => {
    expect(resolveBaseUrl({
      servers: [{ url: 'https://preferred.test/v9' }],
      host: 'ignored.test',
      basePath: '/nope',
    })).toBe('https://preferred.test/v9');
  });
});
