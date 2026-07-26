/**
 * Form-encoded and multipart request bodies.
 *
 * These endpoints returned HTTP 415 for a long time: the extractor modelled
 * `in: formData` parameters, but every generated tool sent JSON regardless.
 */

import { describe, it, expect } from 'vitest';
import { extractEndpoints } from '../endpointExtractor';
import { MCPCodeGenerator } from '../mcpCodeGenerator';
import type { MCPGenerationConfig } from '../mcpCodeGenerator';

/** Swagger 2.0, mirroring Petstore's two form endpoints. */
const spec = {
  swagger: '2.0',
  info: { title: 'Pets', version: '1.0.0' },
  host: 'example.test',
  basePath: '/v2',
  paths: {
    '/pet/{petId}/uploadImage': {
      post: {
        operationId: 'uploadFile',
        summary: 'Upload an image',
        consumes: ['multipart/form-data'],
        parameters: [
          { name: 'petId', in: 'path', required: true, type: 'integer' },
          { name: 'additionalMetadata', in: 'formData', required: false, type: 'string' },
          { name: 'file', in: 'formData', required: false, type: 'file' },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/pet/{petId}': {
      post: {
        operationId: 'updatePetWithForm',
        summary: 'Update with form data',
        consumes: ['application/x-www-form-urlencoded'],
        parameters: [
          { name: 'petId', in: 'path', required: true, type: 'integer' },
          { name: 'name', in: 'formData', required: false, type: 'string' },
          { name: 'status', in: 'formData', required: false, type: 'string' },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/pet': {
      post: {
        operationId: 'addPet',
        summary: 'Add a pet (JSON)',
        parameters: [
          { in: 'body', name: 'body', required: true, schema: { type: 'object' } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

async function generate(useFastMCP: boolean) {
  const project = await MCPCodeGenerator.generateProject({
    serverName: 'petstore',
    baseUrl: 'https://example.test/v2',
    endpoints: extractEndpoints(spec as never),
    authConfigs: {},
    toolNaming: 'operationId',
    includeExamples: true,
    errorHandling: 'detailed',
    pythonVersion: '3.11',
    useFastMCP,
    serverModes: ['stdio'],
    httpPort: 8000,
    logLevel: 'INFO',
    includeRunScripts: false,
  } as unknown as MCPGenerationConfig);
  return project.files.find(f => f.path === 'server.py')!.content;
}

describe('form and multipart request bodies', () => {
  describe.each([
    ['FastMCP', true],
    ['basic MCP', false],
  ])('%s template', (_label, useFastMCP) => {
    it('sends form fields as data, not JSON', async () => {
      const server = await generate(useFastMCP as boolean);

      expect(server).toContain('form_data=form_data if form_data else None');
      expect(server).toMatch(/form_data\["name"\]/);
      expect(server).toMatch(/form_data\["status"\]/);
    });

    it('sends file fields as multipart files', async () => {
      const server = await generate(useFastMCP as boolean);

      expect(server).toContain('files=files if files else None');
      expect(server).toMatch(/files\["file"\]/);
      // Read into memory rather than passing an open handle, so a failing
      // request cannot leak the descriptor.
      expect(server).toContain('_fh.read()');
    });

    it('lets httpx set the content type for form bodies', async () => {
      const server = await generate(useFastMCP as boolean);

      // A hardcoded application/json header breaks multipart: httpx must supply
      // the boundary parameter it generates.
      expect(server).toContain("if json_data is not None:\n            headers['Content-Type'] = 'application/json'");
      expect(server).not.toMatch(/headers = \{\s*'Content-Type': 'application\/json'/);
    });

    it('still sends JSON bodies as JSON', async () => {
      const server = await generate(useFastMCP as boolean);

      expect(server).toContain('json_data=');
      expect(server).toContain("request_kwargs['json'] = json_data");
    });

    it('never declares an invalid JSON Schema type', async () => {
      const server = await generate(useFastMCP as boolean);

      // Swagger 2.0's `type: file` is not a JSON Schema type. The mcp SDK
      // validates arguments against the declared schema before dispatch, so
      // leaving it in made every call to the tool fail validation.
      expect(server).not.toContain('"type": "file"');
    });
  });

  it('exposes each form field as its own argument', async () => {
    const server = await generate(true);

    // A single opaque `body` dict gives a caller no way to learn the field
    // names.
    expect(server).toMatch(/async def uploadFile\([^)]*additionalMetadata[^)]*file[^)]*\)/);
    expect(server).toMatch(/async def updatePetWithForm\([^)]*name[^)]*status[^)]*\)/);
  });

  it('types a file argument as a path string', async () => {
    const server = await generate(true);

    expect(server).toMatch(/async def uploadFile\([^)]*file: str/);
  });
});
