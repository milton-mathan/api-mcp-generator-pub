// MCP (Model Context Protocol) Types
import { JsonValue } from './openapi';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  implementation: string;
  endpoint: string;
  method: string;
}

export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: JsonValue[];
  description?: string;
  example?: JsonValue;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
}

export interface MCPConfig {
  endpoints: string[]; // endpoint IDs
  serverName: string;
  baseUrl: string;
  authentication?: AuthConfig;
  toolNaming: 'operationId' | 'path' | 'custom';
  includeExamples: boolean;
  errorHandling: 'basic' | 'detailed';
  customToolNames?: Record<string, string>;
  // FastMCP-specific options
  useFastMCP: boolean;
  serverModes: ('stdio' | 'http')[];
  httpPort: number;
  logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  includeRunScripts: boolean;
  pythonVersion: '3.8' | '3.9' | '3.10' | '3.11' | '3.12';
}

export interface AuthConfig {
  type: 'none' | 'apiKey' | 'bearer' | 'basic' | 'oauth2';
  location?: 'header' | 'query';
  name?: string;
  envVar: string;
  description?: string;
}

export interface GeneratedProject {
  files: Record<string, string>;
  structure: ProjectStructure;
  instructions: DeploymentInstructions;
  config: MCPConfig;
  // Enhanced for fastmcp
  runScripts?: Record<string, string>;
  dockerCompose?: string;
}

export interface ProjectStructure {
  rootDir: string;
  files: FileStructure[];
  dependencies: string[];
}

export interface FileStructure {
  path: string;
  type: 'file' | 'directory';
  description: string;
}

export interface DeploymentInstructions {
  setup: string[];
  installation: string[];
  configuration: string[];
  testing: string[];
  deployment: string[];
}

export interface ToolConfig {
  name: string;
  description: string;
  customName?: string;
  includeAuth: boolean;
  includeExamples: boolean;
}

export interface MCPServerTemplate {
  name: string;
  description: string;
  template: string;
  requiredDependencies: string[];
  optionalDependencies: string[];
}

export interface FastMCPServerConfig {
  serverName: string;
  description: string;
  version: string;
  logLevel: string;
  httpConfig?: {
    host: string;
    port: number;
    cors: boolean;
  };
  stdioConfig?: {
    bufferSize: number;
    timeout: number;
  };
}