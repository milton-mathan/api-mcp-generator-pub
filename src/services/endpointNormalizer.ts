import type { 
  ExtractedEndpoint, 
  Parameter, 
  Response, 
  RequestBody,
  ParsedSpec 
} from '../types';

export interface NormalizationOptions {
  resolveReferences: boolean;
  flattenSchemas: boolean;
  generateExamples: boolean;
  validateSchemas: boolean;
  optimizeForMCP: boolean;
}

export interface NormalizedEndpoint extends ExtractedEndpoint {
  // Resolved schemas
  resolvedParameters: ResolvedParameter[];
  resolvedRequestBody?: ResolvedRequestBody;
  resolvedResponses: Record<string, ResolvedResponse>;

  // MCP-specific optimizations
  mcpToolName: string;
  mcpInputSchema: Record<string, unknown>;
  mcpOutputSchema: Record<string, unknown>;
  mcpDescription: string;

  // Generated examples
  generatedExamples: {
    parameters?: Record<string, unknown>;
    requestBody?: unknown;
    responses?: Record<string, unknown>;
  };

  // Validation info
  validationRules: ValidationRule[];

  // Flattened schema info
  flattenedSchema?: FlattenedSchema;
}

export interface ResolvedParameter extends Parameter {
  resolvedSchema?: ResolvedSchema;
  generatedExample?: unknown;
  validationRules: ValidationRule[];
}

export interface ResolvedRequestBody extends RequestBody {
  resolvedContent: Record<string, ResolvedMediaType>;
  primaryContentType: string;
  generatedExample?: unknown;
}

export interface ResolvedResponse extends Response {
  resolvedContent?: Record<string, ResolvedMediaType>;
  primaryContentType?: string;
  generatedExample?: unknown;
}

export interface ResolvedMediaType {
  schema?: ResolvedSchema;
  example?: unknown;
  examples?: Record<string, unknown>;
}

export interface ResolvedSchema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, ResolvedSchema>;
  items?: ResolvedSchema;
  required?: string[];
  enum?: unknown[];
  example?: unknown;

  // Resolved references
  originalRef?: string;
  resolvedFrom?: string;

  // Validation info
  constraints: SchemaConstraints;

  // Type information
  tsType?: string;
  pythonType?: string;
}

export interface SchemaConstraints {
  required: boolean;
  nullable: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface FlattenedSchema {
  fields: FlattenedField[];
  complexity: number;
  depth: number;
  circularRefs: string[];
}

export interface FlattenedField {
  path: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: unknown;
  constraints: SchemaConstraints;
}

const defaultOptions: NormalizationOptions = {
  resolveReferences: true,
  flattenSchemas: true,
  generateExamples: true,
  validateSchemas: true,
  optimizeForMCP: true,
};

/**
 * Normalize endpoints with advanced processing
 */
export function normalizeEndpoints(
  endpoints: ExtractedEndpoint[],
  spec: ParsedSpec,
  options: Partial<NormalizationOptions> = {}
): NormalizedEndpoint[] {
  const opts = { ...defaultOptions, ...options };
  const referenceResolver = new ReferenceResolver(spec);
  
  return endpoints.map(endpoint => 
    normalizeEndpoint(endpoint, spec, referenceResolver, opts)
  );
}

/**
 * Normalize a single endpoint
 */
function normalizeEndpoint(
  endpoint: ExtractedEndpoint,
  spec: ParsedSpec,
  resolver: ReferenceResolver,
  options: NormalizationOptions
): NormalizedEndpoint {
  // Resolve parameters
  const resolvedParameters = endpoint.parameters?.map(param => 
    resolveParameter(param, resolver, options)
  ) || [];

  // Resolve request body
  const resolvedRequestBody = endpoint.requestBody 
    ? resolveRequestBody(endpoint.requestBody, resolver, options)
    : undefined;

  // Resolve responses
  const resolvedResponses: Record<string, ResolvedResponse> = {};
  for (const [statusCode, response] of Object.entries(endpoint.responses)) {
    resolvedResponses[statusCode] = resolveResponse(response, resolver, options);
  }

  // Generate MCP-specific data
  const mcpData = options.optimizeForMCP 
    ? generateMCPData(endpoint, resolvedParameters, resolvedRequestBody, resolvedResponses)
    : {
        mcpToolName: endpoint.operationId || endpoint.id,
        mcpInputSchema: {},
        mcpOutputSchema: {},
        mcpDescription: endpoint.summary || endpoint.description || '',
      };

  // Generate examples
  const generatedExamples = options.generateExamples
    ? generateExamples(resolvedParameters, resolvedRequestBody, resolvedResponses)
    : {};

  // Extract validation rules
  const validationRules = options.validateSchemas
    ? extractValidationRules(resolvedParameters, resolvedRequestBody)
    : [];

  // Flatten schema if requested
  const flattenedSchema = options.flattenSchemas
    ? flattenEndpointSchema(resolvedParameters, resolvedRequestBody, resolvedResponses)
    : undefined;

  return {
    ...endpoint,
    resolvedParameters,
    resolvedRequestBody,
    resolvedResponses,
    ...mcpData,
    generatedExamples,
    validationRules,
    flattenedSchema,
  };
}

/**
 * Reference resolver class
 */
class ReferenceResolver {
  private spec: ParsedSpec;
  private resolvedRefs = new Map<string, unknown>();
  private resolutionStack = new Set<string>();

