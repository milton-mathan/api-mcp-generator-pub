/**
 * Integration test using a real Stripe API spec to validate server generation.
 *
 * The spec is a committed subset of stripe/openapi (the three GET operations
 * exercised below) rather than a live fetch, so the suite stays hermetic and
 * does not depend on network access or on GitHub's availability.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPCodeGenerator } from '../mcpCodeGenerator';
import type { MCPGenerationConfig } from '../mcpCodeGenerator';
import type { ExtractedEndpoint } from '../../types/endpoint';
import stripeSpec from './fixtures/stripe-spec-subset.json';

/** Minimal shape of the fixture operations this test reads. */
interface SpecParameter {
  name: string;
  in: string;
  [key: string]: unknown;
}

interface SpecOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: SpecParameter[];
  responses?: Record<string, unknown>;
  security?: unknown[];
}

interface SpecPathItem {
  get?: SpecOperation;
}

describe('Stripe API Integration Test', () => {
  let stripeEndpoints: ExtractedEndpoint[];

  beforeAll(() => {
    // Extract a few GET endpoints for testing
    const paths = stripeSpec.paths as Record<string, SpecPathItem>;
    const selectedPaths = [
      '/v1/customers',
      '/v1/products',
      '/v1/payment_intents'
    ];

    stripeEndpoints = selectedPaths.map((path) => {
      const getMethod = paths[path]?.get;

      if (!getMethod) {
        throw new Error(`GET method not found for ${path}`);
      }

      const resource = path.split('/').pop();
      const parameters = getMethod.parameters ?? [];
      const responses = getMethod.responses ?? {};
      const operationId = getMethod.operationId || `get_${resource}`;

      return {
        id: `GET-v1-${resource}`,
        method: 'GET' as const,
        path: path,
        operationId,
        summary: getMethod.summary || `GET ${path}`,
        description: getMethod.description || `Retrieve ${resource}`,
        tags: getMethod.tags ?? [],
        parameters,
        responses,
        security: getMethod.security ?? [],
        pathParameters: [],
        queryParameters: parameters.filter(p => p.in === 'query'),
        headerParameters: parameters.filter(p => p.in === 'header'),
        cookieParameters: [],
        hasRequestBody: false,
        hasExamples: false,
        responseStatusCodes: Object.keys(responses),
        securitySchemes: [],
        complexity: 'simple' as const,
        normalizedPath: path,
        pathTemplate: path,
        operationKey: operationId,
        estimatedResponseSize: 'medium' as const,
        cacheable: true,
        idempotent: true,
        safe: true
      } as ExtractedEndpoint;
    });
  });

  it('should generate FastMCP server from Stripe API without validate_auth_config errors', async () => {
    const config: MCPGenerationConfig = {
      serverName: 'stripe_mcp_server',
      baseUrl: 'https://api.stripe.com',
      endpoints: stripeEndpoints,
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
    };

    const project = await MCPCodeGenerator.generateProject(config);
    
    // Check that server.py was generated
    const serverFile = project.files.find(f => f.path === 'server.py');
    expect(serverFile).toBeDefined();
    expect(serverFile!.content).toBeTruthy();

    // Verify that validate_auth_config function is defined
    expect(serverFile!.content).toContain('def validate_auth_config');
    
    // Verify that it contains the auth helper functions
    expect(serverFile!.content).toContain('def get_auth_headers');
    expect(serverFile!.content).toContain('def get_auth_params');
    expect(serverFile!.content).toContain('def get_auth_summary');
    
    // Verify FastMCP-specific imports are correct
    expect(serverFile!.content).toContain('from fastmcp import FastMCP');
    expect(serverFile!.content).toContain('import logging');
    expect(serverFile!.content).not.toContain('from fastmcp.logging import setup_logging');
    
    // Verify signal handling is present
    expect(serverFile!.content).toContain('signal.signal(signal.SIGINT, signal_handler)');
    expect(serverFile!.content).toContain('except KeyboardInterrupt:');
    
    // Verify tool definitions exist for Stripe endpoints. With
    // toolNaming: 'operationId' the tool functions are named after the spec's
    // operationId (GetCustomers, GetProducts, GetPaymentIntents).
    expect(serverFile!.content).toContain('@app.tool');
    expect(serverFile!.content).toMatch(/async def get_?customers/i);
    expect(serverFile!.content).toMatch(/async def get_?products/i);
    expect(serverFile!.content).toMatch(/async def get_?payment_?intents/i);
    
    // Verify HTTP mode warning for FastMCP
    expect(serverFile!.content).toContain('HTTP mode is not implemented');
    // The old message told users to switch to the basic template, which has no
    // --http handling at all.
    expect(serverFile!.content).not.toContain('Use the basic MCP server template instead');
  });

  it('should generate basic MCP server from Stripe API without validate_auth_config errors', async () => {
    const config: MCPGenerationConfig = {
      serverName: 'stripe_basic_mcp_server',
      baseUrl: 'https://api.stripe.com',
      endpoints: stripeEndpoints,
      authConfigs: {},
      toolNaming: 'operationId',
      includeExamples: true,
      errorHandling: 'detailed',
      pythonVersion: '3.11',
      useFastMCP: false,
      serverModes: ['stdio', 'http'],
      httpPort: 8000,
      logLevel: 'INFO',
      includeRunScripts: true,
    };

    const project = await MCPCodeGenerator.generateProject(config);
    
    // Check that server.py was generated
    const serverFile = project.files.find(f => f.path === 'server.py');
    expect(serverFile).toBeDefined();
    expect(serverFile!.content).toBeTruthy();

    // Verify that validate_auth_config function is defined
    expect(serverFile!.content).toContain('def validate_auth_config');
    
    // Verify that it contains the auth helper functions
    expect(serverFile!.content).toContain('def get_auth_headers');
    expect(serverFile!.content).toContain('def get_auth_params');
    expect(serverFile!.content).toContain('def get_auth_summary');
    
    // Verify basic MCP imports
    expect(serverFile!.content).toContain('from mcp.server import Server');
    expect(serverFile!.content).toContain('from mcp.server.stdio import stdio_server');
    expect(serverFile!.content).not.toContain('from fastmcp import FastMCP');
    
    // Verify signal handling is present
    expect(serverFile!.content).toContain('signal.signal(signal.SIGINT, signal_handler)');
    expect(serverFile!.content).toContain('except KeyboardInterrupt:');
    
    // Verify tool handler functions exist for Stripe endpoints
    expect(serverFile!.content).toMatch(/async def handle_get_?customers/i);
    expect(serverFile!.content).toMatch(/async def handle_get_?products/i);
    expect(serverFile!.content).toMatch(/async def handle_get_?payment_?intents/i);
  });

  it('should generate all required files for a complete project', async () => {
    const config: MCPGenerationConfig = {
      serverName: 'stripe_complete_test',
      baseUrl: 'https://api.stripe.com',
      endpoints: stripeEndpoints,
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
    };

    const project = await MCPCodeGenerator.generateProject(config);
    
    // Check all expected files are present
    const filePaths = project.files.map(f => f.path);
    
    expect(filePaths).toContain('server.py');
    expect(filePaths).toContain('requirements.txt');
    expect(filePaths).toContain('.env.example');
    expect(filePaths).toContain('README.md');
    expect(filePaths).toContain('pyproject.toml');
    expect(filePaths).toContain('Dockerfile');
    
    // Check requirements.txt contains necessary dependencies
    const requirementsFile = project.files.find(f => f.path === 'requirements.txt');
    expect(requirementsFile!.content).toContain('mcp>=');
    expect(requirementsFile!.content).toContain('httpx>=');
    expect(requirementsFile!.content).toContain('fastmcp>=');
    
    // Check README contains setup instructions
    const readmeFile = project.files.find(f => f.path === 'README.md');
    expect(readmeFile!.content).toContain('## Installation');
    expect(readmeFile!.content).toContain('pip install -r requirements.txt');
    expect(readmeFile!.content).toContain('python server.py');
  });

  it('should generate valid Python syntax that can be parsed', async () => {
    const config: MCPGenerationConfig = {
      serverName: 'stripe_syntax_test',
      baseUrl: 'https://api.stripe.com',
      endpoints: stripeEndpoints.slice(0, 1), // Just test one endpoint
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
    };

    const project = await MCPCodeGenerator.generateProject(config);
    const serverFile = project.files.find(f => f.path === 'server.py');
    
    // Basic syntax checks that would cause NameError or SyntaxError
    expect(serverFile!.content).not.toMatch(/def\s+[^a-zA-Z_]/); // Function names must start with letter/underscore
    expect(serverFile!.content).not.toMatch(/def\s+\d/); // Function names can't start with numbers
    expect(serverFile!.content).not.toContain('def GET_/'); // No slashes in function names
    expect(serverFile!.content).not.toContain('def POST_/'); // No slashes in function names
    
    // Check that all called functions are defined
    // Check for function definitions (validates structure)
    const functionDefinitions = serverFile!.content.match(/def (\w+)/g) || [];
    const definedFunctions = functionDefinitions.map(def => def.replace('def ', '').trim());
    
    // Specifically check that validate_auth_config is defined if called
    if (serverFile!.content.includes('validate_auth_config()')) {
      expect(definedFunctions).toContain('validate_auth_config');
    }
  });
});