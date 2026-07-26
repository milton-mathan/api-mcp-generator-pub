import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpecParser } from '../specParser';
import { mockOpenAPISpec } from '../../test/mocks/openapi';

describe('SpecParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseFromString', () => {
    it('should parse valid JSON OpenAPI spec', async () => {
      const jsonSpec = JSON.stringify(mockOpenAPISpec);
      const result = await SpecParser.parseFromString(jsonSpec);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.spec.info.title).toBe('Test API');
        expect(result.spec.info.version).toBe('1.0.0');
        expect(result.spec.version).toBe('3.0.0');
      }
    });

    it('should parse valid YAML OpenAPI spec', async () => {
      const yamlSpec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      summary: Test endpoint
      responses:
        '200':
          description: Success
      `;

      const result = await SpecParser.parseFromString(yamlSpec);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.spec.info.title).toBe('Test API');
        expect(result.spec.paths['/test']).toBeDefined();
      }
    });

    it('should handle invalid JSON', async () => {
      const invalidJson = '{ invalid json }';
      const result = await SpecParser.parseFromString(invalidJson);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('parsing');
        expect(result.error.message).toContain('JSON');
      }
    });

    it('should handle invalid YAML', async () => {
      const invalidYaml = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      summary: Test endpoint
      responses:
        '200':
          description: Success
      invalid_indentation
      `;

      const result = await SpecParser.parseFromString(invalidYaml);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('parsing');
      }
    });

    it('should validate OpenAPI spec structure', async () => {
      const invalidSpec = JSON.stringify({
        openapi: '3.0.0',
        // Missing required 'info' field
        paths: {},
      });

      const result = await SpecParser.parseFromString(invalidSpec);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation');
      }
    });
  });

  describe('parseFromUrl', () => {
    it('should fetch and parse spec from URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockOpenAPISpec)),
      });
      global.fetch = mockFetch;

      const result = await SpecParser.parseFromUrl('https://api.example.com/openapi.json');

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/openapi.json', {
        headers: {},
      });
      expect(result.success).toBe(true);
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const result = await SpecParser.parseFromUrl('https://api.example.com/openapi.json');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('network');
      }
    });

    it('should handle HTTP errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Not Found'),
      });
      global.fetch = mockFetch;

      const result = await SpecParser.parseFromUrl('https://api.example.com/openapi.json');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('network');
        expect(result.error.message).toContain('404');
      }
    });

    it('should include custom headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockOpenAPISpec)),
      });
      global.fetch = mockFetch;

      const headers = { 'Authorization': 'Bearer token' };
      await SpecParser.parseFromUrl('https://api.example.com/openapi.json', headers);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/openapi.json', {
        headers,
      });
    });
  });

  describe('detectFormat', () => {
    it('should detect JSON format', () => {
      const jsonContent = '{"openapi": "3.0.0"}';
      expect(SpecParser.detectFormat(jsonContent)).toBe('json');
    });

    it('should detect YAML format', () => {
      const yamlContent = 'openapi: 3.0.0\ninfo:\n  title: Test';
      expect(SpecParser.detectFormat(yamlContent)).toBe('yaml');
    });

    it('should default to JSON for ambiguous content', () => {
      const ambiguousContent = 'some random text';
      expect(SpecParser.detectFormat(ambiguousContent)).toBe('json');
    });
  });

  describe('validateSpec', () => {
    it('should validate correct OpenAPI 3.0 spec', () => {
      const result = SpecParser.validateSpec(mockOpenAPISpec);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidSpec = {
        openapi: '3.0.0',
        // Missing 'info' field
        paths: {},
      };

      const result = SpecParser.validateSpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid version', () => {
      const invalidSpec = {
        ...mockOpenAPISpec,
        openapi: '2.0', // Invalid version format
      };

      const result = SpecParser.validateSpec(invalidSpec);
      expect(result.valid).toBe(false);
    });
  });

  describe('getSpecVersion', () => {
    it('should detect OpenAPI 3.0', () => {
      expect(SpecParser.getSpecVersion(mockOpenAPISpec)).toBe('3.0');
    });

    it('should detect Swagger 2.0', () => {
      const swagger2Spec = { swagger: '2.0', info: { title: 'Test', version: '1.0' } };
      expect(SpecParser.getSpecVersion(swagger2Spec)).toBe('2.0');
    });

    it('should return unknown for invalid specs', () => {
      const invalidSpec = { version: '1.0' };
      expect(SpecParser.getSpecVersion(invalidSpec)).toBe('unknown');
    });
  });
});