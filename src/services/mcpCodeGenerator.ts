import type { ExtractedEndpoint } from './endpointExtractor';
import type { JSONSchema } from './schemaTransformer';

import type { AuthConfigMap } from './authConfigService';
import { AuthConfigService } from './authConfigService';

export interface MCPGenerationConfig {
  serverName: string;
  baseUrl: string;
  endpoints: ExtractedEndpoint[];
  authConfigs: AuthConfigMap;
  toolNaming: 'operationId' | 'path' | 'custom';
  includeExamples: boolean;
  errorHandling: 'basic' | 'detailed';
  pythonVersion: '3.8' | '3.9' | '3.10' | '3.11' | '3.12';
  // FastMCP-specific options
  useFastMCP?: boolean;
  serverModes?: ('stdio' | 'http')[];
  httpPort?: number;
  logLevel?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  includeRunScripts?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

export interface GeneratedProject {
  files: GeneratedFile[];
  structure: string[];
  dependencies: string[];
  envVars: string[];
  instructions: string;
  // Enhanced for fastmcp
  runScripts?: GeneratedFile[];
  dockerCompose?: string;
}

export class MCPCodeGenerator {
  /**
   * Generate complete MCP server project
   */
  static async generateProject(
    config: MCPGenerationConfig
  ): Promise<GeneratedProject> {
    const files: GeneratedFile[] = [];

    // Generate main server file
    files.push({
      path: 'server.py',
      content: config.useFastMCP
        ? this.generateFastMCPServerCode(config)
        : this.generateServerCode(config),
      description: 'Main MCP server implementation',
    });

    // Generate requirements.txt
    files.push({
      path: 'requirements.txt',
      content: this.generateRequirements(config),
      description: 'Python dependencies',
    });

    // Generate .env template
    files.push({
      path: '.env.example',
      content: AuthConfigService.generateEnvTemplate(config.authConfigs),
      description: 'Environment variables template',
    });

    // Generate README
    files.push({
      path: 'README.md',
      content: this.generateReadme(config),
      description: 'Setup and usage instructions',
    });

    // Generate pyproject.toml
    files.push({
      path: 'pyproject.toml',
      content: this.generatePyProject(config),
      description: 'Python project configuration',
    });

    // Generate Dockerfile (optional)
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile(config),
      description: 'Docker container configuration',
    });

    // Generate FastMCP-specific files
    const runScripts: GeneratedFile[] = [];
    let dockerCompose: string | undefined;

    if (this.shipsRunScriptBundle(config)) {
      // Generate run scripts
      if (config.serverModes?.includes('stdio')) {
        runScripts.push({
          path: 'scripts/run-stdio.py',
          content: this.generateStdioRunScript(config),
          description: 'Script to run server in stdio mode',
        });
      }

      // No run-http.py: HTTP mode is not implemented in either template, and
      // the script announced "Starting in HTTP mode", checked port
      // availability and suggested HTTP_PORT before handing off to a server
      // that silently starts in stdio mode.

      runScripts.push({
        path: 'scripts/setup.py',
        content: this.generateSetupScript(config),
        description: 'Setup helper script',
      });

      // Generate docker-compose.yml
      dockerCompose = this.generateDockerCompose(config);

      files.push(...runScripts);

      if (dockerCompose) {
        files.push({
          path: 'docker-compose.yml',
          content: dockerCompose,
          description: 'Docker Compose configuration for local development',
        });
      }
    }

    const structure = [
      'server.py',
      'requirements.txt',
      '.env.example',
      'README.md',
      'pyproject.toml',
      'Dockerfile',
      ...(this.shipsRunScriptBundle(config)
        ? [
            'scripts/',
            'scripts/run-stdio.py',
            'scripts/setup.py',
            ...(dockerCompose ? ['docker-compose.yml'] : []),
          ]
        : []),
    ];

    const dependencies = this.getDependencies(config);
    const envVars = AuthConfigService.getUniqueEnvVars(config.authConfigs);
    const instructions = this.generateInstructions(config);

