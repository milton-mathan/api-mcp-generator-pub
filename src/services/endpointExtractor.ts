import type {
  ParsedSpec,
  Endpoint,
  HttpMethod,
  Parameter,
  Response,
  RequestBody,
  Schema,
  SecurityRequirement,
  MediaType,
  Header,
  Link
} from '../types';

/** Keys on PathItem that hold an Operation (i.e. everything but `parameters`). */
type OperationKey = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

// Re-export types for other modules
export type { Parameter, Schema };

export interface EndpointExtractionOptions {
  includeDeprecated: boolean;
  includeInternal: boolean;
  normalizeParameters: boolean;
  resolveReferences: boolean;
  extractExamples: boolean;
  generateOperationIds: boolean;
}

export interface ExtractedEndpoint extends Endpoint {
  // Enhanced metadata
  pathParameters: Parameter[];
  queryParameters: Parameter[];
  headerParameters: Parameter[];
  cookieParameters: Parameter[];
  hasRequestBody: boolean;
  hasExamples: boolean;
  responseStatusCodes: string[];
  securitySchemes: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  
  // Normalized data
  normalizedPath: string;
  pathTemplate: string;
  operationKey: string;
  
  // Analysis data
  estimatedResponseSize: 'small' | 'medium' | 'large';
  cacheable: boolean;
  idempotent: boolean;
  safe: boolean;
}

const defaultOptions: EndpointExtractionOptions = {
  includeDeprecated: true,
  includeInternal: true,
  normalizeParameters: true,
  resolveReferences: false,
  extractExamples: true,
  generateOperationIds: false,
};

/**
 * Extract and normalize endpoints from OpenAPI specification
 */
