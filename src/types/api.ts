// API Response and Service Types
import type { Endpoint, ParsedSpec, JsonValue } from './openapi';
import type { InputMetadata } from './app';

export interface ParsingError {
  type: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MCPConfig {
  serverName: string;
  baseUrl: string;
  endpoints: Endpoint[];
  authConfigs: Record<string, AuthConfig>;
  toolNaming: string;
  includeExamples: boolean;
  errorHandling: string;
  pythonVersion: string;
}

export interface ToolConfig {
  name: string;
  description: string;
  parameters: Record<string, JsonValue>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, JsonValue>;
}

export interface MCPServerTemplate {
  name: string;
  description: string;
  files: Array<{ path: string; content: string; }>;
}

export interface GeneratedProject {
  files: Array<{ path: string; content: string; description: string; }>;
  structure: string[];
  dependencies: string[];
  envVars: string[];
  instructions: string;
}

export interface AuthConfig {
  type: string;
  envVarName: string;
  required: boolean;
}

export interface AppError {
  message: string;
  type: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

// File handling types
export interface FileUpload {
  file: File;
  content: string;
  type: 'json' | 'yaml';
  size: number;
  lastModified: number;
}

export interface UrlFetch {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

// Parser service types
export interface ParserOptions {
  validate: boolean;
  resolve: boolean;
  dereference: boolean;
  allowEmpty: boolean;
}

export interface ParserResult {
  spec: Record<string, unknown>;
  errors: ParsingError[];
  warnings: string[];
  metadata: ParserMetadata;
}

export interface ParserMetadata {
  version: string;
  format: 'json' | 'yaml';
  size: number;
  endpointCount: number;
  tagCount: number;
  schemaCount: number;
  parseTime: number;
}

// Generator service types
export interface GeneratorOptions {
  template: string;
  outputFormat: 'python' | 'javascript' | 'typescript';
  includeTests: boolean;
  includeDocumentation: boolean;
  minify: boolean;
}

export interface GeneratorResult {
  files: GeneratedFile[];
  metadata: GeneratorMetadata;
  warnings: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'source' | 'config' | 'documentation' | 'test';
  size: number;
}

export interface GeneratorMetadata {
  toolCount: number;
  fileCount: number;
  totalSize: number;
  generationTime: number;
  template: string;
}

// No export-service types here. `ExportOptions` and `ExportResult` are owned by
// `services/exportService.ts`, which is the only implementation. Duplicates
// lived here too, and because `types/index.ts` re-exports this module with
// `export * from './api'`, an `import type { ExportOptions } from '../types'`
// would have silently resolved to the wrong shape.
//
// The `SpecParserService`, `MCPGeneratorService` and `ExportService` interfaces
// that followed were removed for the same reason: nothing implemented them and
// nothing imported them, so they described an intended design rather than the
// code. `ExportService` specified `createArchive`, `generateReadme` and
// `generateEnvTemplate`, none of which have ever existed, alongside an
// `exportProject` whose signature did not match the real one. Read as
// documentation, they were wrong; read as types, they were unreachable.

// HTTP client types
export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

export interface RequestConfig {
  method: string;
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, JsonValue>;
  data?: JsonValue;
  timeout?: number;
}

// Cache types
export interface CacheEntry<T = JsonValue> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  serialize?: boolean;
}

// Event types
export interface AppEvent {
  type: string;
  payload?: unknown;
  timestamp: number;
}

export interface SpecLoadedEvent extends AppEvent {
  type: 'spec:loaded';
  payload: {
    spec: ParsedSpec;
    metadata: InputMetadata;
  };
}

export interface EndpointSelectedEvent extends AppEvent {
  type: 'endpoint:selected';
  payload: {
    endpointId: string;
    endpoint: Endpoint;
  };
}

export interface ProjectGeneratedEvent extends AppEvent {
  type: 'project:generated';
  payload: {
    project: GeneratedProject;
    config: MCPConfig;
  };
}

export interface ErrorEvent extends AppEvent {
  type: 'error';
  payload: {
    error: AppError;
    context?: string;
  };
}