    return {
      files,
      structure,
      dependencies,
      envVars,
      instructions,
      runScripts:
        config.useFastMCP && config.includeRunScripts ? runScripts : undefined,
      dockerCompose,
    };
  }

  /**
   * Generate main server Python code
   */
  private static generateServerCode(config: MCPGenerationConfig): string {
    const { serverName, baseUrl, endpoints, authConfigs } = config;

    let code = `#!/usr/bin/env python3
"""
${serverName} MCP Server

Generated from OpenAPI specification
Base URL: ${baseUrl}
Endpoints: ${endpoints.length}
"""

import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Optional, Union

import httpx
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequest,
    CallToolResult,
    ListToolsRequest,
    ListToolsResult,
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
)

# Server configuration
SERVER_NAME = "${serverName}"
BASE_URL = "${baseUrl}"
TIMEOUT = 30.0
MAX_RETRIES = 3

# Initialize MCP server
server = Server(SERVER_NAME)

${AuthConfigService.generateAuthCode(authConfigs)}

class APIClient:
    """HTTP client for API requests with authentication and error handling."""
    
    def __init__(self):
        self.base_url = BASE_URL
        self.timeout = TIMEOUT
        self.max_retries = MAX_RETRIES
        
        # Validate authentication configuration
        try:
            validate_auth_config()
        except ValueError as e:
            print(f"Authentication configuration error: {e}", file=sys.stderr)
            sys.exit(1)
    
    async def make_request(
        self,
        method: str,
        endpoint: str,
        endpoint_id: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        form_data: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request with authentication and error handling."""
        # NOTE: do not use urljoin here. It treats a base path without a
        # trailing slash as a file, so urljoin("https://host/v2", "pets")
        # yields "https://host/pets" - silently dropping the API version
        # prefix and 404ing every request.
        url = self.base_url.rstrip('/') + '/' + endpoint.lstrip('/')
        
        # Get authentication headers
        auth_headers = get_auth_headers(endpoint_id)
        
        # Prepare request
        headers = {
            'User-Agent': f'{SERVER_NAME}/1.0',
            **auth_headers,
        }

        # Only declare JSON when a JSON body is actually being sent. httpx sets
        # the correct Content-Type for form and multipart bodies itself, and a
        # multipart request needs the boundary parameter it generates - forcing
        # application/json here makes the server reject the upload.
        if json_data is not None:
            headers['Content-Type'] = 'application/json'
        
        request_kwargs = {
            'method': method,
            'url': url,
            'headers': headers,
            'timeout': self.timeout,
            **kwargs
        }
        
        if params:
            request_kwargs['params'] = params
        if json_data is not None:
            request_kwargs['json'] = json_data
        if form_data:
            request_kwargs['data'] = form_data
        if files:
            request_kwargs['files'] = files
        
        # Make request with retries
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.request(**request_kwargs)
                    
                    # Handle response
                    if response.status_code >= 400:
                        error_detail = f"HTTP {response.status_code}"
                        try:
                            error_body = response.json()
                            if isinstance(error_body, dict) and 'message' in error_body:
                                error_detail += f": {error_body['message']}"
                        except:
                            error_detail += f": {response.text[:200]}"
                        
                        raise httpx.HTTPStatusError(
                            error_detail,
                            request=response.request,
                            response=response
                        )
                    
                    # Return JSON response
                    try:
                        return response.json()
                    except:
                        return {"data": response.text, "status": response.status_code}
                        
            except Exception as e:
                last_exception = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                continue
        
        # All retries failed
        raise last_exception or Exception("Request failed after all retries")

# Authentication helper functions
#
# NOTE: get_auth_headers() is intentionally NOT redefined here. It is emitted
# above by the auth-config generator, wired to AUTH_CONFIG and the environment
# variables for this server. A second definition at this point would shadow
# that one and silently drop every auth header.

def get_auth_params(endpoint_id: str) -> Dict[str, str]:
    """Get authentication parameters for the given endpoint."""
    ${Object.keys(authConfigs).length > 0 ? '# TODO: Implement authentication logic based on authConfigs' : '# No authentication required'}
    return {}

def get_auth_summary(endpoint_id: str) -> str:
    """Get authentication summary for the given endpoint."""
    ${Object.keys(authConfigs).length > 0 ? 'return "Authentication required - check your API credentials"' : 'return "No authentication required"'}


# Initialize API client
api_client = APIClient()

`;

    // Generate tool definitions and handlers
    endpoints.forEach((endpoint, index) => {
      code += this.generateToolDefinition(endpoint, config, index);
      code += '\n';
      code += this.generateToolHandler(endpoint, config, index);
      code += '\n\n';
    });

    // Generate server setup
    code += `
@server.list_tools()
async def list_tools() -> ListToolsResult:
    """List available MCP tools."""
    tools = [
`;

    endpoints.forEach((endpoint, _index) => {
      const toolName = this.getToolName(endpoint, config);
      code += `        ${toolName.toLowerCase()}_tool,\n`;
    });

    code += `    ]
    return ListToolsResult(tools=tools)

@server.call_tool()
async def call_tool(tool_name: str, arguments: Dict[str, Any]) -> CallToolResult:
    """Handle tool execution requests.

    NOTE: the mcp SDK invokes this handler as func(tool_name, arguments) - two
    positional arguments. Declaring a single CallToolRequest parameter raises
    "call_tool() takes 1 positional argument but 2 were given" on every call.
    """
    arguments = arguments or {}

    try:
`;

    endpoints.forEach((endpoint, _index) => {
      const toolName = this.getToolName(endpoint, config);
      // Compare against the advertised name, not a lowercased copy: the client
      // sends back exactly what list_tools published.
      code += `        if tool_name == "${toolName}":
            return await handle_${toolName.toLowerCase()}(arguments)
`;
    });

    code += `        
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"Unknown tool: {tool_name}"
                )
            ],
            isError=True
        )
    
    except Exception as e:
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"Error executing {tool_name}: {str(e)}"
                )
            ],
            isError=True
        )

async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )

if __name__ == "__main__":
    import signal

    # NOTE: stdout is the JSON-RPC transport for a stdio MCP server. Anything
    # written there that is not a protocol message corrupts the stream: the
    # client fails to parse it, the connection tears down, and the anyio task
    # group inside server.run() reports "unhandled errors in a TaskGroup".
    # Every diagnostic below must therefore go to stderr.

    def signal_handler(signum, frame):
        """Handle graceful shutdown on Ctrl+C"""
        print("\\nShutting down gracefully...", file=sys.stderr)
        sys.exit(0)

    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        print("Starting MCP server... (Press Ctrl+C to stop)", file=sys.stderr)
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\\nServer stopped by user", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"\\nServer error: {e}", file=sys.stderr)
        sys.exit(1)
`;

    return code;
  }

  /**
   * Generate FastMCP server Python code
   */
  private static generateFastMCPServerCode(
    config: MCPGenerationConfig
  ): string {
    const { serverName, baseUrl, endpoints, authConfigs } = config;
    const logLevel = config.logLevel || 'INFO';
    const httpPort = config.httpPort || 8000;

    let code = `#!/usr/bin/env python3
"""
${serverName} FastMCP Server

Generated from OpenAPI specification
Base URL: ${baseUrl}
Endpoints: ${endpoints.length}
"""

import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Optional, Union

import httpx
import logging
from fastmcp import FastMCP

# Server configuration
SERVER_NAME = "${serverName}"
BASE_URL = "${baseUrl}"
TIMEOUT = 30.0
MAX_RETRIES = 3
LOG_LEVEL = "${logLevel}"
HTTP_PORT = ${httpPort}

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(SERVER_NAME)

${AuthConfigService.generateFastMCPAuthCode(authConfigs)}

# Initialize FastMCP server
app = FastMCP(SERVER_NAME)

class APIClient:
    """HTTP client for API requests with authentication and error handling."""
    
    def __init__(self):
        self.base_url = BASE_URL
        self.timeout = TIMEOUT
        self.max_retries = MAX_RETRIES
        
        # Validate authentication configuration
        try:
            validate_auth_config()
        except ValueError as e:
            logger.error(f"Authentication configuration error: {e}")
            sys.exit(1)
    
    async def make_request(
        self,
        method: str,
        endpoint: str,
        endpoint_id: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        form_data: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request with authentication and error handling (FastMCP enhanced)."""
        # NOTE: do not use urljoin here. It treats a base path without a
        # trailing slash as a file, so urljoin("https://host/v2", "pets")
        # yields "https://host/pets" - silently dropping the API version
        # prefix and 404ing every request.
        url = self.base_url.rstrip('/') + '/' + endpoint.lstrip('/')
        
        # Get authentication headers and parameters (FastMCP enhanced)
        auth_headers = get_auth_headers(endpoint_id)
        auth_params = get_auth_params(endpoint_id)
        
        # Log authentication details for debugging
        logger.debug(f"Making request to {method} {url} for endpoint {endpoint_id}")
        if auth_headers:
            logger.debug(f"Using authentication headers: {list(auth_headers.keys())}")
        if auth_params:
            logger.debug(f"Using authentication parameters: {list(auth_params.keys())}")
        
        # Prepare request headers
        headers = {
            'User-Agent': f'{SERVER_NAME}/1.0',
            **auth_headers,
        }

        # Only declare JSON when a JSON body is actually being sent. httpx sets
        # the correct Content-Type for form and multipart bodies itself, and a
        # multipart request needs the boundary parameter it generates - forcing
        # application/json here makes the server reject the upload.
        if json_data is not None:
            headers['Content-Type'] = 'application/json'
        
        # Merge authentication parameters with request parameters
        merged_params = {**(params or {}), **auth_params}
        
        request_kwargs = {
            'method': method,
            'url': url,
            'headers': headers,
            'timeout': self.timeout,
            **kwargs
        }
        
        if merged_params:
            request_kwargs['params'] = merged_params
        if json_data is not None:
            request_kwargs['json'] = json_data
        if form_data:
            request_kwargs['data'] = form_data
        if files:
            request_kwargs['files'] = files
        
        # Make request with retries
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.request(**request_kwargs)
                    
                    # Handle response
                    if response.status_code >= 400:
                        error_detail = f"HTTP {response.status_code}"
                        try:
                            error_body = response.json()
                            if isinstance(error_body, dict) and 'message' in error_body:
                                error_detail += f": {error_body['message']}"
                        except:
                            error_detail += f": {response.text[:200]}"
                        
                        raise httpx.HTTPStatusError(
                            error_detail,
                            request=response.request,
                            response=response
                        )
                    
                    # Return JSON response
                    try:
                        return response.json()
                    except:
                        return {"data": response.text, "status": response.status_code}
                        
            except Exception as e:
                last_exception = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                continue
        
        # All retries failed
        raise last_exception or Exception("Request failed after all retries")

# Initialize API client
api_client = APIClient()

# Log authentication summary for debugging
logger.info(f"Starting {SERVER_NAME} with {len([${endpoints.map(e => `"${e.id}"`).join(', ')}])} endpoints")

`;

    // Generate FastMCP tool definitions and handlers
    endpoints.forEach((endpoint, index) => {
      code += this.generateFastMCPToolDefinition(endpoint, config, index);
      code += '\n\n';
    });

    // Generate server startup
    code += `
if __name__ == "__main__":
    import sys
    import signal
    
    def signal_handler(signum, frame):
        """Handle graceful shutdown on Ctrl+C"""
        logger.info("Received interrupt signal, shutting down gracefully...")
        sys.exit(0)
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Check for HTTP mode flag
        if "--http" in sys.argv:
            logger.warning("HTTP mode is not implemented")
            logger.info("MCP is a stdio protocol - this server speaks JSON-RPC over stdin/stdout")
            logger.info("For HTTP access to the same API, wrap the APIClient class")
            logger.info("in this file with a FastAPI or Flask app")
            logger.info("")
            logger.info("Starting in stdio mode...")
            app.run()
        else:
            logger.info(f"Starting {SERVER_NAME} in stdio mode")
            logger.info("Press Ctrl+C to stop the server")
            app.run()
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)
`;

    return code;
  }

  /**
   * Generate FastMCP tool definition using decorators
   */
  private static generateFastMCPToolDefinition(
    endpoint: ExtractedEndpoint,
    config: MCPGenerationConfig,
    _index: number
  ): string {
    const toolName = this.getToolName(endpoint, config);
    const description =
      endpoint.summary ||
      endpoint.description ||
      `${endpoint.method} ${endpoint.path}`;
    const pathParams = (endpoint.parameters || []).filter((p) => p.in === 'path');
    const queryParams = (endpoint.parameters || []).filter((p) => p.in === 'query');

    // Generate function parameters
    const functionParams: string[] = [];

    // Add path parameters
    pathParams.forEach((param) => {
      const paramType = this.getPythonType(param.schema?.type);
      const optional = param.required ? '' : ' = None';
      functionParams.push(`${param.name}: ${paramType}${optional}`);
    });

    // Add query parameters
    queryParams.forEach((param) => {
      const paramType = this.getPythonType(param.schema?.type);
      const optional = param.required ? '' : ' = None';
      functionParams.push(`${param.name}: ${paramType}${optional}`);
    });

    // Add request body for POST/PUT/PATCH. Form and multipart bodies are
    // expanded into one argument per field: a caller has no way to guess the
    // field names from an opaque `body` dict.
    const requestBody = this.describeRequestBody(endpoint);
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      if (requestBody.style === 'json') {
        functionParams.push('body: dict = None');
      } else {
        requestBody.fields.forEach((field) => {
          // File fields take a path on disk, which the tool reads.
          const fieldType = field.isFile ? 'str' : this.getPythonType(field.type);
          functionParams.push(`${field.name}: ${fieldType} = None`);
        });
      }
    }

    const paramsStr =
      functionParams.length > 0 ? functionParams.join(', ') : '';

    // Build endpoint URL with path parameters
    let endpointUrl = endpoint.path;
    pathParams.forEach((param) => {
      endpointUrl = endpointUrl.replace(`{${param.name}}`, `{${param.name}}`);
    });

    let toolCode = `@app.tool
async def ${toolName}(${paramsStr}) -> Any:
    """${description}"""
    try:
        # Build endpoint URL
        endpoint = "${endpointUrl}"`;

    if (pathParams.length > 0) {
      toolCode += `.format(${pathParams.map((p) => `${p.name}=${p.name}`).join(', ')})`;
    }

    toolCode += `
        
        # Prepare query parameters
        params = {}`;

    queryParams.forEach((param) => {
      toolCode += `
        if ${param.name} is not None:
            params["${param.name}"] = ${param.name}`;
    });

    // Assemble the form body before the request. File fields are read from
    // disk here rather than passed as open handles, so nothing is left to leak
    // if the request raises.
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && requestBody.style !== 'json') {
      toolCode += `
        
        # Prepare form body`;
      toolCode += `
        form_data = {}`;
      if (requestBody.fields.some((f) => f.isFile)) {
        toolCode += `
        files = {}`;
      }
      requestBody.fields.forEach((field) => {
        if (field.isFile) {
          toolCode += `
        if ${field.name} is not None:
            with open(${field.name}, "rb") as _fh:
                files["${field.name}"] = (os.path.basename(${field.name}), _fh.read())`;
        } else {
          toolCode += `
        if ${field.name} is not None:
            form_data["${field.name}"] = ${field.name}`;
        }
      });
    }

    toolCode += `
        
        # Make API request
        response = await api_client.make_request(
            method="${endpoint.method}",
            endpoint=endpoint,
            endpoint_id="${endpoint.id}",
            params=params if params else None,`;

    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      if (requestBody.style === 'json') {
        toolCode += `
            json_data=body,`;
      } else {
        toolCode += `
            form_data=form_data if form_data else None,`;
        if (requestBody.fields.some((f) => f.isFile)) {
          toolCode += `
            files=files if files else None,`;
        }
      }
    }

    toolCode += `
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error in ${toolName.toLowerCase()}: {str(e)}")
        raise`;

    return toolCode;
  }

  /**
   * Classify how an endpoint's request body must be sent.
   *
   * JSON bodies go through httpx's `json=`. Form and multipart bodies need
   * `data=` and `files=` respectively, and each form field becomes its own
   * tool argument rather than one opaque `body` dict — a model calling the
   * tool has no way to guess the field names otherwise.
   */
  private static describeRequestBody(endpoint: ExtractedEndpoint): {
    style: 'json' | 'form' | 'multipart';
    fields: Array<{ name: string; isFile: boolean; required: boolean; type?: string }>;
  } {
    const content = endpoint.requestBody?.content ?? {};
    const multipart = content['multipart/form-data'];
    const urlencoded = content['application/x-www-form-urlencoded'];
    const mediaType = multipart ?? urlencoded;

    if (!mediaType) {
      return { style: 'json', fields: [] };
    }

    const schema = mediaType.schema as
      | { properties?: Record<string, { type?: string; format?: string }>; required?: string[] }
      | undefined;
    const properties = schema?.properties ?? {};
    const required = new Set(schema?.required ?? []);

    const fields = Object.entries(properties).map(([name, propSchema]) => ({
      name,
      // Swagger 2.0 says `type: file`; OpenAPI 3.x says `format: binary`.
      isFile: propSchema?.type === 'file' || propSchema?.format === 'binary',
      required: required.has(name),
      type: propSchema?.type,
    }));

    return { style: multipart ? 'multipart' : 'form', fields };
  }

  /**
   * Get Python type from OpenAPI type
   */
  private static getPythonType(openApiType?: string): string {
    switch (openApiType) {
      case 'integer':
        return 'int';
      case 'number':
        return 'float';
      case 'boolean':
        return 'bool';
      case 'array':
        return 'list';
      case 'object':
        return 'dict';
      default:
        return 'str';
    }
  }

  /**
   * Generate stdio run script
   */
  private static generateStdioRunScript(config: MCPGenerationConfig): string {
    return `#!/usr/bin/env python3
"""
Run ${config.serverName} in stdio mode for MCP clients

This script starts the MCP server in stdio mode, which is designed for
integration with MCP clients like Claude Desktop, Cline, or other
MCP-compatible applications.
"""

import subprocess
import sys
import os
from pathlib import Path

def check_requirements():
    """Check if required files exist."""
    parent_dir = Path(__file__).parent.parent
    
    if not (parent_dir / "server.py").exists():
        print("Error: server.py not found in parent directory")
        sys.exit(1)
    
    if not (parent_dir / "requirements.txt").exists():
        print("Warning: requirements.txt not found")
    
    if not (parent_dir / ".env").exists() and (parent_dir / ".env.example").exists():
        print("Warning: .env file not found. Copy .env.example to .env and configure your credentials.")

def main():
    """Run the MCP server in stdio mode."""
    print(f"Starting ${config.serverName} in stdio mode...")
    print("This mode is designed for MCP client integration.")
    print("Press Ctrl+C to stop the server.\\n")
    
    # Change to the parent directory (where server.py is located)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(script_dir)
    os.chdir(parent_dir)
    
    # Check requirements
    check_requirements()
    
    # Run the server
    try:
        subprocess.run([sys.executable, "server.py"], check=True)
    except KeyboardInterrupt:
        print("\\nServer stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"\\nServer failed with exit code {e.returncode}")
        print("Check the error messages above for troubleshooting.")
        sys.exit(e.returncode)
    except FileNotFoundError:
        print("Error: Python interpreter not found")
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
  }

  /**
   * Generate HTTP run script
   */
  /**
   * Generate setup helper script
   */
  private static generateSetupScript(config: MCPGenerationConfig): string {
    const envVars = AuthConfigService.getUniqueEnvVars(config.authConfigs);

    return `#!/usr/bin/env python3
"""
Setup helper script for ${config.serverName}

This script helps you set up the MCP server environment by:
1. Installing Python dependencies
2. Creating .env file from template
3. Providing next steps for configuration
"""

import subprocess
import sys
import os
import platform
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"Error: Python 3.8+ required, but you have {version.major}.{version.minor}")
        print("Please upgrade Python and try again.")
        sys.exit(1)
    print(f"✓ Python {version.major}.{version.minor}.{version.micro} detected")

