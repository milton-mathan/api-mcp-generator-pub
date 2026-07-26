/**
 * Packaging and deployment of generated projects.
 *
 * Docker and plain local execution are the primary ways these servers get run,
 * so the Dockerfile, the dependency list and the Docker instructions are part
 * of the product, not an afterthought.
 */

import { describe, it, expect } from 'vitest';
import { MCPCodeGenerator } from '../mcpCodeGenerator';
import type { MCPGenerationConfig } from '../mcpCodeGenerator';
import type { ExtractedEndpoint } from '../../types/endpoint';

const endpoint = {
  id: 'ep1',
  method: 'GET',
  path: '/pets',
  operationId: 'listPets',
  summary: 'List pets',
  description: 'List pets',
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
  normalizedPath: '/pets',
  pathTemplate: '/pets',
  operationKey: 'listPets',
  estimatedResponseSize: 'medium',
  cacheable: true,
  idempotent: true,
  safe: true,
} as ExtractedEndpoint;

async function generate(useFastMCP: boolean) {
  const project = await MCPCodeGenerator.generateProject({
    serverName: 'petstore',
    baseUrl: 'https://petstore.swagger.io/v2',
    endpoints: [endpoint],
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

  const file = (path: string) => project.files.find(f => f.path === path)?.content ?? '';
  return { project, server: file('server.py'), requirements: file('requirements.txt'), readme: file('README.md'), dockerfile: file('Dockerfile') };
}

describe('generated project packaging', () => {
  describe('dependencies', () => {
    // Every entry costs install time on each pip run and each Docker build, and
    // is a supply-chain surface for code that never executes. These three were
    // shipped for a long time without a single import referencing them.
    it.each([
      ['FastMCP', true],
      ['basic MCP', false],
    ])('lists no package the %s server never imports', async (_label, useFastMCP) => {
      const { requirements, server } = await generate(useFastMCP);

      for (const stray of ['asyncio-mqtt', 'uvicorn', 'python-multipart']) {
        expect(requirements).not.toContain(stray);
      }

      // Whatever is listed should be traceable to the generated source.
      const packages = requirements
        .split('\n')
        .map(l => l.trim().split(/[>=<~[]/)[0])
        .filter(Boolean);

      expect(packages.length).toBeGreaterThan(0);
      for (const pkg of packages) {
        expect(server.toLowerCase()).toContain(pkg.toLowerCase());
      }
    });

    it('includes the framework each template actually uses', async () => {
      expect((await generate(true)).requirements).toContain('fastmcp');
      expect((await generate(false)).requirements).toContain('mcp>=');
      expect((await generate(true)).requirements).toContain('httpx');
    });

    // `project.dependencies` is what the results screen renders
    // (MCPResults.tsx) and what the export summary counts. It was computed by
    // a separate function that ignored its config and returned a hardcoded
    // list, so every user - FastMCP or not - was shown `asyncio-mqtt`, which
    // nothing imports, and never shown `fastmcp`, which the server needs.
    it.each([
      ['FastMCP', true],
      ['basic MCP', false],
    ])('shows the %s user the same packages requirements.txt pins', async (_label, useFastMCP) => {
      const { project, requirements } = await generate(useFastMCP as boolean);

      const listed = requirements.split('\n').map(l => l.trim()).filter(Boolean);
      expect(project.dependencies).toEqual(listed);
    });

    it('never advertises a package requirements.txt omits', async () => {
      for (const useFastMCP of [true, false]) {
        const { project } = await generate(useFastMCP);
        expect(project.dependencies).not.toContain('asyncio-mqtt>=0.11.0');
      }
    });

    it('declares mcp for FastMCP, since the shipped test client imports it', async () => {
      // test_client.py does `from mcp import ClientSession`. fastmcp happens
      // to depend on mcp, so this worked only transitively.
      const { requirements } = await generate(true);
      expect(requirements).toContain('mcp>=1.0.0');
    });
  });

  describe('Docker instructions', () => {
    it.each([
      ['FastMCP', true],
      ['basic MCP', false],
    ])('documents Docker for the %s template', async (_label, useFastMCP) => {
      const { readme, dockerfile } = await generate(useFastMCP);

      // A Dockerfile is always generated, so the instructions must always be
      // present. They used to appear only for FastMCP with HTTP mode enabled.
      expect(dockerfile).toContain('FROM python:');
      expect(readme).toContain('## Docker');
      expect(readme).toContain('docker build -t petstore .');
    });

    it('tells the user to run with -i, and why', async () => {
      const { readme } = await generate(true);

      // Without -i the container has no stdin, so a stdio MCP server exits
      // immediately. This is the single most likely thing to go wrong.
      expect(readme).toContain('docker run -i');
      expect(readme).toMatch(/`-i` flag is required/);
      expect(readme).toMatch(/stdin/i);
    });

    it('warns against -t corrupting the protocol stream', async () => {
      const { readme } = await generate(true);

      expect(readme).toMatch(/Do not pass `-t`/);
      expect(readme).toMatch(/corrupts the protocol stream/i);
    });

    it('shows how to supply credentials', async () => {
      const { readme } = await generate(true);

      expect(readme).toContain('--env-file .env');
      expect(readme).toMatch(/-e API_KEY=/);
    });
  });
});
