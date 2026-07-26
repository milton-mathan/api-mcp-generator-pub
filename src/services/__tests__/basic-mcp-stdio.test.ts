/**
 * Regression tests for the basic (non-FastMCP) MCP server template.
 *
 * Both invariants here previously failed and produced the same user-visible
 * symptom: "Server error: unhandled errors in a TaskGroup (1 sub-exception)".
 */

import { describe, it, expect } from 'vitest';
import { MCPCodeGenerator } from '../mcpCodeGenerator';
import type { MCPGenerationConfig } from '../mcpCodeGenerator';
import type { ExtractedEndpoint } from '../../types/endpoint';

const endpoint = {
  id: 'ep1',
  method: 'GET',
  path: '/v1/customers',
  operationId: 'GetCustomers',
  summary: 'List customers',
  description: 'List customers',
  tags: [],
  parameters: [],
  responses: {},
  security: [],
  pathParameters: [],
  queryParameters: [],
  headerParameters: [],
  cookieParameters: [],
  hasRequestBody: false,
  hasExamples: false,
  responseStatusCodes: [],
  securitySchemes: [],
  complexity: 'simple',
  normalizedPath: '/v1/customers',
  pathTemplate: '/v1/customers',
  operationKey: 'GetCustomers',
  estimatedResponseSize: 'medium',
  cacheable: true,
  idempotent: true,
  safe: true,
} as ExtractedEndpoint;

function buildConfig(authConfigs: Record<string, unknown>): MCPGenerationConfig {
  return {
    serverName: 'test_basic_server',
    baseUrl: 'https://api.example.com',
    endpoints: [endpoint],
    authConfigs,
    toolNaming: 'operationId',
    includeExamples: true,
    errorHandling: 'detailed',
    pythonVersion: '3.11',
    useFastMCP: false,
    serverModes: ['stdio'],
    httpPort: 8000,
    logLevel: 'INFO',
    includeRunScripts: true,
  } as unknown as MCPGenerationConfig;
}

async function generateServer(authConfigs: Record<string, unknown>): Promise<string> {
  const project = await MCPCodeGenerator.generateProject(buildConfig(authConfigs));
  return project.files.find(f => f.path === 'server.py')!.content;
}

/** Generate a server from an arbitrary endpoint list. */
async function generateFrom(endpoints: ExtractedEndpoint[]): Promise<string> {
  const config = { ...buildConfig({}), endpoints } as MCPGenerationConfig;
  const project = await MCPCodeGenerator.generateProject(config);
  return project.files.find(f => f.path === 'server.py')!.content;
}

function param(name: string, where: string, required = false) {
  return { name, in: where, required, schema: { type: 'string' } };
}

const bearerAuth = {
  ep1: {
    type: 'bearer',
    envVarName: 'API_TOKEN',
    required: true,
    headerName: 'Authorization',
    location: 'header',
  },
};

