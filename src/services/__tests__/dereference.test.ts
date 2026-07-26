/**
 * `$ref` resolution.
 *
 * Dereferencing is on by default. Before that it was off, and request body
 * schemas still came out resolved — but only because SwaggerParser.validate
 * dereferences the document in place as a side effect. Turning validation off
 * silently produced empty `{}` bodies with nothing to indicate a loss.
 */

import { describe, it, expect, vi } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { parseSpecFromFile } from '../specParser';
import { extractEndpoints } from '../endpointExtractor';
import type { ParsedSpec } from '../../types';

/** Swagger 2.0 with the body schema behind a $ref, as Petstore has it. */
const spec = {
  swagger: '2.0',
  info: { title: 'Pets', version: '1.0.0' },
  host: 'example.test',
  basePath: '/v2',
  paths: {
    '/pet': {
      post: {
        operationId: 'addPet',
        summary: 'Add a pet',
        parameters: [
          { in: 'body', name: 'body', required: true, schema: { $ref: '#/definitions/Pet' } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
  definitions: {
    Pet: {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'integer', format: 'int64' },
        name: { type: 'string' },
        status: { type: 'string' },
      },
    },
  },
};

async function parse(options?: { validate?: boolean; dereference?: boolean }) {
  const content = JSON.stringify(spec);
  const result = await parseSpecFromFile(
    {
      file: null as unknown as File,
      content,
      type: 'json',
      size: content.length,
      lastModified: Date.now(),
    },
    options,
  );
  const endpoints = extractEndpoints(result.spec as unknown as ParsedSpec);
  const schema = endpoints.find(e => e.operationId === 'addPet')
    ?.requestBody?.content?.['application/json']?.schema as Record<string, unknown> | undefined;
  return { result, schema };
}

describe('$ref dereferencing', () => {
  it('is enabled by default', async () => {
    const { schema } = await parse();

    expect(schema?.properties).toBeDefined();
    expect(Object.keys(schema!.properties as object)).toEqual(
      expect.arrayContaining(['id', 'name', 'status'])
    );
  });

  it('resolves without relying on validation as a side effect', async () => {
    // validate off, dereference on - the combination that proves dereferencing
    // is doing the work rather than SwaggerParser.validate's in-place mutation.
    const { schema } = await parse({ validate: false, dereference: true });

    expect(schema?.properties).toBeDefined();
    expect(Object.keys(schema!.properties as object)).toContain('name');
  });

  it('preserves an unresolved $ref rather than emptying the schema', async () => {
    // With both off nothing resolves the pointer. The schema must still say
    // what it points at; it previously normalized to {}.
    const { schema } = await parse({ validate: false, dereference: false });

    expect(schema).toBeDefined();
    expect(schema!.$ref).toBe('#/definitions/Pet');
    expect(Object.keys(schema!)).not.toEqual([]);
  });

  it('does not warn when dereferencing succeeds', async () => {
    // A successful dereference used to push a warning, so a clean spec always
    // lit the amber "1 specification warning" box with a success message. The
    // box has to mean something is wrong, or it means nothing at all.
    const { result } = await parse();

    expect(result.warnings.some(w => /dereferenc/i.test(w))).toBe(false);
  });

  it('still warns when dereferencing fails', async () => {
    // The failure path is the one that belongs in the box.
    const spy = vi
      .spyOn(SwaggerParser, 'dereference')
      .mockRejectedValueOnce(new Error('circular pointer'));

    const { result } = await parse();

    expect(
      result.warnings.some(w => /Failed to dereference/i.test(w) && /circular pointer/.test(w))
    ).toBe(true);

    spy.mockRestore();
  });

  it('still parses cleanly', async () => {
    const { result } = await parse();

    expect(result.errors).toHaveLength(0);
    expect(result.metadata.endpointCount).toBe(1);
  });
});