export function extractEndpoints(
  spec: ParsedSpec, 
  options: Partial<EndpointExtractionOptions> = {}
): ExtractedEndpoint[] {
  const opts = { ...defaultOptions, ...options };
  const endpoints: ExtractedEndpoint[] = [];
  const operationIds = new Set<string>();

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    // Extract path-level parameters
    const pathLevelParameters = pathItem.parameters || [];

    const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE'];

    for (const method of httpMethods) {
      const operationValue = pathItem[method.toLowerCase() as OperationKey];
      if (!operationValue || typeof operationValue !== 'object') continue;

      const operation = operationValue as unknown as Record<string, unknown>;

      // Skip deprecated operations if not included
      if (!opts.includeDeprecated && operation.deprecated) continue;

      // Skip internal operations if not included
      if (!opts.includeInternal && isInternalOperation(operation)) continue;

      const endpoint = extractSingleEndpoint(
        path,
        method,
        operation,
        pathLevelParameters,
        spec,
        opts,
        operationIds
      );

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

/**
 * Extract a single endpoint with full normalization
 */
function extractSingleEndpoint(
  path: string,
  method: HttpMethod,
  operation: Record<string, unknown>,
  pathLevelParameters: Parameter[],
  spec: ParsedSpec,
  options: EndpointExtractionOptions,
  operationIds: Set<string>
): ExtractedEndpoint {
  // Generate unique operation ID if needed
  let operationId = operation.operationId as string | undefined;
  if (!operationId && options.generateOperationIds) {
    operationId = generateOperationId(method, path, operationIds);
  }

  // Combine path-level and operation-level parameters
  const allParameters = [
    ...pathLevelParameters,
    ...((operation.parameters as Parameter[]) || [])
  ];

  // Normalize parameters
  const normalizedParameters = options.normalizeParameters 
    ? normalizeParameters(allParameters)
    : allParameters;

  // Categorize parameters
  const pathParameters = normalizedParameters.filter(p => p.in === 'path');
  const queryParameters = normalizedParameters.filter(p => p.in === 'query');
  const headerParameters = normalizedParameters.filter(p => p.in === 'header');
  const cookieParameters = normalizedParameters.filter(p => p.in === 'cookie');

  // Analyze request body
  const normalizedRequestBody = resolveRequestBody(operation, normalizedParameters);
  const hasRequestBody = !!normalizedRequestBody;

  // Normalize responses
  const normalizedResponses = normalizeResponses((operation.responses as Record<string, unknown>) || {});
  const responseStatusCodes = Object.keys(normalizedResponses);

  // Extract security schemes
  const securitySchemes = extractSecuritySchemes(operation.security as SecurityRequirement[] | undefined, spec.security, spec.components?.securitySchemes);

  // Analyze complexity
  const complexity = analyzeEndpointComplexity(
    normalizedParameters,
    normalizedRequestBody,
    normalizedResponses
  );

  // Generate normalized path and template
  const normalizedPath = normalizePath(path);
  const pathTemplate = generatePathTemplate(path);
  const operationKey = `${method.toLowerCase()}_${normalizedPath.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Analyze HTTP method characteristics
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  const idempotent = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method);
  const cacheable = ['GET', 'HEAD'].includes(method) && !hasAuthenticationRequired(operation.security as SecurityRequirement[] | undefined);

  // Estimate response size
  const estimatedResponseSize = estimateResponseSize(normalizedResponses);

  // Check for examples
  const hasExamples = options.extractExamples && checkForExamples(
    normalizedParameters,
    normalizedRequestBody,
    normalizedResponses
  );

  const endpoint: ExtractedEndpoint = {
    // Basic endpoint properties
    id: generateEndpointId(method, path),
    method,
    path,
    operationId,
    summary: operation.summary as string | undefined,
    description: operation.description as string | undefined,
    tags: (operation.tags as string[]) || [],
    parameters: normalizedParameters,
    requestBody: normalizedRequestBody,
    responses: normalizedResponses,
    security: operation.security as SecurityRequirement[] | undefined,
    deprecated: (operation.deprecated as boolean) || false,
    servers: operation.servers as ParsedSpec['servers'],

    // Enhanced metadata
    pathParameters,
    queryParameters,
    headerParameters,
    cookieParameters,
    hasRequestBody,
    hasExamples,
    responseStatusCodes,
    securitySchemes,
    complexity,

    // Normalized data
    normalizedPath,
    pathTemplate,
    operationKey,

    // Analysis data
    estimatedResponseSize,
    cacheable,
    idempotent,
    safe,
  };

  return endpoint;
}

/**
 * Generate unique operation ID
 */
export function generateEndpointId(method: string, path: string): string {
  return `${method.toLowerCase()}-${path.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

function generateOperationId(method: HttpMethod, path: string, existingIds: Set<string>): string {
  // Convert path to camelCase operation name
  const pathParts = path.split('/').filter(part => part.length > 0);
  const operationParts = [method.toLowerCase()];

  for (const part of pathParts) {
    if (part.startsWith('{') && part.endsWith('}')) {
      // Parameter - use 'By' prefix
      const paramName = part.slice(1, -1);
      operationParts.push('By', capitalize(paramName));
    } else {
      // Regular path segment
      operationParts.push(capitalize(part));
    }
  }

  let operationId = operationParts.join('');
  let counter = 1;

  // Ensure uniqueness
  while (existingIds.has(operationId)) {
    operationId = `${operationParts.join('')}${counter}`;
    counter++;
  }

  existingIds.add(operationId);
  return operationId;
}

/**
 * Normalize parameters array
 */
function normalizeParameters(parameters: Parameter[]): Parameter[] {
  const normalized: Parameter[] = [];
  const seen = new Map<string, Set<string>>();

  for (const param of parameters) {
    if (!param.name || !param.in) continue;

    // Check for duplicates
    if (!seen.has(param.in)) {
      seen.set(param.in, new Set());
    }
    const namesInLocation = seen.get(param.in)!;
    
    if (namesInLocation.has(param.name)) {
      // Skip duplicate parameter
      continue;
    }
    namesInLocation.add(param.name);

    // Normalize parameter
    const normalizedParam: Parameter = {
      name: param.name,
      in: param.in,
      required: param.required || param.in === 'path', // Path params are always required
      description: param.description,
      deprecated: param.deprecated,
      allowEmptyValue: param.allowEmptyValue,
      style: param.style,
      explode: param.explode,
      allowReserved: param.allowReserved,
      schema: normalizeParameterSchema(param),
      example: param.example,
      examples: param.examples,
    };

    normalized.push(normalizedParam);
  }

  return normalized;
}

/**
 * Resolve a parameter's schema across OpenAPI versions.
 *
 * OpenAPI 3.x nests the type under `schema`. Swagger 2.0 puts `type`, `format`,
 * `enum` and friends directly on the non-body parameter. Without this, every
 * Swagger 2.0 parameter loses its type and downstream consumers fall back to
 * string - so an integer path parameter is declared as `str` and rejects the
 * integer the caller supplies.
 */
function normalizeParameterSchema(param: Parameter): Schema | undefined {
  if (param.schema) {
    return normalizeSchema(param.schema);
  }

  // Swagger 2.0 flat form
  const flat = param as unknown as Record<string, unknown>;
  if (typeof flat.type !== 'string') {
    return undefined;
  }

  return normalizeSchema({
    type: flat.type,
    format: flat.format,
    enum: flat.enum,
    items: flat.items,
    default: flat.default,
  });
}

/**
 * Normalize request body
 */
/**
 * Resolve an operation's request body across OpenAPI versions.
 *
 * OpenAPI 3.x has a first-class `requestBody`. Swagger 2.0 has no such key -
 * the payload is a parameter with `in: "body"`, and form submissions are
 * parameters with `in: "formData"`. Checking only `operation.requestBody` makes
 * every Swagger 2.0 POST/PUT/PATCH look bodyless, so the generated tool sends
 * nothing and the API rejects the call ("405 no data").
 */
function resolveRequestBody(
  operation: Record<string, unknown>,
  parameters: Parameter[]
): RequestBody | undefined {
  // OpenAPI 3.x
  if (operation.requestBody) {
    return normalizeRequestBody(operation.requestBody as Record<string, unknown>);
  }

  const mediaTypes = (operation.consumes as string[] | undefined)?.length
    ? (operation.consumes as string[])
    : ['application/json'];

  // Swagger 2.0: a single `in: body` parameter carries the whole payload.
  const bodyParam = parameters.find((p) => (p.in as string) === 'body');
  if (bodyParam) {
    const content: Record<string, MediaType> = {};
    for (const mediaType of mediaTypes) {
      content[mediaType] = { schema: bodyParam.schema };
    }
    return {
      description: bodyParam.description,
      content,
      required: bodyParam.required ?? false,
    };
  }

  // Swagger 2.0: `in: formData` parameters together form one payload object.
  const formParams = parameters.filter((p) => (p.in as string) === 'formData');
  if (formParams.length > 0) {
    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    for (const param of formParams) {
      properties[param.name] = param.schema ?? { type: 'string' };
      if (param.required) required.push(param.name);
    }
    const formMediaType = mediaTypes.find((m) => m.includes('form') || m.includes('multipart'))
      ?? 'application/x-www-form-urlencoded';
    return {
      content: { [formMediaType]: { schema: { type: 'object', properties, required } } },
      required: required.length > 0,
    };
  }

  return undefined;
}

function normalizeRequestBody(requestBody: Record<string, unknown>): RequestBody {
  return {
    description: requestBody.description as string | undefined,
    content: (requestBody.content as Record<string, MediaType>) || {},
    required: (requestBody.required as boolean) || false,
  };
}

/**
 * Normalize responses object
 */
function normalizeResponses(responses: Record<string, unknown>): Record<string, Response> {
  const normalized: Record<string, Response> = {};

  for (const [statusCode, response] of Object.entries(responses)) {
    if (!response) continue;

    const responseObj = response as Record<string, unknown>;
    normalized[statusCode] = {
      description: (responseObj.description as string) || '',
      headers: responseObj.headers as Record<string, Header> | undefined,
      content: responseObj.content as Record<string, MediaType> | undefined,
      links: responseObj.links as Record<string, Link> | undefined,
    };
  }

  return normalized;
}

/**
 * Normalize schema object
 */
function normalizeSchema(schema: unknown): Schema {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const schemaObj = schema as Record<string, unknown>;
  const normalized: Schema = {};

  // Copy basic properties.
  // '$ref' is included so an unresolved pointer survives instead of
  // normalizing to `{}` - a silently empty schema with nothing to show what
  // was lost. Dereferencing is on by default; this is the fallback.
  const basicProps = [
    '$ref',
    'type', 'format', 'title', 'description', 'default', 'example', 'enum',
    'nullable', 'readOnly', 'writeOnly', 'deprecated', 'multipleOf', 'maximum',
    'exclusiveMaximum', 'minimum', 'exclusiveMinimum', 'maxLength', 'minLength',
    'pattern', 'maxItems', 'minItems', 'uniqueItems', 'maxProperties', 'minProperties',
    'required'
  ];

  for (const prop of basicProps) {
    if (schemaObj[prop] !== undefined) {
      (normalized as Record<string, unknown>)[prop] = schemaObj[prop];
    }
  }

  // Handle complex properties
  if (schemaObj.properties) {
    normalized.properties = {};
    const props = schemaObj.properties as Record<string, unknown>;
    for (const [propName, propSchema] of Object.entries(props)) {
      normalized.properties[propName] = normalizeSchema(propSchema);
    }
  }

  if (schemaObj.items) {
    normalized.items = normalizeSchema(schemaObj.items);
  }

  if (schemaObj.additionalProperties !== undefined) {
    if (typeof schemaObj.additionalProperties === 'boolean') {
      normalized.additionalProperties = schemaObj.additionalProperties;
    } else {
      normalized.additionalProperties = normalizeSchema(schemaObj.additionalProperties);
    }
  }

  // Handle composition
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

  return normalized;
}

/**
 * Extract security schemes used by an endpoint
 */
function extractSecuritySchemes(
  operationSecurity?: SecurityRequirement[],
  globalSecurity?: SecurityRequirement[],
  securitySchemes?: Record<string, unknown>
): string[] {
  const schemes = new Set<string>();
  
  // Check operation-level security first
  const securityToCheck = operationSecurity || globalSecurity || [];
  
  for (const requirement of securityToCheck) {
    for (const schemeName of Object.keys(requirement)) {
      if (securitySchemes && securitySchemes[schemeName]) {
        schemes.add(schemeName);
      }
    }
  }

  return Array.from(schemes);
}

/**
 * Analyze endpoint complexity
 */
export function assessComplexity(endpoint: ExtractedEndpoint): 'simple' | 'moderate' | 'complex' {
  return analyzeEndpointComplexity(
    endpoint.parameters || [],
    endpoint.requestBody,
    endpoint.responses
  );
}

export function normalizeEndpoint(endpoint: Record<string, unknown>): ExtractedEndpoint {
  // Generate proper ID if missing
  const id = (endpoint.id as string) || generateEndpointId(endpoint.method as string, endpoint.path as string);

  // Assess complexity if missing
  const complexity = (endpoint.complexity as 'simple' | 'moderate' | 'complex') || assessComplexity(endpoint as unknown as ExtractedEndpoint);

  // Check for examples if missing
  const hasExamples = endpoint.hasExamples !== undefined
    ? (endpoint.hasExamples as boolean)
    : checkForExamples(
        (endpoint.parameters as Parameter[]) || [],
        endpoint.requestBody as RequestBody | undefined,
        (endpoint.responses as Record<string, Response>) || {}
      );

  return {
    ...(endpoint as unknown as ExtractedEndpoint),
    id,
    complexity,
    hasExamples
  };
}

export function extractResponseExamples(response: Record<string, unknown>): unknown[] {
  const examples: unknown[] = [];

  if (response.content) {
    const content = response.content as Record<string, unknown>;
    for (const mediaType of Object.values(content)) {
      const mediaTypeObj = mediaType as Record<string, unknown>;

      // Check for single example
      if (mediaTypeObj.example) {
        examples.push(mediaTypeObj.example);
      }

      // Check for multiple examples
      if (mediaTypeObj.examples) {
        const examplesObj = mediaTypeObj.examples as Record<string, unknown>;
        examples.push(...Object.values(examplesObj).map((ex: unknown) => {
          const exObj = ex as Record<string, unknown>;
          return exObj.value || ex;
        }));
      }
    }
  }

  return examples;
}

function analyzeEndpointComplexity(
  parameters: Parameter[],
  requestBody?: RequestBody,
  responses?: Record<string, Response>
): 'simple' | 'moderate' | 'complex' {
  let score = 0;

  // Parameter complexity
  const paramArray = Array.isArray(parameters) ? parameters : [];
  score += paramArray.length;
  score += paramArray.filter(p => p.required).length;
  score += paramArray.filter(p => p.schema?.type === 'object').length * 2;

  // Request body complexity
  if (requestBody) {
    score += 2;
    const contentTypes = Object.keys(requestBody.content || {});
    score += contentTypes.length;
  }

  // Response complexity
  if (responses) {
    const responseCount = Object.keys(responses).length;
    score += responseCount;
    
    // Check for complex response schemas
    for (const response of Object.values(responses)) {
      if (response.content) {
        score += Object.keys(response.content).length;
      }
    }
  }

  if (score <= 4) return 'simple';
  if (score <= 8) return 'moderate';
  return 'complex';
}

/**
 * Normalize path for consistent comparison
 */
function normalizePath(path: string): string {
  return path
    .toLowerCase()
    .replace(/\{[^}]+\}/g, '{param}') // Replace all parameters with generic placeholder
    .replace(/\/+/g, '/') // Remove duplicate slashes
    .replace(/\/$/, ''); // Remove trailing slash
}

/**
 * Generate path template for pattern matching
 */
function generatePathTemplate(path: string): string {
  return path.replace(/\{[^}]+\}/g, '*');
}

/**
 * Check if operation is internal (not public API)
 */
function isInternalOperation(operation: Record<string, unknown>): boolean {
  // Check for internal tags
  if (operation.tags) {
    const internalTags = ['internal', 'private', 'admin', 'debug'];
    const tags = operation.tags as string[];
    return tags.some((tag: string) =>
      internalTags.includes(tag.toLowerCase())
    );
  }

  // Check for internal in summary or description
  const summary = (operation.summary as string) || '';
  const description = (operation.description as string) || '';
  const text = `${summary} ${description}`.toLowerCase();
  return text.includes('internal') || text.includes('private');
}

/**
 * Check if authentication is required
 */
function hasAuthenticationRequired(security?: SecurityRequirement[]): boolean {
  return !!(security && security.length > 0);
}

/**
 * Estimate response size based on schema complexity
 */
function estimateResponseSize(responses: Record<string, Response>): 'small' | 'medium' | 'large' {
  let maxComplexity = 0;

  for (const response of Object.values(responses)) {
    if (response.content) {
      for (const mediaType of Object.values(response.content)) {
        const schema = (mediaType as MediaType).schema;
        if (schema) {
          const complexity = calculateSchemaComplexity(schema);
          maxComplexity = Math.max(maxComplexity, complexity);
        }
      }
    }
  }

  if (maxComplexity <= 5) return 'small';
  if (maxComplexity <= 20) return 'medium';
  return 'large';
}

/**
 * Calculate schema complexity score
 */
function calculateSchemaComplexity(schema: unknown): number {
  if (!schema || typeof schema !== 'object') return 0;

  const schemaObj = schema as Record<string, unknown>;
  let complexity = 1;

  if (schemaObj.properties) {
    const props = schemaObj.properties as Record<string, unknown>;
    complexity += Object.keys(props).length;
    for (const propSchema of Object.values(props)) {
      complexity += calculateSchemaComplexity(propSchema) * 0.5;
    }
  }

  if (schemaObj.items) {
    complexity += calculateSchemaComplexity(schemaObj.items) * 0.8;
  }

  if (schemaObj.allOf || schemaObj.oneOf || schemaObj.anyOf) {
    const compositions = (schemaObj.allOf || schemaObj.oneOf || schemaObj.anyOf || []) as unknown[];
    for (const compositionSchema of compositions) {
      complexity += calculateSchemaComplexity(compositionSchema) * 0.7;
    }
  }

  return complexity;
}

/**
 * Check for examples in endpoint
 */
function checkForExamples(
  parameters: Parameter[],
  requestBody?: RequestBody,
  responses?: Record<string, Response>
): boolean {
  // Check parameter examples
  for (const param of parameters) {
    if (param.example || param.examples) {
      return true;
    }
  }

  // Check request body examples
  if (requestBody?.content) {
    const content = requestBody.content as Record<string, unknown>;
    for (const mediaType of Object.values(content)) {
      const mediaTypeObj = mediaType as Record<string, unknown>;
      if (mediaTypeObj.example || mediaTypeObj.examples) {
        return true;
      }
    }
  }

  // Check response examples
  if (responses) {
    for (const response of Object.values(responses)) {
      if (response.content) {
        const content = response.content as Record<string, unknown>;
        for (const mediaType of Object.values(content)) {
          const mediaTypeObj = mediaType as Record<string, unknown>;
          if (mediaTypeObj.example || mediaTypeObj.examples) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Group endpoints by various criteria
 */
export function groupEndpoints(endpoints: ExtractedEndpoint[]) {
  return {
    byMethod: groupBy(endpoints, 'method'),
    byTag: groupByTags(endpoints),
    byComplexity: groupBy(endpoints, 'complexity'),
    byPath: groupByPath(endpoints),
    bySecurity: groupBySecurity(endpoints),
    byResponseSize: groupBy(endpoints, 'estimatedResponseSize'),
  };
}

/**
 * Group endpoints by a property
 */
function groupBy<T, K extends keyof T>(items: T[], key: K): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  
  for (const item of items) {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  }
  
  return groups;
}

/**
 * Group endpoints by tags (handling multiple tags per endpoint)
 */
function groupByTags(endpoints: ExtractedEndpoint[]): Record<string, ExtractedEndpoint[]> {
  const groups: Record<string, ExtractedEndpoint[]> = {};
  
  for (const endpoint of endpoints) {
    const tags = (endpoint.tags?.length || 0) > 0 ? endpoint.tags! : ['untagged'];
    
    for (const tag of tags) {
      if (!groups[tag]) {
        groups[tag] = [];
      }
      groups[tag].push(endpoint);
    }
  }
  
  return groups;
}

/**
 * Group endpoints by path hierarchy
 */
function groupByPath(endpoints: ExtractedEndpoint[]): Record<string, ExtractedEndpoint[]> {
  const groups: Record<string, ExtractedEndpoint[]> = {};
  
  for (const endpoint of endpoints) {
    const pathParts = endpoint.path.split('/').filter(part => part.length > 0);
    const rootPath = pathParts.length > 0 ? `/${pathParts[0]}` : '/';
    
    if (!groups[rootPath]) {
      groups[rootPath] = [];
    }
    groups[rootPath].push(endpoint);
  }
  
  return groups;
}

/**
 * Group endpoints by security requirements
 */
function groupBySecurity(endpoints: ExtractedEndpoint[]): Record<string, ExtractedEndpoint[]> {
  const groups: Record<string, ExtractedEndpoint[]> = {
    'authenticated': [],
    'unauthenticated': [],
  };
  
  for (const endpoint of endpoints) {
    const hasAuth = endpoint.security && endpoint.security.length > 0;
    const groupKey = hasAuth ? 'authenticated' : 'unauthenticated';
    groups[groupKey].push(endpoint);
  }
  
  return groups;
}