describe('basic MCP server template', () => {
  describe('stdio transport hygiene', () => {
    // stdout carries the JSON-RPC stream. Any non-protocol byte written there
    // breaks the client's parser and surfaces as a TaskGroup error.
    it.each([
      ['without auth', {}],
      ['with auth', bearerAuth],
    ])('writes no plain text to stdout %s', async (_label, authConfigs) => {
      const server = await generateServer(authConfigs as Record<string, unknown>);

      const stdoutWrites = server
        .split('\n')
        .filter(line => /(^|\s)print\(/.test(line) && !line.includes('file=sys.stderr'));

      expect(stdoutWrites).toEqual([]);
    });

    it('routes startup and shutdown diagnostics to stderr', async () => {
      const server = await generateServer({});

      expect(server).toContain('print("Starting MCP server... (Press Ctrl+C to stop)", file=sys.stderr)');
      expect(server).toContain('print("\\nServer stopped by user", file=sys.stderr)');
      expect(server).toContain('file=sys.stderr');
    });
  });

  describe('mcp SDK handler contract', () => {
    // The SDK invokes the registered handler as func(tool_name, arguments) -
    // two positional arguments. A single CallToolRequest parameter raises
    // "call_tool() takes 1 positional argument but 2 were given" on every
    // tool call, so the server starts, lists its tools, and then fails at
    // the first thing a user actually does.
    it('declares call_tool with the two arguments the SDK passes', async () => {
      const server = await generateServer({});

      expect(server).toMatch(
        /@server\.call_tool\(\)\s*\nasync def call_tool\(\s*tool_name: str,\s*arguments: Dict\[str, Any\]/
      );
      expect(server).not.toMatch(/async def call_tool\(request: CallToolRequest\)/);
    });

    it('does not read the removed request object', async () => {
      const server = await generateServer({});

      expect(server).not.toContain('request.params.name');
      expect(server).not.toContain('request.params.arguments');
    });
  });

  describe('generated Python indentation', () => {
    // Each emitted block must end on a bare newline. A trailing indent becomes
    // leading indent on the next block, so the SECOND parameter onward lands
    // over-indented and Python raises IndentationError. Only reproducible with
    // two or more parameters of the same kind.
    it('indents every query parameter at the same level', async () => {
      const ep = {
        ...endpoint,
        parameters: [param('username', 'query'), param('password', 'query'), param('limit', 'query')],
      } as unknown as ExtractedEndpoint;

      const server = await generateFrom([ep]);
      const guards = server.split('\n').filter(l => /if "(username|password|limit)" in arguments:/.test(l));

      expect(guards).toHaveLength(3);
      const indents = guards.map(l => l.length - l.trimStart().length);
      expect(new Set(indents).size).toBe(1);
      expect(indents[0]).toBe(8);
    });

    it('indents every required path parameter at the same level', async () => {
      const ep = {
        ...endpoint,
        path: '/pets/{petId}/owners/{ownerId}',
        parameters: [param('petId', 'path', true), param('ownerId', 'path', true)],
      } as unknown as ExtractedEndpoint;

      const server = await generateFrom([ep]);
      const guards = server.split('\n').filter(l => /if (petId|ownerId) is None:/.test(l));

      expect(guards).toHaveLength(2);
      const indents = guards.map(l => l.length - l.trimStart().length);
      expect(new Set(indents).size).toBe(1);
    });

    it('leaves no line indented deeper than its block allows', async () => {
      const ep = {
        ...endpoint,
        parameters: [param('petId', 'path', true), param('a', 'query'), param('b', 'query')],
      } as unknown as ExtractedEndpoint;

      const server = await generateFrom([ep]);

      // A guard directly followed by a line indented 8+ further is the
      // signature of the trailing-indent defect.
      const lines = server.split('\n');
      const offenders = lines.filter((l, i) => {
        const next = lines[i + 1];
        if (!next || !l.trim() || !next.trim()) return false;
        const cur = l.length - l.trimStart().length;
        const nxt = next.length - next.trimStart().length;
        return !l.trimEnd().endsWith(':') && nxt > cur + 4;
      });

      expect(offenders).toEqual([]);
    });
  });

  describe('authentication wiring', () => {
    it('defines get_auth_headers exactly once', async () => {
      // A second definition later in the module shadows the real one, so every
      // auth header is silently dropped.
      for (const authConfigs of [{}, bearerAuth]) {
        const server = await generateServer(authConfigs as Record<string, unknown>);
        const definitions = server.match(/^def get_auth_headers/gm) || [];
        expect(definitions).toHaveLength(1);
      }
    });

    it('keeps the real auth implementation when auth is configured', async () => {
      const server = await generateServer(bearerAuth);

      // The surviving definition must read the generated config and the
      // environment, not be a stub that returns {}.
      const authFn = server.slice(server.indexOf('def get_auth_headers'));
      expect(authFn).toContain('AUTH_CONFIG');
      expect(authFn).toContain('os.getenv');
    });

    it('does not call auth helpers it never defines', async () => {
      const server = await generateServer(bearerAuth);

      const called = new Set(
        [...server.matchAll(/(?<![\w.])(get_auth_\w+|validate_auth_config)\s*\(/g)].map(m => m[1])
      );
      const defined = new Set(
        [...server.matchAll(/^def (get_auth_\w+|validate_auth_config)\s*\(/gm)].map(m => m[1])
      );

      for (const fn of called) {
        expect(defined).toContain(fn);
      }
    });
  });

  describe('advertised tool names', () => {
    // The basic template used to lowercase the name it published, while the
    // FastMCP template derives it from the Python function name and preserves
    // case - and the generated README documents the preserved casing for both.
    // A user following that README on a basic server got "Unknown tool".
    const mixedCase = {
      ...endpoint,
      operationId: 'findPetsByStatus',
    } as ExtractedEndpoint;

    it('publishes the operationId with its original casing', async () => {
      const server = await generateFrom([mixedCase]);

      expect(server).toContain('name="findPetsByStatus"');
      expect(server).not.toContain('name="findpetsbystatus"');
    });

    it('dispatches on the name it published', async () => {
      const server = await generateFrom([mixedCase]);

      expect(server).toContain('if tool_name == "findPetsByStatus":');
      expect(server).not.toContain('if tool_name == "findpetsbystatus":');
    });

    it('routes every advertised name to a handler that exists', async () => {
      const server = await generateFrom([
        mixedCase,
        { ...endpoint, id: 'ep2', operationId: 'getPetById' } as ExtractedEndpoint,
      ]);

      const advertised = [...server.matchAll(/^\s*name="([^"]+)",$/gm)].map(m => m[1]);
      expect(advertised).toEqual(['findPetsByStatus', 'getPetById']);

      for (const name of advertised) {
        // Published name -> dispatch arm -> defined handler must form a chain.
        const arm = new RegExp(
          `if tool_name == "${name}":\\s*\\n\\s*return await (handle_\\w+)\\(arguments\\)`
        );
        const match = server.match(arm);
        expect(match, `no dispatch arm for ${name}`).not.toBeNull();
        expect(server).toContain(`async def ${match![1]}(arguments:`);
      }
    });
  });

  describe('operationId sanitization', () => {
    // The operationId is author-controlled text from the spec. It reaches the
    // generator raw, and in the FastMCP template it becomes a Python function
    // name - so anything that is not a valid identifier is a syntax error in
    // the generated server, not a cosmetic problem.
    const withOpId = (operationId: string, extra: Partial<ExtractedEndpoint> = {}) =>
      ({ ...endpoint, operationId, ...extra }) as ExtractedEndpoint;

    const advertisedNames = (server: string) =>
      [...server.matchAll(/^\s*name="([^"]+)",$/gm)].map(m => m[1]);

    it.each([
      ['spaces', 'get pet by id', 'get_pet_by_id'],
      ['dots', 'pets.get.byId', 'pets_get_byId'],
      ['hyphens and slashes', 'get-pet/by-id', 'get_pet_by_id'],
      ['leading digits', '2getPet', 'getPet'],
      ['punctuation runs', 'get___pet!!!', 'get_pet'],
      ['unicode', 'gétPet', 'getPet'],
    ])('coerces %s into a valid identifier', async (_label, opId, expected) => {
      const server = await generateFrom([withOpId(opId)]);

      expect(advertisedNames(server)).toEqual([expected]);
      expect(server).toContain(`if tool_name == "${expected}":`);
    });

    it('does not emit a Python keyword as a tool name', async () => {
      const server = await generateFrom([withOpId('import')]);

      // `async def import(...)` would be a SyntaxError, taking down the whole
      // module rather than just this tool.
      expect(advertisedNames(server)).toEqual(['import_op']);
    });

    it('falls back to a path-derived name when nothing usable survives', async () => {
      const server = await generateFrom([withOpId('!!!', { path: '/v1/customers' })]);

      const [name] = advertisedNames(server);
      expect(name).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
      expect(name).toContain('customers');
    });

    it('gives colliding operationIds distinct names', async () => {
      const server = await generateFrom([
        withOpId('get pet'),
        withOpId('get-pet', { id: 'ep2' }),
        withOpId('get.pet', { id: 'ep3' }),
      ]);

      // All three sanitize to `get_pet`. Without suffixes the later handler
      // definitions shadow the first and two endpoints become unreachable.
      const names = advertisedNames(server);
      expect(names).toEqual(['get_pet', 'get_pet_2', 'get_pet_3']);
      expect(new Set(names).size).toBe(3);
    });

    it('produces the same names on every run', async () => {
      const endpoints = [withOpId('!!!'), withOpId('???', { id: 'ep2' })];

      // A Date.now() fallback used to make tool names differ between runs, so
      // a regenerated project silently broke every saved client config.
      const first = advertisedNames(await generateFrom(endpoints));
      const second = advertisedNames(await generateFrom(endpoints));

      expect(first).toEqual(second);
      expect(new Set(first).size).toBe(2);
    });

    it('emits only valid Python identifiers across a hostile spec', async () => {
      const server = await generateFrom([
        withOpId('get pet'),
        withOpId('class', { id: 'ep2' }),
        withOpId('9lives', { id: 'ep3' }),
        withOpId('a/b\\c:d', { id: 'ep4' }),
      ]);

      for (const name of advertisedNames(server)) {
        expect(name).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
      }
      for (const handler of [...server.matchAll(/^async def (\w+)\(/gm)].map(m => m[1])) {
        expect(handler).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
      }
    });
  });
});