def check_pip():
    """Check if pip is available."""
    try:
        subprocess.run([sys.executable, "-m", "pip", "--version"], 
                      check=True, capture_output=True)
        print("✓ pip is available")
        return True
    except subprocess.CalledProcessError:
        print("Error: pip is not available")
        print("Please install pip and try again.")
        return False

def install_dependencies():
    """Install Python dependencies."""
    print("\\nInstalling Python dependencies...")
    try:
        # Upgrade pip first
        subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "pip"], 
                      check=True, capture_output=True)
        
        # Install requirements
        result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                               check=True, capture_output=True, text=True)
        print("✓ Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install dependencies")
        print(f"Error: {e}")
        if e.stdout:
            print(f"Output: {e.stdout}")
        if e.stderr:
            print(f"Error output: {e.stderr}")
        return False

def setup_env_file():
    """Setup environment file."""
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if env_file.exists():
        print("✓ .env file already exists")
        return True
    
    if env_example.exists():
        print("Creating .env file from .env.example...")
        try:
            env_file.write_text(env_example.read_text())
            print("✓ .env file created successfully")
            return True
        except Exception as e:
            print(f"✗ Failed to create .env file: {e}")
            return False
    else:
        print("Warning: .env.example not found")
        return False

def main():
    """Setup the MCP server environment."""
    print(f"🚀 Setting up ${config.serverName}...")
    print(f"Platform: {platform.system()} {platform.release()}")
    
    # Change to the parent directory (where requirements.txt is located)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(script_dir)
    os.chdir(parent_dir)
    print(f"Working directory: {os.getcwd()}")
    
    # Check Python version
    check_python_version()
    
    # Check pip availability
    if not check_pip():
        sys.exit(1)
    
    # Check if requirements.txt exists
    if not Path("requirements.txt").exists():
        print("Error: requirements.txt not found")
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies():
        print("\\nSetup failed due to dependency installation issues.")
        print("Try running manually: pip install -r requirements.txt")
        sys.exit(1)
    
    # Setup .env file
    setup_env_file()
    
    print("\\n🎉 Setup complete!")
    print("\\n📝 Next steps:")
    print("1. Edit .env file with your API credentials:")
