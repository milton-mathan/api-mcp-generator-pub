/**
 * Regression tests for defects found by running a generated server against the
 * live Swagger Petstore API (https://petstore.swagger.io/v2).
 *
 * Each of these produced a server that started cleanly and passed every static
 * check, yet could not successfully call the API it was generated for.
 */

import { describe, it, expect } from 'vitest';
import { extractEndpoints } from '../endpointExtractor';
import { MCPCodeGenerator } from '../mcpCodeGenerator';
import type { MCPGenerationConfig } from '../mcpCodeGenerator';
import type { ExtractedEndpoint } from '../../types/endpoint';

/** A Swagger 2.0 spec: parameter types sit on the parameter, not under `schema`. */
const swagger2Spec = {
  swagger: '2.0',
  info: { title: 'Petstore', version: '1.0.0' },
  host: 'petstore.swagger.io',
  basePath: '/v2',
  paths: {
    '/pet/{petId}': {
      get: {
        operationId: 'getPetById',
        summary: 'Find pet by ID',
        parameters: [{ name: 'petId', in: 'path', required: true, type: 'integer', format: 'int64' }],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/pet/findByStatus': {
      get: {
        operationId: 'findPetsByStatus',
        summary: 'Find pets by status',
        parameters: [{ name: 'status', in: 'query', required: true, type: 'array', items: { type: 'string' } }],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

function generate(endpoints: ExtractedEndpoint[], useFastMCP: boolean, baseUrl: string) {
  return MCPCodeGenerator.generateProject({
    serverName: 'petstore_v2',
    baseUrl,
    endpoints,
    authConfigs: {},
    toolNaming: 'operationId',
    includeExamples: true,
    errorHandling: 'detailed',
    pythonVersion: '3.11',
    useFastMCP,
    serverModes: ['stdio'],
    httpPort: 8000,
    logLevel: 'INFO',
    includeRunScripts: true,
  } as unknown as MCPGenerationConfig);
}

describe('generated server HTTP behaviour', () => {
  describe('base URL with a path prefix', () => {
    // urljoin("https://host/v2", "pets") -> "https://host/pets". A base path
    // without a trailing slash is treated as a file, so the API version prefix
    // is silently dropped and every request 404s.
    it.each([
      ['FastMCP', true],
      ['basic MCP', false],
    ])('preserves the base path in %s output', async (_label, useFastMCP) => {
      const endpoints = extractEndpoints(swagger2Spec as never);
      const project = await generate(endpoints, useFastMCP, 'https://petstore.swagger.io/v2');
      const server = project.files.find(f => f.path === 'server.py')!.content;

      // Match a real call, not the explanatory comment that names urljoin.
      expect(server).not.toMatch(/^\s*(url\s*=\s*)?urljoin\(/m);
      expect(server).not.toMatch(/^from urllib\.parse import urljoin$/m);
      expect(server).toContain("self.base_url.rstrip('/') + '/' + endpoint.lstrip('/')");
    });

    it('concatenation preserves the prefix for the cases urljoin broke', () => {
      // Mirror of the generated Python, exercised directly.
      const join = (base: string, ep: string) => base.replace(/\/+$/, '') + '/' + ep.replace(/^\/+/, '');

      expect(join('https://petstore.swagger.io/v2', '/store/inventory'))
        .toBe('https://petstore.swagger.io/v2/store/inventory');
      expect(join('https://petstore.swagger.io/v2/', '/pet/1'))
        .toBe('https://petstore.swagger.io/v2/pet/1');
      expect(join('https://api.example.com', '/users'))
        .toBe('https://api.example.com/users');
    });
  });

  describe('Swagger 2.0 parameter types', () => {
    // Swagger 2.0 declares `type` directly on non-body parameters; only
    // OpenAPI 3.x nests it under `schema`. Reading `schema.type` alone makes
    // every 2.0 parameter fall back to string, so an integer path parameter is
    // typed `str` and rejects the integer the caller passes.
    it('lifts the flat type onto the parameter schema', () => {
      const endpoints = extractEndpoints(swagger2Spec as never);

      const petId = endpoints
        .find(e => e.path === '/pet/{petId}')!
        .parameters.find(p => p.name === 'petId');
      expect(petId?.schema?.type).toBe('integer');

      const status = endpoints
        .find(e => e.path === '/pet/findByStatus')!
        .parameters.find(p => p.name === 'status');
      expect(status?.schema?.type).toBe('array');
    });

    it('emits the corresponding Python types', async () => {
      const endpoints = extractEndpoints(swagger2Spec as never);
      const project = await generate(endpoints, true, 'https://petstore.swagger.io/v2');
      const server = project.files.find(f => f.path === 'server.py')!.content;

      expect(server).toMatch(/async def getPetById\(petId: int\)/);
      expect(server).toMatch(/async def findPetsByStatus\(status: list\)/);
      expect(server).not.toMatch(/async def getPetById\(petId: str\)/);
    });
  });

  describe('tool return annotation', () => {
    // FastMCP validates the return value against the annotation. Declaring
    // `-> dict` breaks every endpoint that returns a JSON array, with
    // "structured_content must be a dict or None. Got list".
    it('does not constrain tool returns to dict', async () => {
      const endpoints = extractEndpoints(swagger2Spec as never);
      const project = await generate(endpoints, true, 'https://petstore.swagger.io/v2');
      const server = project.files.find(f => f.path === 'server.py')!.content;

      expect(server).not.toMatch(/^async def \w+\([^)]*\) -> dict:/m);
      expect(server).toMatch(/^async def \w+\([^)]*\) -> Any:/m);
    });
  });
});
