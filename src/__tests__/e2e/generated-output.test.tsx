/**
 * End-to-end test of the UI data path, asserting on the generated Python.
 *
 * Every other test in this suite asserts on rendered DOM text. All of them
 * passed throughout the period when the UI was reconstructing endpoints from
 * id strings - producing servers whose paths were mangled to `//pets/{petId}`
 * and whose tools had no parameters at all. Checking that a heading rendered
 * could never have caught that.
 *
 * This test drives the real components with no service mocked, then inspects
 * the artifact the user actually downloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { render, screen, fireEvent, waitFor } from '../../test/utils';
import { App } from '../../App';
import { createMockFile } from '../../test/utils';
import { parseSpecFromFile } from '../../services/specParser';
import { extractEndpoints } from '../../services/endpointExtractor';
import { MCPCodeGenerator } from '../../services/mcpCodeGenerator';
import type { MCPGenerationConfig } from '../../services/mcpCodeGenerator';
import { resolveBaseUrl } from '../../services/baseUrlResolver';
import type { ParsedSpec } from '../../types';

/**
 * Reproduce exactly what the UI does: parse -> extract -> select -> generate.
 * On its own this only verifies the pipeline - if a component stopped calling
 * these services, these assertions would keep passing. The second describe
 * block below drives the real components and closes that gap.
 */
async function generateFromSampleSpec(useFastMCP: boolean) {
  const content = readFileSync('sample-api.json', 'utf-8');

  const parsed = await parseSpecFromFile({
    file: null as unknown as File,
    content,
    type: 'json',
    size: content.length,
    lastModified: Date.now(),
  });
  expect(parsed.errors).toHaveLength(0);

  const spec = parsed.spec as unknown as ParsedSpec;
  const endpoints = extractEndpoints(spec);

  const project = await MCPCodeGenerator.generateProject({
    serverName: 'sample_api',
    baseUrl: resolveBaseUrl(spec),
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

  return {
    spec,
    endpoints,
    server: project.files.find(f => f.path === 'server.py')!.content,
  };
}

describe('generated server reflects the specification', () => {
  it('preserves path templates exactly', async () => {
    const { server } = await generateFromSampleSpec(true);

    // The regression: ids were split and rejoined, yielding `//pets/{petId}`
    // with the parameter left as a literal segment.
    expect(server).toContain('/pets/{petId}');
    expect(server).not.toContain('//pets');
    expect(server).not.toMatch(/["']\/\/[a-z]/);
    expect(server).not.toContain('/pets/petid');
  });

  it('carries query parameters onto the tools', async () => {
    const { server } = await generateFromSampleSpec(true);

    // /pets declares limit and breed. Reconstruction dropped both.
    expect(server).toMatch(/async def listPets\([^)]*limit/);
    expect(server).toMatch(/async def listPets\([^)]*breed/);
  });

  it('carries path parameters onto the tools', async () => {
    const { server } = await generateFromSampleSpec(true);

    expect(server).toMatch(/async def showPetById\([^)]*petId/);
  });

  it('substitutes path parameters at request time', async () => {
    const { server } = await generateFromSampleSpec(true);

    // The template must be formatted with the argument, not sent literally.
    expect(server).toMatch(/\.format\(\s*petId\s*=\s*petId\s*\)/);
  });

  it('produces one tool per selected endpoint', async () => {
    const { endpoints, server } = await generateFromSampleSpec(true);

    const tools = server.match(/@app\.tool/g) || [];
    expect(tools).toHaveLength(endpoints.length);
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it('derives the base URL from the specification', async () => {
    const { spec, server } = await generateFromSampleSpec(true);

    const expected = resolveBaseUrl(spec);
    expect(expected).not.toBe('');
    expect(server).toContain(`BASE_URL = "${expected}"`);
    // The old fallback shipped servers pointed at a domain that does not exist.
    expect(server).not.toContain('https://api.example.com"');
  });

  it('emits the same paths for the basic MCP template', async () => {
    const { server } = await generateFromSampleSpec(false);

    expect(server).toContain('/pets/{petId}');
    expect(server).not.toContain('//pets');
  });
});

/**
 * The guard that matters.
 *
 * The tests above call the services directly, which is exactly the shape of
 * the suite that stayed green while the UI was broken. They verify the
 * pipeline, not the wiring. This block drives the real components and asserts
 * on what the UI actually hands to the generator - so if a component ever
 * stops using the service layer again, it fails here.
 */
describe('the UI hands real endpoint data to the generator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes fully extracted endpoints, not reconstructed stubs', async () => {
    const generateSpy = vi.spyOn(MCPCodeGenerator, 'generateProject');

    render(<App />);

    const content = readFileSync('sample-api.json', 'utf-8');
    const fileInput = document.getElementById('file-upload');
    fireEvent.change(fileInput!, {
      target: { files: [createMockFile(content, 'sample-api.json')] },
    });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Select the endpoint that carries a path parameter.
    const checkboxes = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i });
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach(box => fireEvent.click(box));

    // Explorer -> generator config screen.
    fireEvent.click(screen.getAllByText(/Generate MCP Server/i)[0]);

    // The config screen has its own generate button; that is what actually
    // invokes the code generator.
    const generateButtons = await screen.findAllByRole(
      'button',
      { name: /Generate MCP Server/i },
      { timeout: 5000 },
    );
    fireEvent.click(generateButtons[generateButtons.length - 1]);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalled();
    }, { timeout: 10000 });

    const config = generateSpy.mock.calls[0][0] as MCPGenerationConfig;
    const endpoints = config.endpoints;

    // Paths survive intact - no doubled slash, no lowercasing.
    const paths = endpoints.map(e => e.path);
    expect(paths).toContain('/pets/{petId}');
    expect(paths.some(p => p.startsWith('//'))).toBe(false);

    // Parameters are present. Reconstruction hardcoded `parameters: []`.
    const listPets = endpoints.find(e => e.operationId === 'listPets');
    expect(listPets).toBeDefined();
    expect(listPets!.parameters.map(p => p.name)).toEqual(
      expect.arrayContaining(['limit', 'breed'])
    );

    const showPet = endpoints.find(e => e.operationId === 'showPetById');
    expect(showPet!.pathParameters.map(p => p.name)).toContain('petId');

    // The base URL comes from the spec, not a placeholder host.
    expect(config.baseUrl).not.toBe('https://api.example.com');
    expect(config.baseUrl).not.toBe('');
  }, 30000);
});