${envVars.map((envVar) => `    print("   - ${envVar}=your-actual-value")`).join('\n')}
    print("\\n2. Choose your mode:")
    print("   📡 For MCP clients: python scripts/run-stdio.py")
    print("\\n3. Test the setup:")
    print("   python server.py --help")
    
    print("\\n📚 For more information, see README.md")

if __name__ == "__main__":
    main()
`;
  }

  /**
   * Generate docker-compose.yml for local development
   */
  /**
   * The compose service name. Derived in one place because the generated
   * README documents the `docker compose run` command by name — two
   * derivations would drift and send the reader to a service that isn't there.
   */
  private static composeServiceName(config: MCPGenerationConfig): string {
    return config.serverName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  /**
   * Whether the project ships the helper bundle: `scripts/run-stdio.py`,
   * `scripts/setup.py` and `docker-compose.yml`. They ship together, and every
   * README section that documents one of them is gated on this same predicate.
   *
   * The docker-compose section used to be gated on
   * `serverModes.includes('http')` instead. Once HTTP mode was removed that
   * flag became unreachable from the UI, so the file shipped in every FastMCP
   * project while the README it shipped with never mentioned it — and Docker
   * is a primary deployment path here.
   */
  private static shipsRunScriptBundle(config: MCPGenerationConfig): boolean {
    return Boolean(config.useFastMCP && config.includeRunScripts);
  }

  private static generateDockerCompose(config: MCPGenerationConfig): string {
    const serviceName = this.composeServiceName(config);

    // This file used to describe a web service: a published port, an HTTP
    // healthcheck, `restart: unless-stopped`, and `command: [..., "--http"]`.
    // None of it applied. The server speaks JSON-RPC over stdin/stdout, so
    // nothing ever listened on the port, the healthcheck could never pass and
    // left the container permanently unhealthy, and the restart policy turned
    // "exited because stdin closed" into a crash loop.
    return `# Docker Compose configuration for ${config.serverName}
