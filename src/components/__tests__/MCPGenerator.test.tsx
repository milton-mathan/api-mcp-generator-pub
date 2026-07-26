/**
 * Generation failure must be visible.
 *
 * When `MCPCodeGenerator.generateProject` threw, this component used to swallow
 * the error and substitute a hand-written stub project, then call
 * `setIsGenerated(true)`. The user saw a normal success screen and downloaded a
 * "server" that:
 *
 *   - implemented no MCP protocol at all, only `print()` calls;
 *   - printed to stdout, which is the JSON-RPC transport;
 *   - contained an uninterpolated `{mcpConfig.serverName}` that reached the
 *     Python as an f-string over an undefined name, raising NameError.
 *
 * A visible failure is strictly better than a file that cannot work.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { render, screen, fireEvent, waitFor } from '../../test/utils';
import { MCPGenerator } from '../MCPGenerator';
import { MCPCodeGenerator } from '../../services/mcpCodeGenerator';
import type { ExtractedEndpoint } from '../../services/endpointExtractor';

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
} as unknown as ExtractedEndpoint;

const spec = {
  info: { title: 'Petstore', version: '1.0.0' },
  servers: [{ url: 'https://petstore.swagger.io/v2' }],
};

const renderGenerator = () =>
  render(
    <MCPGenerator spec={spec} endpoints={[endpoint]} onBack={vi.fn()} />
  );

/** Click whichever control kicks off generation. */
const startGeneration = () => {
  const button = screen
    .getAllByRole('button')
    .find(b => /generate/i.test(b.textContent || ''));

  expect(button, 'no generate button found').toBeDefined();
  fireEvent.click(button!);
};

describe('MCPGenerator generation failure', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces the error instead of a fabricated project', async () => {
    vi.spyOn(MCPCodeGenerator, 'generateProject').mockRejectedValue(
      new Error('spec has no usable operations')
    );

    renderGenerator();
    startGeneration();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // The real reason must reach the user, not a generic message.
    expect(screen.getByRole('alert')).toHaveTextContent('spec has no usable operations');
    expect(screen.getByText(/could not generate/i)).toBeInTheDocument();
  });

  it('offers no download when generation failed', async () => {
    vi.spyOn(MCPCodeGenerator, 'generateProject').mockRejectedValue(
      new Error('boom')
    );

    renderGenerator();
    startGeneration();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // The success screen offers downloads; none of it may be on the page.
    expect(screen.queryByText(/download all/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/generated successfully/i)).not.toBeInTheDocument();
  });

  it('never emits the stub server that used to be substituted', async () => {
    vi.spyOn(MCPCodeGenerator, 'generateProject').mockRejectedValue(
      new Error('boom')
    );

    renderGenerator();
    startGeneration();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Fingerprints of the old fallback stub.
    expect(document.body.textContent).not.toContain('MCP Server generated successfully!');
    expect(document.body.textContent).not.toContain('{mcpConfig.serverName}');
    expect(document.body.textContent).not.toContain('endpoints.length');
  });

  it('renders results normally when generation succeeds', async () => {
    const project = await MCPCodeGenerator.generateProject({
      serverName: 'petstore',
      baseUrl: 'https://petstore.swagger.io/v2',
      endpoints: [endpoint],
      authConfigs: {},
      toolNaming: 'operationId',
      includeExamples: true,
      errorHandling: 'detailed',
      pythonVersion: '3.11',
      useFastMCP: true,
      serverModes: ['stdio'],
      httpPort: 8000,
      logLevel: 'INFO',
      includeRunScripts: true,
    } as never);

    vi.spyOn(MCPCodeGenerator, 'generateProject').mockResolvedValue(project);

    renderGenerator();
    startGeneration();

    // Assert the results actually render - "no alert" alone would also pass
    // if the component rendered nothing at all.
    await waitFor(() => {
      expect(screen.getByText(/generated successfully/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/**
 * The "Download ZIP Package" button must hand the browser a real archive.
 *
 * Reported from a local run: the download "returned a text file". This is the
 * path a user actually takes - `ExportService`, which the export tests cover,
 * is not wired to any rendered component, so its ZIP was the only one under
 * test while this one shipped untested.
 */
describe('MCPGenerator ZIP download', () => {
  /** jsdom's Blob has no arrayBuffer(). */
  const blobBytes = (blob: Blob): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });

  const renderResults = async () => {
    const project = await MCPCodeGenerator.generateProject({
      serverName: 'petstore',
      baseUrl: 'https://petstore.swagger.io/v2',
      endpoints: [endpoint],
      authConfigs: {},
      toolNaming: 'operationId',
      includeExamples: true,
      errorHandling: 'detailed',
      pythonVersion: '3.11',
      useFastMCP: true,
      serverModes: ['stdio'],
      httpPort: 8000,
      logLevel: 'INFO',
      includeRunScripts: true,
    } as never);

    vi.spyOn(MCPCodeGenerator, 'generateProject').mockResolvedValue(project);

    renderGenerator();
    startGeneration();

    await waitFor(() => {
      expect(screen.getByText(/generated successfully/i)).toBeInTheDocument();
    });
  };

  it('produces ZIP bytes, not text, and names the file .zip', async () => {
    await renderResults();

    const blobs: Blob[] = [];
    const originalCreate = global.URL.createObjectURL;
    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:mock';
    }) as unknown as typeof URL.createObjectURL;

    const names: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
      });

    try {
      fireEvent.click(screen.getByRole('button', { name: /download zip package/i }));

      await waitFor(() => expect(blobs).toHaveLength(1));

      // No amber failure panel - a failure here is what puts the .txt escape
      // hatch on screen in the first place.
      expect(screen.queryByText(/single \.txt instead/i)).not.toBeInTheDocument();

      expect(names).toEqual(['petstore_mcp_server.zip']);

      const bytes = await blobBytes(blobs[0]);
      expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]); // PK
      expect(blobs[0].type).toBe('application/zip');

      // The archive routes through ExportService now. Its own defaults would
      // date-stamp the filename and drop the test client, which is generated
      // outside GeneratedProject - assert both survived the wiring.
      const archive = await JSZip.loadAsync(bytes);
      const paths = Object.keys(archive.files);
      expect(paths).toEqual(expect.arrayContaining(['server.py', 'requirements.txt']));
      expect(paths).toContain('test_client.py');
      expect(await archive.file('test_client.py')!.async('string')).toContain('ClientSession');
      // Never part of the documented project tree.
      expect(paths).not.toContain('metadata.json');
    } finally {
      clickSpy.mockRestore();
      global.URL.createObjectURL = originalCreate;
    }
  });
});
