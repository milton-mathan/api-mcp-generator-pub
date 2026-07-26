import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import type {
  FileUpload,
  ParsedSpec,
  ParserResult,
  ParserOptions,
  ValidationError,
  ParsingError,
  Endpoint,
  HttpMethod,
  Schema,
  Operation,
  JsonValue,
  SpecInfo,
  Server,
  PathItem
} from '../types';

// Default parser options
const defaultOptions: ParserOptions = {
  validate: true,
  resolve: true,
  // On by default: without it, request body schemas arrive as bare
  // `$ref: "#/definitions/Pet"` and the generated tools get a placeholder
  // instead of the real shape.
  dereference: true,
  allowEmpty: false,
};

/**
 * Resolve internal `$ref` pointers only.
 *
 * External refs would have the browser fetch whatever URL the specification
 * names — an arbitrary request driven by an untrusted document, and a slow one
 * over a large spec. Everything a generated server needs is in-document.
 */
const INTERNAL_REFS_ONLY = { resolve: { external: false } } as const;

/**
 * Parse API specification from uploaded file
 */
export async function parseSpecFromFile(
  fileUpload: FileUpload,
  options: Partial<ParserOptions> = {}
): Promise<ParserResult> {
  const opts = { ...defaultOptions, ...options };
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const startTime = Date.now();

  try {
    // Parse content based on file type
    let parsedContent: unknown;
    
    if (fileUpload.type === 'json') {
      try {
        parsedContent = JSON.parse(fileUpload.content);
      } catch (error) {
        const jsonError = error as SyntaxError;
        throw createParsingError(
          `Invalid JSON format: ${jsonError.message}`,
          extractLineColumn(jsonError.message),
          fileUpload.content
        );
      }
    } else if (fileUpload.type === 'yaml') {
      try {
        parsedContent = yaml.load(fileUpload.content, {
          onWarning: (warning) => {
            warnings.push(`YAML warning: ${warning.message}`);
          }
        });
      } catch (error) {
        const yamlError = error as yaml.YAMLException;
        throw createParsingError(
          `Invalid YAML format: ${yamlError.message}`,
          { line: yamlError.mark?.line, column: yamlError.mark?.column },
          fileUpload.content
        );
      }
    } else {
      throw new Error(`Unsupported file type: ${fileUpload.type}`);
    }

    // Basic validation
    if (!parsedContent || typeof parsedContent !== 'object') {
      throw new Error('Specification must be a valid object');
    }

    // `typeof x === 'object'` only narrows to `object`, which has no index
    // signature; widen to a record so the spec fields are addressable.
    const specDocument = parsedContent as Record<string, unknown>;

    // Detect and validate OpenAPI version
    const version = detectOpenAPIVersion(specDocument);
    if (!version) {
      throw new Error('Unable to detect OpenAPI version. Make sure this is a valid OpenAPI specification.');
    }

    // Use swagger-parser for comprehensive validation if enabled
    if (opts.validate) {
      try {
        await SwaggerParser.validate(
          specDocument as unknown as Parameters<typeof SwaggerParser.validate>[0],
          INTERNAL_REFS_ONLY
        );
      } catch (error) {
        const swaggerError = error as Error;
        warnings.push(`Swagger Parser warning: ${swaggerError.message}`);
        // Don't fail on swagger-parser errors, just warn
      }
    }

    // Perform our custom validation
    const validationResult = validateSpecStructure(specDocument, version);
    errors.push(...validationResult.errors);
    warnings.push(...validationResult.warnings);

    // Dereference $ref if requested
    let processedSpec: Record<string, unknown> = specDocument;
    if (opts.dereference) {
      try {
        processedSpec = (await SwaggerParser.dereference(
          specDocument as unknown as Parameters<typeof SwaggerParser.dereference>[0],
          INTERNAL_REFS_ONLY
        )) as unknown as Record<string, unknown>;
        // Success is deliberately silent. This used to push
        // "Specification has been dereferenced (all $ref resolved)", which is a
        // success message wearing a warning's clothes: every successful parse
        // raised it, so the amber warning box in ApiExplorer was permanently
        // lit with nothing actionable in it. Users learn to ignore that box,
        // and a real warning goes unread with it. Failure below still warns.
      } catch (error) {
        warnings.push(`Failed to dereference specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Convert to our internal format
    const spec: ParsedSpec = await normalizeSpec(processedSpec, version, opts);

    // Calculate metadata
    const endpointCount = countEndpoints(spec.paths);
    const schemaCount = countSchemas(spec.components?.schemas);
    
    const metadata = {
      version,
      format: fileUpload.type,
      size: fileUpload.size,
      endpointCount,
      tagCount: spec.tags?.length || 0,
      schemaCount,
      parseTime: Date.now() - startTime,
    };

    return {
      spec: spec as unknown as Record<string, unknown>,
      errors,
      warnings,
      metadata,
    };
  } catch (error) {
    // createParsingError returns a plain object, not an Error subclass, so an
    // `instanceof Error` test misses it and the real message ("Invalid JSON
    // format: ...") gets replaced with a useless placeholder. Detect the
    // structure instead.
    const isParsingError =
      typeof error === 'object' &&
      error !== null &&
      (error as { type?: unknown }).type === 'parsing' &&
      typeof (error as { message?: unknown }).message === 'string';

    const parseError: ParsingError = isParsingError
      ? (error as ParsingError)
      : {
          type: 'parsing' as const,
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          details: error as ParsingError['details'],
          timestamp: Date.now(),
          recoverable: true,
        };

    return {
      spec: null as unknown as Record<string, unknown>,
      errors: [parseError],
      warnings,
      metadata: {
        version: 'unknown',
        format: fileUpload.type,
        size: fileUpload.size,
        endpointCount: 0,
        tagCount: 0,
        schemaCount: 0,
        parseTime: Date.now() - startTime,
      },
    };
  }
}

/**
 * Create a parsing error with line/column information
 */
function createParsingError(message: string, position?: { line?: number; column?: number }, content?: string): ParsingError {
  const error: ParsingError = {
    type: 'parsing',
    message,
    timestamp: Date.now(),
    recoverable: true,
    line: position?.line,
    column: position?.column,
  };

  // Add context if we have line information
  if (position?.line && content) {
    const lines = content.split('\n');
    const errorLine = lines[position.line - 1];
    if (errorLine) {
      error.details = {
        line: position.line,
        column: position.column,
        context: errorLine.trim(),
      } as JsonValue;
    }
  }

  return error;
}

/**
 * Extract line and column from error message
 */
function extractLineColumn(message: string): { line?: number; column?: number } {
  const lineMatch = message.match(/line (\d+)/i);
  const columnMatch = message.match(/column (\d+)/i);
  
  return {
    line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
    column: columnMatch ? parseInt(columnMatch[1], 10) : undefined,
  };
}

/**
 * Detect OpenAPI version from specification
 */
function detectOpenAPIVersion(spec: Record<string, unknown>): string | null {
  // Check for OpenAPI 3.x
  if (spec.openapi) {
    const version = spec.openapi;
    if (typeof version === 'string') {
      if (version.startsWith('3.1')) return '3.1';
      if (version.startsWith('3.0')) return '3.0';
      if (version.startsWith('3.')) return '3.0'; // Default to 3.0 for other 3.x versions
    }
    return null;
  }
  
  // Check for Swagger 2.0
  if (spec.swagger === '2.0') {
    return '2.0';
  }
  
  return null;
}

/**
 * Count endpoints in paths object
 */
function countEndpoints(paths: Record<string, unknown>): number {
  let count = 0;
  const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
  
  for (const pathItem of Object.values(paths)) {
    if (pathItem && typeof pathItem === 'object') {
      const operations = pathItem as Record<string, unknown>;
      for (const method of httpMethods) {
        if (operations[method]) {
          count++;
        }
      }
    }
  }
  
  return count;
}

/**
 * Count schemas in components
 */
function countSchemas(schemas?: Record<string, unknown>): number {
  return schemas ? Object.keys(schemas).length : 0;
}

/**
 * Comprehensive validation of OpenAPI specification structure
 */
function validateSpecStructure(spec: Record<string, unknown>, version: string) {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Validate required root fields
  const requiredFields = ['info', 'paths'];
  for (const field of requiredFields) {
    if (!spec[field]) {
      errors.push({
        type: 'validation',
        message: `Missing required field: ${field}`,
        field,
        timestamp: Date.now(),
        recoverable: false,
      });
    }
  }

  // Validate info object
  if (spec.info) {
    const info = spec.info as Record<string, unknown>;

    if (!info.title) {
      errors.push({
        type: 'validation',
        message: 'Missing required field: info.title',
        field: 'info.title',
        timestamp: Date.now(),
        recoverable: false,
      });
    }
    if (!info.version) {
      errors.push({
        type: 'validation',
        message: 'Missing required field: info.version',
        field: 'info.version',
        timestamp: Date.now(),
        recoverable: false,
      });
    }

    // Validate optional info fields
    if (info.contact && typeof info.contact !== 'object') {
      warnings.push('info.contact should be an object');
    }
    if (info.license && typeof info.license !== 'object') {
      warnings.push('info.license should be an object');
    }
  }

  // Validate paths
  if (spec.paths) {
    if (typeof spec.paths !== 'object') {
      errors.push({
        type: 'validation',
        message: 'paths must be an object',
        field: 'paths',
        timestamp: Date.now(),
        recoverable: false,
      });
    } else if (Object.keys(spec.paths).length === 0) {
      warnings.push('No paths defined in specification');
    } else {
      // Validate individual paths
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (!path.startsWith('/')) {
          warnings.push(`Path "${path}" should start with "/"`);
        }

        if (pathItem && typeof pathItem === 'object') {
          validatePathItem(path, pathItem as Record<string, unknown>, version, errors, warnings);
        }
      }
    }
  }

  // Version-specific validation
  if (version === '2.0') {
    validateSwagger2(spec, errors, warnings);
  } else if (version.startsWith('3.')) {
    validateOpenAPI3(spec, version, errors, warnings);
  }

  // Validate tags
  if (spec.tags && Array.isArray(spec.tags)) {
    const tagNames = new Set<string>();
    for (const tag of spec.tags) {
      if (!tag.name) {
        warnings.push('Tag is missing required "name" field');
      } else if (tagNames.has(tag.name)) {
        warnings.push(`Duplicate tag name: "${tag.name}"`);
      } else {
        tagNames.add(tag.name);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validate Swagger 2.0 specific fields
 */
function validateSwagger2(spec: Record<string, unknown>, errors: ValidationError[], warnings: string[]) {
  // Swagger 2.0 specific validations
  if (spec.host && typeof spec.host !== 'string') {
    warnings.push('host should be a string');
  }
  
  if (
    typeof spec.basePath === 'string' &&
    (!spec.basePath.startsWith('/') || spec.basePath.endsWith('/'))
  ) {
    warnings.push('basePath should start with "/" and not end with "/"');
  }
  
  if (spec.schemes && !Array.isArray(spec.schemes)) {
    warnings.push('schemes should be an array');
  }
  
  if (spec.consumes && !Array.isArray(spec.consumes)) {
    warnings.push('consumes should be an array');
  }
  
  if (spec.produces && !Array.isArray(spec.produces)) {
    warnings.push('produces should be an array');
  }
}

/**
 * Validate OpenAPI 3.x specific fields
 */
function validateOpenAPI3(spec: Record<string, unknown>, version: string, errors: ValidationError[], warnings: string[]) {
  // Validate servers
  if (spec.servers) {
    if (!Array.isArray(spec.servers)) {
      warnings.push('servers should be an array');
    } else {
      for (const server of spec.servers) {
        if (!server.url) {
          warnings.push('Server is missing required "url" field');
        }
      }
    }
  }
  
  // Validate components (OpenAPI 3.x)
  if (spec.components && typeof spec.components !== 'object') {
    warnings.push('components should be an object');
  }
  
  // OpenAPI 3.1 specific validations
  if (version === '3.1') {
    // OpenAPI 3.1 allows JSON Schema draft 2020-12
    if (spec.jsonSchemaDialect && typeof spec.jsonSchemaDialect !== 'string') {
      warnings.push('jsonSchemaDialect should be a string');
    }
  }
}

/**
 * Validate individual path item
 */
function validatePathItem(path: string, pathItem: Record<string, unknown>, version: string, errors: ValidationError[], warnings: string[]) {
  const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
  let hasOperations = false;
  
  for (const method of httpMethods) {
    const operation = pathItem[method];
    if (operation) {
      hasOperations = true;
      validateOperation(path, method, operation as Record<string, unknown>, version, errors, warnings);
    }
  }
  
  if (!hasOperations) {
    warnings.push(`Path "${path}" has no HTTP operations defined`);
  }
  
  // Validate path-level parameters
  if (pathItem.parameters && !Array.isArray(pathItem.parameters)) {
    warnings.push(`Path "${path}" parameters should be an array`);
  }
}

/**
 * Validate individual operation
 */
function validateOperation(path: string, method: string, operation: Record<string, unknown>, version: string, errors: ValidationError[], warnings: string[]) {
  const operationId = `${method.toUpperCase()} ${path}`;
  
  // Validate responses (required)
  if (!operation.responses) {
    errors.push({
      type: 'validation',
      message: `Operation ${operationId} is missing required "responses" field`,
      field: `paths.${path}.${method}.responses`,
      timestamp: Date.now(),
      recoverable: false,
    });
  } else if (typeof operation.responses !== 'object') {
    errors.push({
      type: 'validation',
      message: `Operation ${operationId} responses must be an object`,
      field: `paths.${path}.${method}.responses`,
      timestamp: Date.now(),
      recoverable: false,
    });
  }
  
  // Validate parameters
  if (operation.parameters && !Array.isArray(operation.parameters)) {
    warnings.push(`Operation ${operationId} parameters should be an array`);
  }
  
  // Validate tags
  if (operation.tags && !Array.isArray(operation.tags)) {
    warnings.push(`Operation ${operationId} tags should be an array`);
  }
  
  // Version-specific operation validation
  if (version === '2.0') {
    // Swagger 2.0 specific
    if (operation.consumes && !Array.isArray(operation.consumes)) {
      warnings.push(`Operation ${operationId} consumes should be an array`);
    }
    if (operation.produces && !Array.isArray(operation.produces)) {
      warnings.push(`Operation ${operationId} produces should be an array`);
    }
  } else {
    // OpenAPI 3.x specific
    if (operation.requestBody && typeof operation.requestBody !== 'object') {
      warnings.push(`Operation ${operationId} requestBody should be an object`);
    }
  }
}

/**
 * Normalize specification to our internal format
 */
async function normalizeSpec(spec: Record<string, unknown>, version: string, _options: ParserOptions): Promise<ParsedSpec> {
  const normalized: ParsedSpec = {
    version: version as ParsedSpec['version'],
    info: normalizeInfo(spec.info),
    paths: normalizePaths((spec.paths as Record<string, unknown>) || {}, version),
    tags: (spec.tags as ParsedSpec['tags']) || [],
    security: spec.security as ParsedSpec['security'],
    externalDocs: spec.externalDocs as ParsedSpec['externalDocs'],
  };

  // Handle version-specific fields
  if (version.startsWith('3.')) {
    normalized.servers = normalizeServers(spec.servers);
    normalized.components = normalizeComponents(spec.components, version);
  } else if (version === '2.0') {
    // Convert Swagger 2.0 to OpenAPI 3.x format
    normalized.servers = convertSwagger2Servers(spec);
    normalized.components = convertSwagger2Components(spec);
  }

  return normalized;
}

/**
 * Normalize info object
 */
function normalizeInfo(info: unknown): SpecInfo {
  const infoObj = info as Record<string, unknown> | undefined;
  return {
    title: (infoObj?.title as string) || 'Untitled API',
    version: (infoObj?.version as string) || '1.0.0',
    description: infoObj?.description as string | undefined,
    termsOfService: infoObj?.termsOfService as string | undefined,
    contact: infoObj?.contact as SpecInfo['contact'],
    license: infoObj?.license as SpecInfo['license'],
  };
}

/**
 * Normalize servers array
 */
function normalizeServers(servers: unknown): Server[] | undefined {
  if (!servers || !Array.isArray(servers)) {
    return undefined;
  }

  return servers.map((server: unknown) => {
    const serverObj = server as Record<string, unknown>;
    return {
      url: (serverObj.url as string) || '',
      description: serverObj.description as string | undefined,
      variables: serverObj.variables as Server['variables'],
    };
  });
}

/**
 * Normalize components object
 */
function normalizeComponents(components: unknown, _version: string) {
  if (!components || typeof components !== 'object') {
    return undefined;
  }

  const componentsObj = components as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  if (componentsObj.schemas) {
    normalized.schemas = normalizeSchemas(componentsObj.schemas as Record<string, unknown>);
  }

  if (componentsObj.responses) {
    normalized.responses = componentsObj.responses;
  }

  if (componentsObj.parameters) {
    normalized.parameters = componentsObj.parameters;
  }

  if (componentsObj.examples) {
    normalized.examples = componentsObj.examples;
  }

  if (componentsObj.requestBodies) {
    normalized.requestBodies = componentsObj.requestBodies;
  }

  if (componentsObj.headers) {
    normalized.headers = componentsObj.headers;
  }

  if (componentsObj.securitySchemes) {
    normalized.securitySchemes = componentsObj.securitySchemes;
  }

  if (componentsObj.links) {
    normalized.links = componentsObj.links;
  }

  if (componentsObj.callbacks) {
    normalized.callbacks = componentsObj.callbacks;
  }
  
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * Normalize schemas object
 */
function normalizeSchemas(schemas: Record<string, unknown>) {
  const normalized: Record<string, Schema> = {};
  
  for (const [name, schema] of Object.entries(schemas)) {
    normalized[name] = normalizeSchema(schema);
  }
  
  return normalized;
}

/**
 * Normalize individual schema
 */
function normalizeSchema(schema: unknown): Schema {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const schemaObj = schema as Record<string, unknown>;
  const normalized: Schema = {};

  // Carry an unresolved $ref through rather than dropping it. Every other
  // field is copied by name, so a schema that is nothing but a $ref used to
  // normalize to `{}` - a silently empty request body with no indication
  // anything was lost. Dereferencing is on by default, so this is the fallback
  // for the case where it was disabled or failed.
  if (typeof schemaObj.$ref === 'string') normalized.$ref = schemaObj.$ref;

  // Basic schema properties
  if (schemaObj.type) normalized.type = schemaObj.type as Schema['type'];
  if (schemaObj.format) normalized.format = schemaObj.format as string;
  if (schemaObj.title) normalized.title = schemaObj.title as string;
  if (schemaObj.description) normalized.description = schemaObj.description as string;
  if (schemaObj.default !== undefined) normalized.default = schemaObj.default as JsonValue;
  if (schemaObj.example !== undefined) normalized.example = schemaObj.example as JsonValue;
  if (schemaObj.enum) normalized.enum = schemaObj.enum as JsonValue[];
  if (schemaObj.nullable !== undefined) normalized.nullable = schemaObj.nullable as boolean;
  if (schemaObj.readOnly !== undefined) normalized.readOnly = schemaObj.readOnly as boolean;
  if (schemaObj.writeOnly !== undefined) normalized.writeOnly = schemaObj.writeOnly as boolean;
  if (schemaObj.deprecated !== undefined) normalized.deprecated = schemaObj.deprecated as boolean;
  
  // Validation properties
  if (schemaObj.multipleOf !== undefined) normalized.multipleOf = schemaObj.multipleOf as number;
  if (schemaObj.maximum !== undefined) normalized.maximum = schemaObj.maximum as number;
  if (schemaObj.exclusiveMaximum !== undefined) normalized.exclusiveMaximum = schemaObj.exclusiveMaximum as Schema['exclusiveMaximum'];
  if (schemaObj.minimum !== undefined) normalized.minimum = schemaObj.minimum as number;
  if (schemaObj.exclusiveMinimum !== undefined) normalized.exclusiveMinimum = schemaObj.exclusiveMinimum as Schema['exclusiveMinimum'];
  if (schemaObj.maxLength !== undefined) normalized.maxLength = schemaObj.maxLength as number;
  if (schemaObj.minLength !== undefined) normalized.minLength = schemaObj.minLength as number;
  if (schemaObj.pattern) normalized.pattern = schemaObj.pattern as string;
  if (schemaObj.maxItems !== undefined) normalized.maxItems = schemaObj.maxItems as number;
  if (schemaObj.minItems !== undefined) normalized.minItems = schemaObj.minItems as number;
  if (schemaObj.uniqueItems !== undefined) normalized.uniqueItems = schemaObj.uniqueItems as boolean;
  if (schemaObj.maxProperties !== undefined) normalized.maxProperties = schemaObj.maxProperties as number;
  if (schemaObj.minProperties !== undefined) normalized.minProperties = schemaObj.minProperties as number;
  if (schemaObj.required) normalized.required = schemaObj.required as string[];
  
  // Object properties
  if (schemaObj.properties) {
    normalized.properties = {};
    const props = schemaObj.properties as Record<string, unknown>;
    for (const [propName, propSchema] of Object.entries(props)) {
      normalized.properties[propName] = normalizeSchema(propSchema);
    }
  }

  if (schemaObj.additionalProperties !== undefined) {
    if (typeof schemaObj.additionalProperties === 'boolean') {
      normalized.additionalProperties = schemaObj.additionalProperties;
    } else {
      normalized.additionalProperties = normalizeSchema(schemaObj.additionalProperties);
    }
  }

  // Array properties
  if (schemaObj.items) {
    normalized.items = normalizeSchema(schemaObj.items);
  }

  // Composition
  if (schemaObj.allOf) {
    normalized.allOf = (schemaObj.allOf as unknown[]).map((s: unknown) => normalizeSchema(s));
  }
  if (schemaObj.oneOf) {
    normalized.oneOf = (schemaObj.oneOf as unknown[]).map((s: unknown) => normalizeSchema(s));
  }
  if (schemaObj.anyOf) {
    normalized.anyOf = (schemaObj.anyOf as unknown[]).map((s: unknown) => normalizeSchema(s));
  }
  if (schemaObj.not) {
    normalized.not = normalizeSchema(schemaObj.not);
  }

  // Other properties
  if (schemaObj.discriminator) normalized.discriminator = schemaObj.discriminator as Schema['discriminator'];
  if (schemaObj.xml) normalized.xml = schemaObj.xml as Schema['xml'];
  if (schemaObj.externalDocs) normalized.externalDocs = schemaObj.externalDocs as Schema['externalDocs'];
  
  return normalized;
}

/**
 * Normalize paths object
 */
function normalizePaths(paths: Record<string, unknown>, version: string): Record<string, PathItem> {
  const normalized: Record<string, PathItem> = {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (pathItem && typeof pathItem === 'object') {
      normalized[path] = normalizePathItem(pathItem as Record<string, unknown>, version) as PathItem;
    }
  }
  
  return normalized;
}

/**
 * Normalize path item
 */
function normalizePathItem(pathItem: Record<string, unknown>, version: string) {
  const normalized: Record<string, unknown> = {};

  if (pathItem.summary) normalized.summary = pathItem.summary;
  if (pathItem.description) normalized.description = pathItem.description;
  if (pathItem.parameters) normalized.parameters = pathItem.parameters;

  // HTTP methods
  const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
  for (const method of httpMethods) {
    if (pathItem[method]) {
      normalized[method] = normalizeOperation(pathItem[method] as Record<string, unknown>, version);
    }
  }

  return normalized;
}

/**
 * Normalize operation
 */
function normalizeOperation(operation: Record<string, unknown>, version: string) {
  const normalized: Record<string, unknown> = {
    responses: operation.responses || {},
  };

  if (operation.tags) normalized.tags = operation.tags;
  if (operation.summary) normalized.summary = operation.summary;
  if (operation.description) normalized.description = operation.description;
  if (operation.externalDocs) normalized.externalDocs = operation.externalDocs;
  if (operation.operationId) normalized.operationId = operation.operationId;
  if (operation.parameters) normalized.parameters = operation.parameters;
  if (operation.security) normalized.security = operation.security;
  if (operation.servers) normalized.servers = operation.servers;
  if (operation.deprecated !== undefined) normalized.deprecated = operation.deprecated;

  // Version-specific fields
  if (version === '2.0') {
    if (operation.consumes) normalized.consumes = operation.consumes;
    if (operation.produces) normalized.produces = operation.produces;
    if (operation.schemes) normalized.schemes = operation.schemes;
  } else {
    if (operation.requestBody) normalized.requestBody = operation.requestBody;
    if (operation.callbacks) normalized.callbacks = operation.callbacks;
  }

  return normalized;
}

/**
 * Convert Swagger 2.0 servers to OpenAPI 3.x format
 */
function convertSwagger2Servers(spec: Record<string, unknown>) {
  if (!spec.host && !spec.basePath && !spec.schemes) {
    return undefined;
  }

  const schemes = (spec.schemes as string[]) || ['https'];
  const host = (spec.host as string) || 'localhost';
  const basePath = (spec.basePath as string) || '';

  return schemes.map((scheme: string) => ({
    url: `${scheme}://${host}${basePath}`,
  }));
}

/**
 * Convert Swagger 2.0 components to OpenAPI 3.x format
 */
function convertSwagger2Components(spec: Record<string, unknown>) {
  const components: Record<string, unknown> = {};

  if (spec.definitions) {
    components.schemas = normalizeSchemas(spec.definitions as Record<string, unknown>);
  }

  if (spec.parameters) {
    components.parameters = spec.parameters;
  }

  if (spec.responses) {
    components.responses = spec.responses;
  }

  if (spec.securityDefinitions) {
    components.securitySchemes = spec.securityDefinitions;
  }

  return Object.keys(components).length > 0 ? components : undefined;
}

/**
 * Extract endpoints from parsed specification
 */
export function extractEndpointsFromSpec(spec: ParsedSpec): Endpoint[] {
  const endpoints: Endpoint[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE'];

    for (const method of methods) {
      const operation = pathItem[method.toLowerCase() as keyof typeof pathItem];
      if (!operation || typeof operation !== 'object') continue;

      const op = operation as Operation;
      const endpoint: Endpoint = {
        id: `${method.toUpperCase()}_${path}`.replace(/[^a-zA-Z0-9_]/g, '_'),
        method: method as HttpMethod,
        path,
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        tags: op.tags,
        parameters: op.parameters,
        requestBody: op.requestBody,
        responses: op.responses || {},
        security: op.security,
        deprecated: op.deprecated,
        servers: op.servers,
      };

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

/**
 * Validate parsed specification
 */
export function validateSpec(spec: ParsedSpec) {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Validate info
  if (!spec.info) {
    errors.push({
      type: 'validation',
      message: 'Missing required "info" field',
      timestamp: Date.now(),
      recoverable: false,
    });
  } else {
    if (!spec.info.title) {
      warnings.push('API title is missing');
    }
    if (!spec.info.version) {
      warnings.push('API version is missing');
    }
  }

  // Validate paths
  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    errors.push({
      type: 'validation',
      message: 'No paths defined',
      timestamp: Date.now(),
      recoverable: false,
    });
  }

  // Validate endpoints
  const endpoints = extractEndpointsFromSpec(spec);
  if (endpoints.length === 0) {
    warnings.push('No valid endpoints found');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * SpecParser class for test compatibility
 */
export class SpecParser {
  static async parseFromString(content: string) {
    try {
      // Try to detect format first
      const format = this.detectFormat(content);

      // Parse content directly
      let parsedContent: unknown;
      
      if (format === 'json') {
        try {
          parsedContent = JSON.parse(content);
        } catch (error) {
          return {
            success: false,
            error: {
              type: 'parsing',
              message: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: Date.now(),
              recoverable: false,
            },
          };
        }
      } else {
        try {
          parsedContent = yaml.load(content);
        } catch (error) {
          return {
            success: false,
            error: {
              type: 'parsing',
              message: `Invalid YAML format: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: Date.now(),
              recoverable: false,
            },
          };
        }
      }
      
      // Basic validation
      if (!parsedContent || typeof parsedContent !== 'object') {
        return {
          success: false,
          error: {
            type: 'validation',
            message: 'Specification must be a valid object',
            timestamp: Date.now(),
            recoverable: false,
          },
        };
      }
      
      const specDocument = parsedContent as Record<string, unknown>;

      // Validate required fields
      if (!specDocument.info) {
        return {
          success: false,
          error: {
            type: 'validation',
            message: 'Missing required "info" field',
            timestamp: Date.now(),
            recoverable: false,
          },
        };
      }
      
      if (!specDocument.openapi && !specDocument.swagger && !specDocument.version) {
        return {
          success: false,
          error: {
            type: 'validation',
            message: 'Missing OpenAPI version specification',
            timestamp: Date.now(),
            recoverable: false,
          },
        };
      }
      
      // Convert to our internal format - simplified version
      const spec: ParsedSpec = {
        version: (specDocument.openapi || specDocument.version || 'unknown') as ParsedSpec['version'],
        info: (specDocument.info as ParsedSpec['info']) || { title: 'Untitled', version: '1.0.0' },
        paths: (specDocument.paths as ParsedSpec['paths']) || {},
        servers: specDocument.servers as ParsedSpec['servers'],
        components: specDocument.components as ParsedSpec['components'],
        tags: specDocument.tags as ParsedSpec['tags'],
        security: specDocument.security as ParsedSpec['security'],
        externalDocs: specDocument.externalDocs as ParsedSpec['externalDocs'],
      };
      
      return {
        success: true,
        spec,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'parsing',
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          timestamp: Date.now(),
          recoverable: false,
        },
      };
    }
  }

  static async parseFromUrl(url: string, headers?: Record<string, string>) {
    try {
      // Fetch the specification from URL
      const response = await fetch(url, {
        headers: headers || {},
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            type: 'network',
            message: `HTTP ${response.status}: ${response.statusText}`,
            timestamp: Date.now(),
            recoverable: response.status >= 500,
          },
        };
      }

      const content = await response.text();
      
      // Parse the content using parseFromString
      return await this.parseFromString(content);
      
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'network',
          message: error instanceof Error ? error.message : 'Unknown network error',
          timestamp: Date.now(),
          recoverable: false,
        },
      };
    }
  }

  static detectFormat(content: string): string {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'json';
    }
    // Check for YAML indicators
    if (trimmed.includes(': ') || trimmed.includes('- ') || trimmed.includes('---')) {
      return 'yaml';
    }
    // Default to JSON for ambiguous content
    return 'json';
  }

  static validateSpec(spec: unknown) {
    const errors: string[] = [];

    // Basic validation
    if (!spec || typeof spec !== 'object') {
      errors.push('Spec must be an object');
    } else {
      const specObj = spec as Record<string, unknown>;
      // Version validation
      if (specObj.openapi) {
        const openapi = specObj.openapi as string;
        if (!openapi.startsWith('3.')) {
          errors.push('OpenAPI version must be 3.x');
        }
      } else if (specObj.version && (specObj.version as string).startsWith('3.')) {
        // Handle normalized specs that use 'version' instead of 'openapi'
        // This is valid
      } else if (specObj.swagger) {
        if (specObj.swagger !== '2.0') {
          errors.push('Swagger version must be 2.0');
        }
      } else {
        errors.push('Missing OpenAPI or Swagger version');
      }

      // Info validation
      if (!specObj.info) {
        errors.push('Missing required "info" field');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  static getSpecVersion(spec: unknown): string {
    const specObj = spec as Record<string, unknown> | undefined;
    if (specObj?.openapi) {
      const openapi = specObj.openapi as string;
      return openapi.startsWith('3.1') ? '3.1' : '3.0';
    }
    if (specObj?.version && typeof specObj.version === 'string' && specObj.version.startsWith('3.')) {
      return specObj.version.startsWith('3.1') ? '3.1' : '3.0';
    }
    if (specObj?.swagger || specObj?.version === '2.0') {
      return '2.0';
    }
    return 'unknown';
  }
}