#
# This server speaks MCP over stdin/stdout. It is NOT a network service: there
# is no port to publish and nothing to health-check over HTTP. An MCP client
# starts the process and owns its stdin/stdout, so \`docker compose up -d\` is
# not how you run it.
#
#   Build:            docker compose build
#   Run interactively: docker compose run --rm ${serviceName}
#
# To wire it into an MCP client, let the client run the container itself:
#
#   "command": "docker",
#   "args": ["run", "--rm", "-i", "--env-file", ".env", "${serviceName}"]
#
# The -i flag is required. Without stdin the server reads EOF and exits
# immediately.

services:
  ${serviceName}:
    build: .
    image: ${serviceName}
    # stdin is the transport, not a convenience - it has to stay open.
    stdin_open: true
    tty: false
    environment:
      - LOG_LEVEL=\${LOG_LEVEL:-INFO}
      - PYTHONUNBUFFERED=1
    env_file:
      - .env
    volumes:
      # Mount logs directory for persistent logging
      - ./logs:/app/logs
      # Mount source code for development (optional)
      # - ./server.py:/app/server.py
    # The server is meant to exit when its client disconnects; restarting it
    # on exit would spin forever.
    restart: "no"
`;
  }

  /**
   * Generate tool definition
   */
  private static generateToolDefinition(
    endpoint: ExtractedEndpoint,
    config: MCPGenerationConfig,
    _index: number
  ): string {
    const toolName = this.getToolName(endpoint, config);
    const description =
      endpoint.summary ||
      endpoint.description ||
      `${endpoint.method} ${endpoint.path}`;

    // Generate input schema
    const inputSchema = this.generateInputSchema(endpoint);

    // The advertised name must be `toolName` verbatim. FastMCP derives it from
    // the Python function name and so preserves case, and the generated README
    // documents that same casing for both templates - lowercasing it here made
    // every documented tool name wrong on basic servers ("Unknown tool").
    // The `_tool` / `handle_` identifiers below are internal Python names and
    // stay lowercased; only they and each other need to agree.
    return `# Tool: ${toolName}