  constructor(spec: ParsedSpec) {
    this.spec = spec;
  }

  resolve(ref: string): unknown {
    if (this.resolvedRefs.has(ref)) {
      return this.resolvedRefs.get(ref);
    }

    if (this.resolutionStack.has(ref)) {
      // Circular reference detected
      return { type: 'object', description: `Circular reference to ${ref}` };
    }

    this.resolutionStack.add(ref);

    try {
      const resolved = this.resolveReference(ref);
      this.resolvedRefs.set(ref, resolved);
      return resolved;
    } finally {
      this.resolutionStack.delete(ref);
    }
  }

  private resolveReference(ref: string): unknown {
    if (!ref.startsWith('#/')) {
      return null; // External references not supported
    }

    const path = ref.substring(2).split('/');
    let current: unknown = this.spec;

    for (const segment of path) {
      if (!current || typeof current !== 'object') {
        return null;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }
}

/**
 * Resolve parameter with schema resolution
 */
function resolveParameter(
  param: Parameter,
  resolver: ReferenceResolver,
  options: NormalizationOptions
): ResolvedParameter {
  const resolvedSchema = param.schema 
    ? resolveSchema(param.schema, resolver, options)
    : undefined;

  const validationRules = extractParameterValidationRules(param);
  const generatedExample = options.generateExamples && resolvedSchema
    ? generateSchemaExample(resolvedSchema)
    : undefined;

  return {
    ...param,
    resolvedSchema,
    generatedExample,
    validationRules,
  };
}

/**
 * Resolve request body with content resolution
 */
function resolveRequestBody(
  requestBody: RequestBody,
  resolver: ReferenceResolver,
  options: NormalizationOptions
): ResolvedRequestBody {
  const resolvedContent: Record<string, ResolvedMediaType> = {};
  let primaryContentType = 'application/json';

  for (const [contentType, mediaType] of Object.entries(requestBody.content)) {
    const mediaTypeObj = mediaType as Record<string, unknown>;
    resolvedContent[contentType] = {
      schema: mediaTypeObj.schema
        ? resolveSchema(mediaTypeObj.schema, resolver, options)
        : undefined,
      example: mediaTypeObj.example,
      examples: mediaTypeObj.examples as Record<string, unknown> | undefined,
    };

    // Determine primary content type
    if (contentType.includes('json')) {
      primaryContentType = contentType;
    }
  }

  const generatedExample = options.generateExamples && resolvedContent[primaryContentType]?.schema
    ? generateSchemaExample(resolvedContent[primaryContentType].schema!)
    : undefined;

  return {
    ...requestBody,
    resolvedContent,
    primaryContentType,
    generatedExample,
  };
}

/**
 * Resolve response with content resolution
 */
function resolveResponse(
  response: Response,
  resolver: ReferenceResolver,
  options: NormalizationOptions
): ResolvedResponse {
  let resolvedContent: Record<string, ResolvedMediaType> | undefined;
  let primaryContentType: string | undefined;

  if (response.content) {
    resolvedContent = {};
    primaryContentType = 'application/json';

    for (const [contentType, mediaType] of Object.entries(response.content)) {
      const mediaTypeObj = mediaType as Record<string, unknown>;
      resolvedContent[contentType] = {
        schema: mediaTypeObj.schema
          ? resolveSchema(mediaTypeObj.schema, resolver, options)
          : undefined,
        example: mediaTypeObj.example,
        examples: mediaTypeObj.examples as Record<string, unknown> | undefined,
      };

      if (contentType.includes('json')) {
        primaryContentType = contentType;
      }
    }
  }

  const generatedExample = options.generateExamples && 
    resolvedContent && 
    primaryContentType && 
    resolvedContent[primaryContentType]?.schema
    ? generateSchemaExample(resolvedContent[primaryContentType].schema!)
    : undefined;

  return {
    ...response,
    resolvedContent,
    primaryContentType,
    generatedExample,
  };
}

/**
 * Resolve schema with reference resolution
 */
function resolveSchema(
  schema: unknown,
  resolver: ReferenceResolver,
  options: NormalizationOptions,
  depth = 0
): ResolvedSchema {
  const schemaObj = schema as Record<string, unknown>;
  if (depth > 10) {
    return { type: 'object', description: 'Max depth reached', constraints: getDefaultConstraints() };
  }

  // Handle $ref
  if (schemaObj.$ref) {
    const resolved = resolver.resolve(schemaObj.$ref as string);
    if (resolved) {
      const resolvedSchema = resolveSchema(resolved, resolver, options, depth + 1);
      resolvedSchema.originalRef = schemaObj.$ref as string;
      return resolvedSchema;
    }
  }

  const resolved: ResolvedSchema = {
    type: schemaObj.type as string | undefined,
    format: schemaObj.format as string | undefined,
    description: schemaObj.description as string | undefined,
    required: schemaObj.required as string[] | undefined,
    enum: schemaObj.enum as unknown[] | undefined,
    example: schemaObj.example,
    constraints: extractSchemaConstraints(schemaObj),
    tsType: generateTypeScriptType(schemaObj),
    pythonType: generatePythonType(schemaObj),
  };

  // Handle object properties
  if (schemaObj.properties) {
    resolved.properties = {};
    for (const [propName, propSchema] of Object.entries(schemaObj.properties as Record<string, unknown>)) {
      resolved.properties[propName] = resolveSchema(propSchema, resolver, options, depth + 1);
    }
  }

  // Handle array items
  if (schemaObj.items) {
    resolved.items = resolveSchema(schemaObj.items, resolver, options, depth + 1);
  }

  return resolved;
}

/**
 * Extract schema constraints
 */
function extractSchemaConstraints(schema: Record<string, unknown>): SchemaConstraints {
  return {
    required: false, // Will be set by parent context
    nullable: (schema.nullable as boolean) || false,
    minimum: schema.minimum as number | undefined,
    maximum: schema.maximum as number | undefined,
    minLength: schema.minLength as number | undefined,
    maxLength: schema.maxLength as number | undefined,
    pattern: schema.pattern as string | undefined,
    minItems: schema.minItems as number | undefined,
    maxItems: schema.maxItems as number | undefined,
    uniqueItems: schema.uniqueItems as boolean | undefined,
  };
}

/**
 * Get default constraints
 */
function getDefaultConstraints(): SchemaConstraints {
  return {
    required: false,
    nullable: false,
  };
}

/**
 * Generate MCP-specific data
 */
function generateMCPData(
  endpoint: ExtractedEndpoint,
  parameters: ResolvedParameter[],
  requestBody?: ResolvedRequestBody,
  responses?: Record<string, ResolvedResponse>
) {
  // Generate MCP tool name
  const mcpToolName = generateMCPToolName(endpoint);

  // Generate input schema for MCP
  const mcpInputSchema = generateMCPInputSchema(parameters, requestBody);

  // Generate output schema for MCP
  const mcpOutputSchema = generateMCPOutputSchema(responses);

  // Generate description
  const mcpDescription = generateMCPDescription(endpoint);

  return {
    mcpToolName,
    mcpInputSchema,
    mcpOutputSchema,
    mcpDescription,
  };
}

/**
 * Generate MCP tool name
 */
function generateMCPToolName(endpoint: ExtractedEndpoint): string {
  if (endpoint.operationId) {
    return endpoint.operationId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  // Generate from method and path
  const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith('{'));
  const name = [endpoint.method.toLowerCase(), ...pathParts].join('_');
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/**
 * Generate MCP input schema
 */
function generateMCPInputSchema(
  parameters: ResolvedParameter[],
  requestBody?: ResolvedRequestBody
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  // Add parameters
  for (const param of parameters) {
    if (param.resolvedSchema) {
      properties[param.name] = convertToJSONSchema(param.resolvedSchema);
      if (param.required) {
        required.push(param.name);
      }
    }
  }

  // Add request body
  if (requestBody?.resolvedContent) {
    const primaryContent = requestBody.resolvedContent[requestBody.primaryContentType];
    if (primaryContent?.schema) {
      properties.body = convertToJSONSchema(primaryContent.schema);
      if (requestBody.required) {
        required.push('body');
      }
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Generate MCP output schema
 */
function generateMCPOutputSchema(responses?: Record<string, ResolvedResponse>): Record<string, unknown> {
  if (!responses) {
    return { type: 'object' };
  }

  // Find the primary success response
  const successResponse = responses['200'] || responses['201'] || responses['default'];
  if (!successResponse?.resolvedContent) {
    return { type: 'object' };
  }

  const primaryContent = successResponse.resolvedContent[successResponse.primaryContentType || 'application/json'];
  if (primaryContent?.schema) {
    return convertToJSONSchema(primaryContent.schema);
  }

  return { type: 'object' };
}

/**
 * Generate MCP description
 */
function generateMCPDescription(endpoint: ExtractedEndpoint): string {
  const parts = [];
  
  if (endpoint.summary) {
    parts.push(endpoint.summary);
  }
  
  if (endpoint.description && endpoint.description !== endpoint.summary) {
    parts.push(endpoint.description);
  }
  
  parts.push(`${endpoint.method} ${endpoint.path}`);
  
  return parts.join('. ');
}

/**
 * Convert resolved schema to JSON Schema
 */
function convertToJSONSchema(schema: ResolvedSchema): Record<string, unknown> {
  const jsonSchema: Record<string, unknown> = {
    type: schema.type,
    description: schema.description,
  };

  if (schema.format) jsonSchema.format = schema.format;
  if (schema.enum) jsonSchema.enum = schema.enum;
  if (schema.example !== undefined) jsonSchema.example = schema.example;

  // Add constraints
  const constraints = schema.constraints;
  if (constraints.minimum !== undefined) jsonSchema.minimum = constraints.minimum;
  if (constraints.maximum !== undefined) jsonSchema.maximum = constraints.maximum;
  if (constraints.minLength !== undefined) jsonSchema.minLength = constraints.minLength;
  if (constraints.maxLength !== undefined) jsonSchema.maxLength = constraints.maxLength;
  if (constraints.pattern) jsonSchema.pattern = constraints.pattern;
  if (constraints.minItems !== undefined) jsonSchema.minItems = constraints.minItems;
  if (constraints.maxItems !== undefined) jsonSchema.maxItems = constraints.maxItems;

  // Handle object properties
  if (schema.properties) {
    const properties: Record<string, unknown> = {};
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      properties[propName] = convertToJSONSchema(propSchema);
    }
    jsonSchema.properties = properties;
    if (schema.required) {
      jsonSchema.required = schema.required;
    }
  }

  // Handle array items
  if (schema.items) {
    jsonSchema.items = convertToJSONSchema(schema.items);
  }

  return jsonSchema;
}

/**
 * Generate examples for endpoint
 */
function generateExamples(
  parameters: ResolvedParameter[],
  requestBody?: ResolvedRequestBody,
  responses?: Record<string, ResolvedResponse>
): Record<string, unknown> {
  const examples: Record<string, unknown> = {};

  // Generate parameter examples
  if (parameters.length > 0) {
    const parameterExamples: Record<string, unknown> = {};
    for (const param of parameters) {
      if (param.generatedExample !== undefined) {
        parameterExamples[param.name] = param.generatedExample;
      }
    }
    examples.parameters = parameterExamples;
  }

  // Generate request body example
  if (requestBody?.generatedExample !== undefined) {
    examples.requestBody = requestBody.generatedExample;
  }

  // Generate response examples
  if (responses) {
    const responseExamples: Record<string, unknown> = {};
    for (const [statusCode, response] of Object.entries(responses)) {
      if (response.generatedExample !== undefined) {
        responseExamples[statusCode] = response.generatedExample;
      }
    }
    examples.responses = responseExamples;
  }

  return examples;
}

/**
 * Generate example from schema
 */
function generateSchemaExample(schema: ResolvedSchema): unknown {
  if (schema.example !== undefined) {
    return schema.example;
  }

  switch (schema.type) {
    case 'string':
      if (schema.enum) return schema.enum[0];
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'date') return '2023-01-01';
      if (schema.format === 'date-time') return '2023-01-01T00:00:00Z';
      return 'string';

    case 'number':
    case 'integer':
      if (schema.enum) return schema.enum[0];
      return schema.constraints.minimum || 0;

    case 'boolean':
      return true;

    case 'array':
      if (schema.items) {
        return [generateSchemaExample(schema.items)];
      }
      return [];

    case 'object':
      if (schema.properties) {
        const example: Record<string, unknown> = {};
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          example[propName] = generateSchemaExample(propSchema);
        }
        return example;
      }
      return {};

    default:
      return null;
  }
}

/**
 * Extract validation rules
 */
function extractValidationRules(
  parameters: ResolvedParameter[],
  requestBody?: ResolvedRequestBody
): ValidationRule[] {
  const rules: ValidationRule[] = [];

  // Parameter validation rules
  for (const param of parameters) {
    rules.push(...extractParameterValidationRules(param));
  }

  // Request body validation rules
  if (requestBody) {
    rules.push(...extractRequestBodyValidationRules(requestBody));
  }

  return rules;
}

/**
 * Extract parameter validation rules
 */
function extractParameterValidationRules(param: Parameter): ValidationRule[] {
  const rules: ValidationRule[] = [];

  if (param.required) {
    rules.push({
      field: param.name,
      rule: 'required',
      message: `${param.name} is required`,
      severity: 'error'
    });
  }

  if (param.schema) {
    const schema = param.schema;
    if (schema.minLength !== undefined) {
      rules.push({
        field: param.name,
        rule: `minLength:${schema.minLength}`,
        message: `${param.name} must be at least ${schema.minLength} characters`,
        severity: 'error'
      });
    }
    if (schema.maxLength !== undefined) {
      rules.push({
        field: param.name,
        rule: `maxLength:${schema.maxLength}`,
        message: `${param.name} must be at most ${schema.maxLength} characters`,
        severity: 'error'
      });
    }
    if (schema.minimum !== undefined) {
      rules.push({
        field: param.name,
        rule: `minimum:${schema.minimum}`,
        message: `${param.name} must be at least ${schema.minimum}`,
        severity: 'error'
      });
    }
    if (schema.maximum !== undefined) {
      rules.push({
        field: param.name,
        rule: `maximum:${schema.maximum}`,
        message: `${param.name} must be at most ${schema.maximum}`,
        severity: 'error'
      });
    }
    if (schema.pattern) {
      rules.push({
        field: param.name,
        rule: `pattern:${schema.pattern}`,
        message: `${param.name} must match pattern ${schema.pattern}`,
        severity: 'error'
      });
    }
  }

  return rules;
}

/**
 * Extract request body validation rules
 */
function extractRequestBodyValidationRules(requestBody: ResolvedRequestBody): ValidationRule[] {
  const rules: ValidationRule[] = [];

  if (requestBody.required) {
    rules.push({
      field: 'body',
      rule: 'required',
      message: 'Request body is required',
      severity: 'error',
    });
  }

  return rules;
}

/**
 * Flatten endpoint schema
 */
function flattenEndpointSchema(
  parameters: ResolvedParameter[],
  requestBody?: ResolvedRequestBody,
  _responses?: Record<string, ResolvedResponse>
): FlattenedSchema {
  const fields: FlattenedField[] = [];
  let maxDepth = 0;
  const circularRefs: string[] = [];

  // Flatten parameters
  for (const param of parameters) {
    if (param.resolvedSchema) {
      const paramFields = flattenSchema(param.resolvedSchema, param.name, 0);
      fields.push(...paramFields);
      maxDepth = Math.max(maxDepth, getSchemaDepth(param.resolvedSchema));
    }
  }

  // Flatten request body
  if (requestBody?.resolvedContent) {
    const primaryContent = requestBody.resolvedContent[requestBody.primaryContentType];
    if (primaryContent?.schema) {
      const bodyFields = flattenSchema(primaryContent.schema, 'body', 0);
      fields.push(...bodyFields);
      maxDepth = Math.max(maxDepth, getSchemaDepth(primaryContent.schema));
    }
  }

  return {
    fields,
    complexity: fields.length,
    depth: maxDepth,
    circularRefs,
  };
}

/**
 * Flatten schema to fields
 */
function flattenSchema(schema: ResolvedSchema, basePath: string, depth: number): FlattenedField[] {
  const fields: FlattenedField[] = [];

  if (depth > 5) return fields; // Prevent infinite recursion

  if (schema.type === 'object' && schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const fieldPath = basePath ? `${basePath}.${propName}` : propName;
      
      if (propSchema.type === 'object' && propSchema.properties) {
        fields.push(...flattenSchema(propSchema, fieldPath, depth + 1));
      } else {
        fields.push({
          path: fieldPath,
          name: propName,
          type: propSchema.type || 'unknown',
          required: schema.required?.includes(propName) || false,
          description: propSchema.description,
          example: propSchema.example,
          constraints: propSchema.constraints,
        });
      }
    }
  } else {
    fields.push({
      path: basePath,
      name: basePath.split('.').pop() || basePath,
      type: schema.type || 'unknown',
      required: schema.constraints.required,
      description: schema.description,
      example: schema.example,
      constraints: schema.constraints,
    });
  }

  return fields;
}

/**
 * Get schema depth
 */
function getSchemaDepth(schema: ResolvedSchema, visited = new Set<ResolvedSchema>()): number {
  if (visited.has(schema)) return 0;
  visited.add(schema);

  let maxDepth = 0;

  if (schema.properties) {
    for (const propSchema of Object.values(schema.properties)) {
      maxDepth = Math.max(maxDepth, getSchemaDepth(propSchema, visited) + 1);
    }
  }

  if (schema.items) {
    maxDepth = Math.max(maxDepth, getSchemaDepth(schema.items, visited) + 1);
  }

  return maxDepth;
}

/**
 * Generate TypeScript type
 */
function generateTypeScriptType(schema: Record<string, unknown>): string {
  switch (schema.type) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'array': return `${generateTypeScriptType((schema.items as Record<string, unknown>) || { type: 'unknown' })}[]`;
    case 'object': return 'object';
    default: return 'unknown';
  }
}

/**
 * Generate Python type
 */
function generatePythonType(schema: Record<string, unknown>): string {
  switch (schema.type) {
    case 'string': return 'str';
    case 'number': return 'float';
    case 'integer': return 'int';
    case 'boolean': return 'bool';
    case 'array': return `List[${generatePythonType((schema.items as Record<string, unknown>) || { type: 'unknown' })}]`;
    case 'object': return 'Dict[str, Any]';
    default: return 'Any';
  }
}