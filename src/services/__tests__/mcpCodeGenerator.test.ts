import { describe, it, expect, beforeEach } from 'vitest';
import { MCPCodeGenerator, type MCPGenerationConfig } from '../mcpCodeGenerator';
import { AuthConfigService } from '../authConfigService';
import type { ExtractedEndpoint } from '../endpointExtractor';
import type { AuthConfigMap } from '../authConfigService';

describe('MCPCodeGenerator', () => {
  let mockEndpoints: ExtractedEndpoint[];
  let mockAuthConfigs: AuthConfigMap;
  let basicConfig: MCPGenerationConfig;
  let fastMCPConfig: MCPGenerationConfig;

  beforeEach(() => {
    mockEndpoints = [
      {
        id: 'get-users',
        method: 'GET',
        path: '/users',
        operationId: 'getUsers',
        summary: 'Get all users',
        description: 'Retrieve a list of all users',
        tags: ['users'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer' },
            description: 'Maximum number of users to return'
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object' }
                }
              }
            }
          }
        },
        security: [],
        normalizedPath: '/users',
        pathTemplate: '/users',
        operationKey: 'get_users'
      },
      {
        id: 'post-users',
        method: 'POST',
        path: '/users',
        operationId: 'createUser',
        summary: 'Create a user',
        description: 'Create a new user',
        tags: ['users'],
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User created',
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          }
        },
        security: [{ 'bearerAuth': [] }],
        normalizedPath: '/users',
        pathTemplate: '/users',
        operationKey: 'post_users'
      }
    ];

    mockAuthConfigs = {
      'post-users': {
        type: 'bearer',
        envVarName: 'API_TOKEN',
        headerName: 'Authorization',
        location: 'header',
        required: true,
        description: 'Bearer token for authentication'
      }
    };

    basicConfig = {
      serverName: 'test-server',
      baseUrl: 'https://api.example.com',
      endpoints: mockEndpoints,
      authConfigs: mockAuthConfigs,
      toolNaming: 'operationId',
      includeExamples: true,
      errorHandling: 'detailed',
      pythonVersion: '3.11',
      useFastMCP: false,
      serverModes: ['stdio'],
      httpPort: 8000,
      logLevel: 'INFO',
      includeRunScripts: false
    };

    fastMCPConfig = {
      ...basicConfig,
      useFastMCP: true,
      // stdio only. This fixture used to say ['stdio', 'http'], a config the UI
      // can no longer produce — the HTTP checkbox is disabled because neither
      // template implements it. Testing through it hid a real gap: the README's
      // docker-compose section was gated on the 'http' flag, so every real
      // project shipped a docker-compose.yml its README never mentioned.
      serverModes: ['stdio'],
      includeRunScripts: true
    };
  });

  describe('generateProject', () => {
    it('should generate basic MCP server project', async () => {
      const project = await MCPCodeGenerator.generateProject(basicConfig);

      expect(project.files).toBeDefined();
      expect(project.structure).toBeDefined();
      expect(project.dependencies).toBeDefined();
      expect(project.envVars).toBeDefined();
      expect(project.instructions).toBeDefined();

      // Check that basic files are generated
      const fileNames = project.files.map(f => f.path);
      expect(fileNames).toContain('server.py');
      expect(fileNames).toContain('requirements.txt');
      expect(fileNames).toContain('.env.example');
      expect(fileNames).toContain('README.md');
      expect(fileNames).toContain('pyproject.toml');
      expect(fileNames).toContain('Dockerfile');

      // Should not have FastMCP-specific files
      expect(project.runScripts).toBeUndefined();
      expect(project.dockerCompose).toBeUndefined();
    });

    it('should generate FastMCP server project with enhanced features', async () => {
      const project = await MCPCodeGenerator.generateProject(fastMCPConfig);

      expect(project.files).toBeDefined();
      expect(project.structure).toBeDefined();
      expect(project.dependencies).toBeDefined();
      expect(project.envVars).toBeDefined();
      expect(project.instructions).toBeDefined();

      // Check that all files are generated
      const fileNames = project.files.map(f => f.path);
      expect(fileNames).toContain('server.py');
      expect(fileNames).toContain('requirements.txt');
      expect(fileNames).toContain('.env.example');
      expect(fileNames).toContain('README.md');
      expect(fileNames).toContain('pyproject.toml');
      expect(fileNames).toContain('Dockerfile');

      // Should have FastMCP-specific files
      expect(project.runScripts).toBeDefined();
      expect(project.dockerCompose).toBeDefined();
      expect(fileNames).toContain('scripts/run-stdio.py');
      // No run-http.py - HTTP mode is not implemented in either template.
      expect(fileNames).not.toContain('scripts/run-http.py');
      expect(fileNames).toContain('scripts/setup.py');
      expect(fileNames).toContain('docker-compose.yml');
    });

    it('should generate correct dependencies for FastMCP', async () => {
      const basicProject = await MCPCodeGenerator.generateProject(basicConfig);
      const fastMCPProject = await MCPCodeGenerator.generateProject(fastMCPConfig);

      // Basic MCP should have basic dependencies
      const basicRequirements = basicProject.files.find(f => f.path === 'requirements.txt')?.content;
      expect(basicRequirements).toContain('mcp>=1.0.0');
      expect(basicRequirements).toContain('httpx>=0.25.0');

      // FastMCP should have FastMCP dependencies
      const fastMCPRequirements = fastMCPProject.files.find(f => f.path === 'requirements.txt')?.content;
      expect(fastMCPRequirements).toContain('fastmcp>=0.1.0');
      expect(fastMCPRequirements).toContain('httpx>=0.25.0');

      // Only what the server imports. uvicorn, python-multipart and
      // asyncio-mqtt were listed for a long time without ever being imported;
      // see generated-packaging.test.ts for the full contract.
      expect(fastMCPRequirements).not.toContain('uvicorn');
      expect(fastMCPRequirements).not.toContain('python-multipart');
      expect(basicRequirements).not.toContain('asyncio-mqtt');
    });

    it('should generate server code with correct framework imports', async () => {
      const basicProject = await MCPCodeGenerator.generateProject(basicConfig);
      const fastMCPProject = await MCPCodeGenerator.generateProject(fastMCPConfig);

      const basicServerCode = basicProject.files.find(f => f.path === 'server.py')?.content;
      const fastMCPServerCode = fastMCPProject.files.find(f => f.path === 'server.py')?.content;

      // Basic MCP should import basic MCP modules
      expect(basicServerCode).toContain('from mcp.server import Server');
      expect(basicServerCode).toContain('from mcp.server.stdio import stdio_server');

      // FastMCP should import FastMCP modules
      expect(fastMCPServerCode).toContain('from fastmcp import FastMCP');
      expect(fastMCPServerCode).toContain('import logging');
    });

    it('should generate correct tool definitions for both frameworks', async () => {
      const basicProject = await MCPCodeGenerator.generateProject(basicConfig);
      const fastMCPProject = await MCPCodeGenerator.generateProject(fastMCPConfig);

      const basicServerCode = basicProject.files.find(f => f.path === 'server.py')?.content;
      const fastMCPServerCode = fastMCPProject.files.find(f => f.path === 'server.py')?.content;

      // Both should have tool definitions for the endpoints
      expect(basicServerCode).toContain('getUsers');
      expect(basicServerCode).toContain('createUser');
      expect(fastMCPServerCode).toContain('getUsers');
      expect(fastMCPServerCode).toContain('createUser');

      // FastMCP should use decorator pattern
      expect(fastMCPServerCode).toContain('@app.tool');
    });

    it('should handle authentication correctly in both frameworks', async () => {
      const basicProject = await MCPCodeGenerator.generateProject(basicConfig);
      const fastMCPProject = await MCPCodeGenerator.generateProject(fastMCPConfig);

      const basicServerCode = basicProject.files.find(f => f.path === 'server.py')?.content;
      const fastMCPServerCode = fastMCPProject.files.find(f => f.path === 'server.py')?.content;

      // Both should have authentication handling
      expect(basicServerCode).toContain('get_auth_headers');
      expect(fastMCPServerCode).toContain('get_auth_headers');
      expect(fastMCPServerCode).toContain('get_auth_params');

      // FastMCP should have enhanced auth logging
      expect(fastMCPServerCode).toContain('auth_logger');
    });

    it('should generate comprehensive README for FastMCP', async () => {
      const fastMCPProject = await MCPCodeGenerator.generateProject(fastMCPConfig);
      const readme = fastMCPProject.files.find(f => f.path === 'README.md')?.content;

      expect(readme).toContain('FastMCP server');
      expect(readme).toContain('Stdio Mode');
      expect(readme).toContain('HTTP Mode');
      expect(readme).toContain('python scripts/run-stdio.py');
      // HTTP is not implemented in either template, so the README must not
      // present it as a runnable mode.
      expect(readme).not.toContain('python server.py --http');
      expect(readme).toContain('Not implemented');
    });

    describe('the README documents docker-compose.yml exactly when it ships', () => {
      // The two were gated on different conditions, and once HTTP mode was
      // removed they disagreed for every project a user could actually
      // generate: the file shipped, the README stayed silent about it.
      it('documents it when the file is in the project', async () => {
        const project = await MCPCodeGenerator.generateProject(fastMCPConfig);
        const readme = project.files.find(f => f.path === 'README.md')!.content;

        expect(project.files.map(f => f.path)).toContain('docker-compose.yml');
        expect(readme).toContain('docker-compose.yml');
        // `up` does not attach stdin, and stdin is the transport. It may be
        // named in prose to warn against it, but never as a command to run.
        expect(readme).toContain('docker compose run --rm test-server');
        expect(readme).not.toMatch(/^docker[- ]compose up/m);
      });

      it('stays silent when no compose file ships', async () => {
        const project = await MCPCodeGenerator.generateProject({
          ...fastMCPConfig,
          includeRunScripts: false
        });
        const readme = project.files.find(f => f.path === 'README.md')!.content;

        expect(project.files.map(f => f.path)).not.toContain('docker-compose.yml');
        expect(readme).not.toContain('docker-compose.yml');
      });
    });

    it('should generate working helper scripts', async () => {
      const fastMCPProject = await MCPCodeGenerator.generateProject(fastMCPConfig);

      const stdioScript = fastMCPProject.files.find(f => f.path === 'scripts/run-stdio.py')?.content;
      const setupScript = fastMCPProject.files.find(f => f.path === 'scripts/setup.py')?.content;

      // Check stdio script
      expect(stdioScript).toContain('#!/usr/bin/env python3');
      expect(stdioScript).toContain('subprocess.run([sys.executable, "server.py"]');
      expect(stdioScript).toContain('check_requirements()');

      // No HTTP script is generated: neither template implements HTTP, and the
      // old script announced an HTTP start and checked ports before handing off
      // to a server that quietly ran in stdio mode.
      expect(fastMCPProject.files.find(f => f.path === 'scripts/run-http.py')).toBeUndefined();

      // Check setup script
      expect(setupScript).toContain('#!/usr/bin/env python3');
      expect(setupScript).toContain('pip install -r requirements.txt');
      expect(setupScript).toContain('check_python_version');
    });

    it('should generate valid docker-compose configuration', async () => {
      const fastMCPProject = await MCPCodeGenerator.generateProject(fastMCPConfig);
      const dockerCompose = fastMCPProject.files.find(f => f.path === 'docker-compose.yml')?.content;

      expect(dockerCompose).toContain('test-server:');
      expect(dockerCompose).toContain('build: .');
      expect(dockerCompose).toContain('env_file:');
      expect(dockerCompose).toContain('- .env');
    });

    describe('docker-compose describes a stdio server, not a web service', () => {
      // This file used to publish a port, run `server.py --http`, and health-check
      // http://localhost:8000/health. The server speaks JSON-RPC over
      // stdin/stdout, so nothing ever listened: the healthcheck could never
      // pass and left the container permanently unhealthy, and
      // `restart: unless-stopped` turned "exited because stdin closed" into a
      // crash loop. Docker is a primary deployment path, so this shipped broken.
      let compose: string;

      beforeEach(async () => {
        const project = await MCPCodeGenerator.generateProject(fastMCPConfig);
        compose = project.files.find(f => f.path === 'docker-compose.yml')!.content;
      });

      it('does not pass the non-existent --http flag', () => {
        expect(compose).not.toContain('--http');
      });

      it('publishes no port and declares no HTTP healthcheck', () => {
        expect(compose).not.toContain('ports:');
        expect(compose).not.toContain('8000:8000');
        expect(compose).not.toContain('healthcheck:');
        expect(compose).not.toContain('/health');
      });

      it('keeps stdin open, since stdin is the transport', () => {
        expect(compose).toContain('stdin_open: true');
      });

      it('does not restart a server that exits when its client disconnects', () => {
        expect(compose).toContain('restart: "no"');
        expect(compose).not.toContain('restart: unless-stopped');
      });

      it('tells the reader how to actually run it', () => {
        expect(compose).toMatch(/docker compose run --rm/);
        // -i is what keeps stdin attached; without it the server sees EOF.
        expect(compose).toMatch(/"-i"/);
      });
    });

    it('Dockerfile exposes no port', async () => {
      const project = await MCPCodeGenerator.generateProject(fastMCPConfig);
      const dockerfile = project.files.find(f => f.path === 'Dockerfile')!.content;

      expect(dockerfile).not.toMatch(/^EXPOSE/m);
      expect(dockerfile).toContain('CMD ["python", "server.py"]');
    });
  });

  describe('FastMCP Authentication Integration', () => {
    it('should generate enhanced authentication code for FastMCP', () => {
      const authCode = AuthConfigService.generateFastMCPAuthCode(mockAuthConfigs);

      expect(authCode).toContain('auth_logger = logging.getLogger("fastmcp.auth")');
      expect(authCode).toContain('get_auth_headers');
      expect(authCode).toContain('get_auth_params');
      expect(authCode).toContain('get_auth_summary');
      expect(authCode).toContain('validate_auth_config');
    });

    it('should handle query parameter authentication', () => {
      const queryAuthConfig = {
        'test-endpoint': {
          type: 'apiKey' as const,
          envVarName: 'API_KEY',
          headerName: 'api_key',
          location: 'query' as const,
          required: true,
          description: 'API key for query parameter auth'
        }
      };

      const authCode = AuthConfigService.generateFastMCPAuthCode(queryAuthConfig);
      expect(authCode).toContain('get_auth_params');
      expect(authCode).toContain('location": "query');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty endpoints gracefully', async () => {
      const emptyConfig = { ...fastMCPConfig, endpoints: [] };
      const project = await MCPCodeGenerator.generateProject(emptyConfig);

      expect(project.files).toBeDefined();
      expect(project.files.length).toBeGreaterThan(0);
    });

    it('should handle missing authentication gracefully', async () => {
      const noAuthConfig = { ...fastMCPConfig, authConfigs: {} };
      const project = await MCPCodeGenerator.generateProject(noAuthConfig);

      const serverCode = project.files.find(f => f.path === 'server.py')?.content;
      expect(serverCode).toContain('No authentication required');
    });
  });
});