${toolName.toLowerCase()}_tool = Tool(
    name="${toolName}",
    description="${description}",
    inputSchema=${JSON.stringify(inputSchema, null, 4)}
)`;
  }

  /**
   * Generate tool handler function
   */
  private static generateToolHandler(
    endpoint: ExtractedEndpoint,
    config: MCPGenerationConfig,
    _index: number
  ): string {
    const toolName = this.getToolName(endpoint, config);
    const pathParams = (endpoint.parameters || []).filter((p) => p.in === 'path');
    const queryParams = (endpoint.parameters || []).filter((p) => p.in === 'query');

    let handler = `async def handle_${toolName.toLowerCase()}(arguments: Dict[str, Any]) -> CallToolResult:
    """Handle ${toolName} tool execution."""
    try:
        # Extract parameters
`;

    // Handle path parameters
    if (pathParams.length > 0) {
      handler += `        # Path parameters\n`;
      pathParams.forEach((param) => {
        handler += `        ${param.name} = arguments.get("${param.name}")\n`;
        if (param.required) {
          // NOTE: must end on a bare newline. A trailing indent here becomes
          // leading indent on whatever the next iteration emits, producing an
          // IndentationError in the generated Python.
          handler += `        if ${param.name} is None:
            raise ValueError("Required parameter '${param.name}' is missing")
`;
        }
      });
      handler += '\n';
    }

    // Handle query parameters
    if (queryParams.length > 0) {
      handler += `        # Query parameters\n        params = {}\n`;
      queryParams.forEach((param) => {
        // NOTE: must end on a bare newline - see the path-parameter note above.
        handler += `        if "${param.name}" in arguments:
            params["${param.name}"] = arguments["${param.name}"]
`;
      });
      handler += '\n';
    } else {
      handler += `        params = None\n\n`;
    }

    // Build endpoint URL with path parameters
    let endpointUrl = endpoint.path;
    pathParams.forEach((param) => {
      endpointUrl = endpointUrl.replace(`{${param.name}}`, `{${param.name}}`);
    });

    handler += `        # Build endpoint URL
        endpoint = "${endpointUrl}"`;

    if (pathParams.length > 0) {
      handler += `.format(${pathParams.map((p) => `${p.name}=${p.name}`).join(', ')})`;
    }
    handler += '\n\n';

    // Handle request body for POST/PUT/PATCH. Form and multipart bodies are
    // built field by field; only JSON bodies pass through as one `body` dict.
    const requestBody = this.describeRequestBody(endpoint);
    const sendsBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);
    const usesForm = sendsBody && requestBody.style !== 'json';
    const hasFiles = usesForm && requestBody.fields.some((f) => f.isFile);

    if (usesForm) {
      handler += `        # Form body
        json_data = None
        form_data = {}
`;
      if (hasFiles) {
        handler += `        files = {}
`;
      }
      requestBody.fields.forEach((field) => {
        if (field.isFile) {
          // Read the file here rather than holding an open handle, so nothing
          // leaks if the request raises.
          handler += `        if arguments.get("${field.name}") is not None:
            with open(arguments["${field.name}"], "rb") as _fh:
                files["${field.name}"] = (os.path.basename(arguments["${field.name}"]), _fh.read())
`;
        } else {
          handler += `        if arguments.get("${field.name}") is not None:
            form_data["${field.name}"] = arguments["${field.name}"]
`;
        }
      });
      handler += `        
`;
    } else if (sendsBody) {
      handler += `        # Request body
        json_data = arguments.get("body")
        
`;
    } else {
      handler += `        json_data = None
        
`;
    }

    // Make API request
    handler += `        # Make API request
        response = await api_client.make_request(
            method="${endpoint.method}",
            endpoint=endpoint,
            endpoint_id="${endpoint.id}",
            params=params,
            json_data=json_data${usesForm ? ',\n            form_data=form_data if form_data else None' : ''}${hasFiles ? ',\n            files=files if files else None' : ''}
        )
        
        # Format response
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=json.dumps(response, indent=2)
                )
            ]
        )
        
    except Exception as e:
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"Error: {str(e)}"
                )
            ],
            isError=True
        )`;

    return handler;
  }

  /**
   * Map an OpenAPI type onto a valid JSON Schema type.
   *
   * The only mismatch in practice is Swagger 2.0's `file`, which has no JSON
   * Schema equivalent. File arguments are passed as a path, so they are strings.
   */
  private static toJsonSchemaType(openApiType?: string): string {
    const valid = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
    if (!openApiType) return 'string';
    return valid.includes(openApiType) ? openApiType : 'string';
  }

  /**
   * Generate input schema for tool
   */
  private static generateInputSchema(endpoint: ExtractedEndpoint): JSONSchema {
    const schema: JSONSchema & { properties: Record<string, JSONSchema>; required: string[] } = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Add parameters to schema
    (endpoint.parameters || []).forEach((param) => {
      const paramSchema: JSONSchema = {
        // Swagger 2.0's `type: file` is not a JSON Schema type, and the mcp
        // SDK validates arguments against this schema before dispatching -
        // leaving it in makes every call to the tool fail validation. The
        // argument is a path on disk, so it is a string.
        type: this.toJsonSchemaType(param.schema?.type),
        description: param.description || `${param.name} parameter`,
      };

      if (param.schema?.enum) {
        paramSchema.enum = param.schema.enum;
      }

      if (param.schema?.format) {
        paramSchema.format = param.schema.format;
      }

      schema.properties[param.name] = paramSchema;

      if (param.required) {
        schema.required.push(param.name);
      }
    });

    // Add request body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      schema.properties.body = {
        type: 'object',
        description: 'Request body data',
      };
    }

    return schema;
  }

  /**
   * Python keywords. A tool called `class` or `import` emits `async def class(`,
   * which is a SyntaxError - the whole server fails to import, not just that
   * tool. Soft keywords (`match`, `case`, `type`) are legal function names and
   * are deliberately not listed.
   */
  private static readonly PYTHON_KEYWORDS = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
    'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
    'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
    'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  ]);

  /** Resolved tool names per config, so every call site agrees. */
  private static toolNameCache = new WeakMap<
    MCPGenerationConfig,
    Map<ExtractedEndpoint, string>
  >();

  /**
   * Coerce an arbitrary operationId into a string that is simultaneously a
   * valid Python identifier (FastMCP names the tool after the function) and a
   * valid MCP tool name. Case is preserved deliberately - it is what the
   * generated README documents and what clients send back.
   *
   * Returns '' when nothing usable survives, so the caller can fall back to a
   * path-derived name.
   */
  private static sanitizeToolName(raw: string): string {
    let name = (raw || '')
      // NFKD splits an accented letter into base + combining mark; dropping the
      // marks transliterates (`gétPet` -> `getPet`) instead of punching a hole
      // in the middle of the word (`ge_tPet`).
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^[^a-zA-Z]+/, ''); // identifiers must start with a letter

    if (!name) return '';
    if (this.PYTHON_KEYWORDS.has(name)) name = `${name}_op`;
    return name;
  }

  /** The name this endpoint wants, before collisions are resolved. */
  private static preferredToolName(
    endpoint: ExtractedEndpoint,
    config: MCPGenerationConfig
  ): string {
    switch (config.toolNaming) {
      case 'operationId':
      case 'custom':
        // 'custom' would read from tool configs; until then it behaves as
        // operationId. Either way an unusable operationId falls back to path.
        return (
          this.sanitizeToolName(endpoint.operationId || '') ||
          this.generateNameFromPath(endpoint)
        );
      case 'path':
      default:
        return this.generateNameFromPath(endpoint);
    }
  }

  /**
   * Get tool name based on naming strategy.
   *
   * Names are resolved once for the whole endpoint list and memoized, because
   * sanitizing can map distinct operationIds onto the same identifier
   * (`get pet` and `get-pet` both become `get_pet`). Two tools sharing a name
   * means the second handler definition shadows the first and one endpoint
   * becomes unreachable, so duplicates get a numeric suffix in list order.
   * Every call site must see the same answer, hence the shared map rather than
   * a per-call computation.
   */
  private static getToolName(
    endpoint: ExtractedEndpoint,
    config: MCPGenerationConfig
  ): string {
    let resolved = this.toolNameCache.get(config);

    if (!resolved) {
      resolved = new Map<ExtractedEndpoint, string>();
      const taken = new Set<string>();

      for (const ep of config.endpoints || []) {
        const base = this.preferredToolName(ep, config);
        // Compare case-insensitively: two tools differing only in case are
        // indistinguishable to a person reading the generated README.
        let candidate = base;
        let suffix = 1;
        while (taken.has(candidate.toLowerCase())) {
          suffix += 1;
          candidate = `${base}_${suffix}`;
        }
        taken.add(candidate.toLowerCase());
        resolved.set(ep, candidate);
      }

      this.toolNameCache.set(config, resolved);
    }

    // An endpoint outside config.endpoints (defensive) still gets a valid name.
    return resolved.get(endpoint) ?? this.preferredToolName(endpoint, config);
  }

  /**
   * Generate tool name from path
   */
  private static generateNameFromPath(endpoint: ExtractedEndpoint): string {
    const pathParts = endpoint.path
      .split('/')
      .filter((part) => part && !part.startsWith('{'))
      .map((part) => part.replace(/[^a-zA-Z0-9]/g, '_'))
      .map((part) => part.replace(/^_+|_+$/g, '')) // Remove leading/trailing underscores
      .filter((part) => part);

    const baseName = pathParts.length > 0 ? pathParts.join('_') : 'api_call';

    // Ensure the function name starts with a letter and contains only valid Python identifier characters
    let functionName = `${endpoint.method.toLowerCase()}_${baseName}`;
    
    // Replace any remaining invalid characters and ensure it starts with a letter
    functionName = functionName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z]+/, '');
    
    // Consolidate consecutive underscores to avoid excessive underscores
    functionName = functionName.replace(/_+/g, '_');
    
    // Remove leading and trailing underscores
    functionName = functionName.replace(/^_+|_+$/g, '');
    
    // Ensure it's not empty and starts with a letter.
    //
    // This used to append Date.now(), which made generation non-deterministic:
    // the same spec produced different tool names on every run, and two
    // endpoints resolved in the same millisecond still collided. getToolName
    // resolves duplicates by suffix, so a plain stable name is both correct
    // and reproducible.
    if (!functionName || !/^[a-zA-Z]/.test(functionName)) {
      functionName = `tool_${endpoint.method.toLowerCase()}`;
    }

    return functionName;
  }

  /**
   * Generate requirements.txt
   */
  /**
   * The one list of Python packages a generated project needs.
   *
   * Only what the generated project actually imports. Extra entries are not
   * free: they slow every pip install and every Docker build, and they are a
   * supply-chain surface for code that is never executed. This previously
   * shipped asyncio-mqtt (basic) and uvicorn + python-multipart (FastMCP),
   * none of which appear anywhere in the generated output.
   *
   * Both `requirements.txt` and the dependency list shown on the results
   * screen come from here. They used to be computed separately, and the UI
   * copy was never updated - it advertised asyncio-mqtt to every user and
   * never mentioned fastmcp.
   */
  private static requirementList(config: MCPGenerationConfig): string[] {
    if (config.useFastMCP) {
      // `mcp` is declared even though server.py imports only fastmcp: the
      // test_client.py shipped alongside does `from mcp import ClientSession`.
      // fastmcp pulls it in transitively today, but an undeclared import is a
      // break waiting for a dependency change.
      return ['fastmcp>=0.1.0', 'httpx>=0.25.0', 'mcp>=1.0.0'];
    }

    return ['mcp>=1.0.0', 'httpx>=0.25.0'];
  }

  private static generateRequirements(config: MCPGenerationConfig): string {
    return this.requirementList(config).join('\n') + '\n';
  }

  /**
   * Generate README.md
   */
  private static generateReadme(config: MCPGenerationConfig): string {
    const { serverName, baseUrl, endpoints } = config;

    return `# ${serverName}

${config.useFastMCP ? 'FastMCP' : 'MCP'} server for ${baseUrl}

## Overview

This ${config.useFastMCP ? 'FastMCP' : 'MCP'} server provides access to ${endpoints.length} API endpoints as MCP tools.

## Installation

Requires **Python ${config.pythonVersion}+**. Check what you have:

\`\`\`bash
python3 --version
\`\`\`

### 1. Create a virtual environment

Work in a virtual environment rather than installing globally. Many current
Linux distributions refuse a global \`pip install\` outright with
\`error: externally-managed-environment\`, and an isolated environment keeps
this server's dependencies away from the rest of your system.

\`\`\`bash
python3 -m venv .venv
\`\`\`

### 2. Activate it

\`\`\`bash
# macOS / Linux
source .venv/bin/activate

# Windows (PowerShell)
.venv\\Scripts\\Activate.ps1

# Windows (cmd)
.venv\\Scripts\\activate.bat
\`\`\`

Your prompt should now be prefixed with \`(.venv)\`. Everything below assumes
the environment is active. Run \`deactivate\` when you are finished, and
re-activate it in each new shell.

### 3. Install dependencies

\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 4. Configure credentials

\`\`\`bash
cp .env.example .env        # Windows: copy .env.example .env
\`\`\`

Then edit \`.env\` and fill in your values. Keep it out of version control.

### 5. Run the server

\`\`\`bash
python server.py
\`\`\`

The server communicates over stdin/stdout, so it will appear to hang — that is
correct. It is waiting for an MCP client. Press Ctrl+C to stop. To exercise it
directly, use \`test_client.py\` instead.

> **Note the interpreter path.** MCP clients start this server themselves, with
> their own environment rather than your shell's — so a bare \`python\` will not
> find the packages you just installed. Use the absolute path printed by:
> \`\`\`bash
> python -c "import sys; print(sys.executable)"
> \`\`\`

${config.useFastMCP ? `
## Server Modes

### Stdio Mode
Run the server in stdio mode (for direct MCP integration):
\`\`\`bash
python server.py
# Or if you have run scripts enabled:
python scripts/run-stdio.py
\`\`\`

### HTTP Mode

Not implemented. MCP is a stdio protocol, and this server does not expose an
HTTP interface — passing \`--http\` logs a warning and starts in stdio mode.

If you need HTTP access to the same API, put a FastAPI or Flask app in front of
the generated \`APIClient\` class in \`server.py\`; it already handles
authentication, retries and error mapping.

` : ''}

