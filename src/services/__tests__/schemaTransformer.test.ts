import { describe, it, expect } from 'vitest';
import { SchemaTransformer } from '../schemaTransformer';
import { mockExtractedEndpoints } from '../../test/mocks/openapi';
import type { JSONSchema } from '../schemaTransformer';

describe('SchemaTransformer', () => {
  describe('transformEndpointToMCPSchema', () => {
    it('should transform GET endpoint to MCP schema', () => {
      const endpoint = mockExtractedEndpoints[0]; // GET /users
      const schema = SchemaTransformer.transformEndpointToMCPSchema(endpoint);

      expect(schema.inputSchema).toBeDefined();
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.properties).toBeDefined();
      expect(schema.inputSchema.properties!.limit).toBeDefined();
      expect(schema.inputSchema.properties!.offset).toBeDefined();
    });

    it('should transform POST endpoint with request body', () => {
      const endpoint = mockExtractedEndpoints[1]; // POST /users
      const schema = SchemaTransformer.transformEndpointToMCPSchema(endpoint);

      expect(schema.inputSchema.properties!.body).toBeDefined();
      expect(schema.inputSchema.required).toContain('body');
    });

    it('should generate output schema from responses', () => {
      const endpoint = mockExtractedEndpoints[0];
      const schema = SchemaTransformer.transformEndpointToMCPSchema(endpoint);

      expect(schema.outputSchema).toBeDefined();
      expect(schema.outputSchema?.type).toBe('object');
    });
  });

  describe('transformOpenAPISchemaToJSON', () => {
    it('should transform basic OpenAPI schema', () => {
      const openApiSchema = {
        type: 'string',
        description: 'A test string',
        example: 'test value',
        minLength: 1,
        maxLength: 100,
      };

      const jsonSchema = SchemaTransformer['transformOpenAPISchemaToJSON'](openApiSchema);

      expect(jsonSchema.type).toBe('string');
      expect(jsonSchema.description).toBe('A test string');
      expect(jsonSchema.example).toBe('test value');
      expect(jsonSchema.minLength).toBe(1);
      expect(jsonSchema.maxLength).toBe(100);
    });

    it('should transform object schema with properties', () => {
      const openApiSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'User name',
          },
          age: {
            type: 'integer',
            minimum: 0,
            maximum: 150,
          },
        },
        required: ['name'],
      };

      const jsonSchema = SchemaTransformer['transformOpenAPISchemaToJSON'](openApiSchema);

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect(jsonSchema.properties!.name.type).toBe('string');
      expect(jsonSchema.properties!.age.type).toBe('integer');
      expect(jsonSchema.required).toEqual(['name']);
    });

    it('should transform array schema', () => {
      const openApiSchema = {
        type: 'array',
        items: {
          type: 'string',
        },
      };

      const jsonSchema = SchemaTransformer['transformOpenAPISchemaToJSON'](openApiSchema);

      expect(jsonSchema.type).toBe('array');
      expect(jsonSchema.items).toBeDefined();
      expect(jsonSchema.items!.type).toBe('string');
    });

    it('should handle enum values', () => {
      const openApiSchema = {
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
      };

      const jsonSchema = SchemaTransformer['transformOpenAPISchemaToJSON'](openApiSchema);

      expect(jsonSchema.enum).toEqual(['active', 'inactive', 'pending']);
    });

    it('should handle composition schemas (oneOf)', () => {
      const openApiSchema = {
        oneOf: [
          { type: 'string' },
          { type: 'integer' },
        ],
      };

      const jsonSchema = SchemaTransformer['transformOpenAPISchemaToJSON'](openApiSchema);

      expect(jsonSchema.oneOf).toBeDefined();
      expect(jsonSchema.oneOf).toHaveLength(2);
      expect(jsonSchema.oneOf![0].type).toBe('string');
      expect(jsonSchema.oneOf![1].type).toBe('integer');
    });
  });

  describe('validateSchema', () => {
    it('should validate correct schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name'],
      };

      const result = SchemaTransformer.validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject schema without type or reference', () => {
      const schema: JSONSchema = {
        description: 'Invalid schema',
      };

      const result = SchemaTransformer.validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Schema must have a type or reference');
    });

    it('should validate array schema with items', () => {
      const schema: JSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const result = SchemaTransformer.validateSchema(schema);
      expect(result.valid).toBe(true);
    });

    it('should reject array schema without items', () => {
      const schema: JSONSchema = {
        type: 'array',
      };

      const result = SchemaTransformer.validateSchema(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Array schema must have items definition');
    });
  });

  describe('simplifySchema', () => {
    it('should simplify deeply nested schema', () => {
      const complexSchema: JSONSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      level4: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const simplified = SchemaTransformer.simplifySchema(complexSchema, 2);

      expect(simplified.properties!.level1.properties!.level2.type).toBe('object');
      expect(simplified.properties!.level1.properties!.level2.description).toContain('simplified');
    });

    it('should preserve simple schemas', () => {
      const simpleSchema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      };

      const simplified = SchemaTransformer.simplifySchema(simpleSchema, 3);

      expect(simplified).toEqual(simpleSchema);
    });
  });
});