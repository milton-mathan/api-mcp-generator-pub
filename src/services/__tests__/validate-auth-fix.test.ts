/**
 * Direct test to validate that the validate_auth_config function issue is fixed
 */

import { describe, it, expect } from 'vitest';
import { MCPCodeGenerator } from '../mcpCodeGenerator';
import type { MCPGenerationConfig } from '../mcpCodeGenerator';
import type { ExtractedEndpoint } from '../../types/endpoint';

describe('Validate Auth Config Fix', () => {
  // Mock Stripe-like endpoints
  const mockStripeEndpoints: ExtractedEndpoint[] = [
    {
      id: 'GET-v1-customers',
      method: 'GET',
      path: '/v1/customers',
      operationId: 'get_customers',
      summary: 'List customers',
      description: 'Returns a list of your customers',
      tags: ['Customers'],
      parameters: [],
      responses: { '200': { description: 'OK' } },
      security: [],
      pathParameters: [],
      queryParameters: [],
      headerParameters: [],
      cookieParameters: [],
      hasRequestBody: false,
      hasExamples: false,
      responseStatusCodes: ['200'],
      securitySchemes: [],
      complexity: 'simple',
      normalizedPath: '/v1/customers',
      pathTemplate: '/v1/customers',
      operationKey: 'get_customers',
      estimatedResponseSize: 'medium',
      cacheable: true,
      idempotent: true,
      safe: true
    },
    {
      id: 'GET-v1-products',
      method: 'GET',
      path: '/v1/products',
      operationId: 'get_products',
      summary: 'List products',
      description: 'Returns a list of your products',
      tags: ['Products'],
      parameters: [],
      responses: { '200': { description: 'OK' } },
      security: [],
      pathParameters: [],
      queryParameters: [],
      headerParameters: [],
      cookieParameters: [],
      hasRequestBody: false,
      hasExamples: false,
      responseStatusCodes: ['200'],
      securitySchemes: [],
      complexity: 'simple',
      normalizedPath: '/v1/products',
      pathTemplate: '/v1/products',
      operationKey: 'get_products',
      estimatedResponseSize: 'medium',
      cacheable: true,
      idempotent: true,
      safe: true
    }
  ];

  it('should generate FastMCP server with validate_auth_config function defined', async () => {
    const config: MCPGenerationConfig = {
      serverName: 'test_fastmcp_server',
      baseUrl: 'https://api.stripe.com',
      endpoints: mockStripeEndpoints,
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
    
    expect(serverFile).toBeDefined();
    
    // CRITICAL: Check that validate_auth_config function is actually defined
    expect(serverFile!.content).toContain('def validate_auth_config');
    
    // Check that it's called in APIClient.__init__
    expect(serverFile!.content).toContain('validate_auth_config()');
    
    // Make sure the function comes BEFORE the APIClient class definition
    const validateIndex = serverFile!.content.indexOf('def validate_auth_config');
    const apiClientIndex = serverFile!.content.indexOf('class APIClient:');
    expect(validateIndex).toBeGreaterThan(-1);
    expect(apiClientIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeLessThan(apiClientIndex);
    
    // Check that all auth helper functions are defined
    expect(serverFile!.content).toContain('def get_auth_headers');
    expect(serverFile!.content).toContain('def get_auth_params');
    expect(serverFile!.content).toContain('def get_auth_summary');
    
    console.log('FastMCP server validation: ✅ All auth functions present');
  });

  it('should generate basic MCP server with validate_auth_config function defined', async () => {
    const config: MCPGenerationConfig = {
      serverName: 'test_basic_server',
      baseUrl: 'https://api.stripe.com',
      endpoints: mockStripeEndpoints,
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
    const serverFile = project.files.find(f => f.path === 'server.py');
    
    expect(serverFile).toBeDefined();
    
    // CRITICAL: Check that validate_auth_config function is actually defined
    expect(serverFile!.content).toContain('def validate_auth_config');
    
    // Check that it's called in APIClient.__init__
    expect(serverFile!.content).toContain('validate_auth_config()');
    
    // Make sure the function comes BEFORE the APIClient class definition
    const validateIndex = serverFile!.content.indexOf('def validate_auth_config');
    const apiClientIndex = serverFile!.content.indexOf('class APIClient:');
    expect(validateIndex).toBeGreaterThan(-1);
    expect(apiClientIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeLessThan(apiClientIndex);
    
    // Check that all auth helper functions are defined
    expect(serverFile!.content).toContain('def get_auth_headers');
    expect(serverFile!.content).toContain('def get_auth_params');
    expect(serverFile!.content).toContain('def get_auth_summary');
    
    console.log('Basic MCP server validation: ✅ All auth functions present');
  });

  it('should verify function definitions appear in correct order', async () => {
    const config: MCPGenerationConfig = {
      serverName: 'test_order_server',
      baseUrl: 'https://api.stripe.com',
      endpoints: mockStripeEndpoints.slice(0, 1),
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
    
    const content = serverFile!.content;
    
    // Check order of important sections for FastMCP
    const importIndex = content.indexOf('import');
    const authFuncIndex = content.indexOf('def get_auth_headers');
    const validateFuncIndex = content.indexOf('def validate_auth_config');
    const appInitIndex = content.indexOf('app = FastMCP');
    
    // Verify logical order for FastMCP (no APIClient class in FastMCP)
    expect(importIndex).toBeLessThan(authFuncIndex);
    expect(authFuncIndex).toBeLessThan(validateFuncIndex);
    expect(validateFuncIndex).toBeLessThan(appInitIndex);
    
    console.log('Function order validation: ✅ Correct order maintained');
  });

  it('should contain proper signal handling and no deprecated imports', async () => {
    const config: MCPGenerationConfig = {
      serverName: 'test_signal_server',
      baseUrl: 'https://api.stripe.com',
      endpoints: mockStripeEndpoints.slice(0, 1),
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
    
    const content = serverFile!.content;
    
    // Check signal handling
    expect(content).toContain('import signal');
    expect(content).toContain('def signal_handler(signum, frame):');
    expect(content).toContain('signal.signal(signal.SIGINT, signal_handler)');
    expect(content).toContain('except KeyboardInterrupt:');
    
    // Check correct imports (no deprecated ones)
    expect(content).toContain('from fastmcp import FastMCP');
    expect(content).toContain('import logging');
    expect(content).not.toContain('from fastmcp.logging import setup_logging');
    
    // Check correct FastMCP initialization
    expect(content).toContain('app = FastMCP(SERVER_NAME)');
    expect(content).not.toContain('app.create_app()');
    
    console.log('Signal handling and imports: ✅ All correct');
  });
});