## Docker

Build the image:

\`\`\`bash
docker build -t ${config.serverName} .
\`\`\`

Run it, passing your credentials from \`.env\`:

\`\`\`bash
docker run -i --rm --env-file .env ${config.serverName}
\`\`\`

**The \`-i\` flag is required.** An MCP server in stdio mode talks JSON-RPC over
stdin and stdout. Without \`-i\` the container gets no stdin, and the server
exits immediately with no useful message.

**Do not pass \`-t\`.** Allocating a TTY injects terminal control sequences into
stdout, which corrupts the protocol stream — the client fails to parse it and
the connection drops.

To pass individual variables instead of a file:

\`\`\`bash
docker run -i --rm -e API_KEY=your_key ${config.serverName}
\`\`\`
${this.shipsRunScriptBundle(config) ? `
### Docker Compose

A \`docker-compose.yml\` is included for local development:

\`\`\`bash
docker compose build
docker compose run --rm ${this.composeServiceName(config)}
\`\`\`

Use \`run\`, not \`up\`. \`docker compose up\` does not attach stdin, and stdin is
the transport — the server would read EOF and exit immediately. To wire the
container into an MCP client, let the client run it (see the comments at the top
of \`docker-compose.yml\`).
` : ''}

## Available Tools

${endpoints
  .map((endpoint) => {
    const toolName = this.getToolName(endpoint, config);
    const description =
      endpoint.summary ||
      endpoint.description ||
      `${endpoint.method} ${endpoint.path}`;
    return `### ${toolName}
- **Method**: ${endpoint.method}
- **Path**: ${endpoint.path}
- **Description**: ${description}`;
  })
  .join('\n\n')}

