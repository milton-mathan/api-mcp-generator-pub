/**
 * Resolve the API base URL from a parsed specification.
 *
 * OpenAPI 3.x supplies `servers`. Swagger 2.0 has no such field - the address is
 * split across `schemes`, `host` and `basePath`. Reading only `servers` meant
 * every Swagger 2.0 spec fell through to a hardcoded placeholder host, and the
 * generated server raised an httpx connection error against a domain that does
 * not resolve.
 */

/** The subset of a specification needed to determine the base URL. */
export interface BaseUrlSource {
  servers?: Array<{ url?: string }>;
  /** Swagger 2.0 equivalents of `servers`. */
  host?: string;
  basePath?: string;
  schemes?: string[];
}

export function resolveBaseUrl(spec: BaseUrlSource): string {
  const fromServers = spec.servers?.[0]?.url;
  if (fromServers) return fromServers;

  if (spec.host) {
    const scheme = spec.schemes?.includes('https') ? 'https' : spec.schemes?.[0] || 'https';
    return `${scheme}://${spec.host}${spec.basePath ?? ''}`;
  }

  // Deliberately empty rather than a placeholder: an empty value shows the user
  // the field needs filling in, where a made-up host produces a server that
  // fails only at runtime.
  return '';
}