## Support

Generated by API MCP Generator
Base URL: ${baseUrl}
Generated on: ${new Date().toISOString()}`;
  }

  /**
   * Generate pyproject.toml
   */
  private static generatePyProject(config: MCPGenerationConfig): string {
    return `[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "${config.serverName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}"
version = "1.0.0"
description = "MCP server for ${config.baseUrl}"
authors = [
    {name = "API MCP Generator"}
]
dependencies = [
    "mcp>=1.0.0",
    "httpx>=0.25.0",
]
requires-python = ">=${config.pythonVersion}"

[project.scripts]
${config.serverName.toLowerCase().replace(/[^a-z0-9-]/g, '-')} = "server:main"

[tool.setuptools]
py-modules = ["server"]
`;
  }

  /**
   * Generate Dockerfile
   */
  private static generateDockerfile(config: MCPGenerationConfig): string {
    return `FROM python:${config.pythonVersion}-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY server.py .
COPY .env.example .

# Create non-root user
RUN useradd -m -u 1000 mcpuser && chown -R mcpuser:mcpuser /app
USER mcpuser

# No EXPOSE: this server talks JSON-RPC over stdin/stdout and never binds a
# port. Run it with \`docker run -i\` so the client can reach its stdin.
CMD ["python", "server.py"]
`;
  }

  /**
   * Get project dependencies
   */
  private static getDependencies(config: MCPGenerationConfig): string[] {
    return this.requirementList(config);
  }

  /**
   * Generate setup instructions
   */
  private static generateInstructions(config: MCPGenerationConfig): string {
    const envVars = AuthConfigService.getUniqueEnvVars(config.authConfigs);

    return `Setup Instructions for ${config.serverName}

1. Install Python ${config.pythonVersion} or later
2. Install dependencies: pip install -r requirements.txt
3. Configure environment variables in .env file
${envVars.length > 0 ? `4. Set required environment variables: ${envVars.join(', ')}` : ''}
5. Run the server: python server.py
6. Add to your MCP client configuration

The server will provide ${config.endpoints.length} tools for API access.
`;
  }
}
