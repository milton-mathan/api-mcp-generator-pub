import type { ParsedSpec, Endpoint, Schema, HttpMethod } from '../types';

export interface SpecAnalysis {
  summary: {
    version: string;
    title: string;
    description?: string;
    endpointCount: number;
    schemaCount: number;
    tagCount: number;
    securitySchemeCount: number;
  };
  endpoints: {
    byMethod: Record<string, number>;
    byTag: Record<string, number>;
    withAuth: number;
    deprecated: number;
    withExamples: number;
  };
  schemas: {
    complexity: 'simple' | 'moderate' | 'complex';
    types: Record<string, number>;
    withValidation: number;
    circular: string[];
  };
  security: {
    schemes: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
    globalSecurity: boolean;
    endpointsWithSecurity: number;
  };
  quality: {
    score: number;
    issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      path?: string;
    }>;
    recommendations: string[];
  };
}

/**
 * Analyze parsed OpenAPI specification
 */
export function analyzeSpec(spec: ParsedSpec): SpecAnalysis {
  const endpoints = extractEndpoints(spec);
  
  return {
    summary: analyzeSummary(spec, endpoints),
    endpoints: analyzeEndpoints(endpoints),
    schemas: analyzeSchemas(spec.components?.schemas || {}),
    security: analyzeSecurity(spec, endpoints),
    quality: analyzeQuality(spec, endpoints),
  };
}

/**
 * Analyze specification summary
 */
function analyzeSummary(spec: ParsedSpec, endpoints: Endpoint[]) {
  return {
    version: spec.version,
    title: spec.info.title,
    description: spec.info.description,
    endpointCount: endpoints.length,
    schemaCount: spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0,
    tagCount: spec.tags?.length || 0,
    securitySchemeCount: spec.components?.securitySchemes ? Object.keys(spec.components.securitySchemes).length : 0,
  };
}

/**
 * Analyze endpoints
 */
function analyzeEndpoints(endpoints: Endpoint[]) {
  const byMethod: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  let withAuth = 0;
  let deprecated = 0;
  let withExamples = 0;

  for (const endpoint of endpoints) {
    // Count by method
    byMethod[endpoint.method] = (byMethod[endpoint.method] || 0) + 1;

    // Count by tag
    if (endpoint.tags) {
      for (const tag of endpoint.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    } else {
      byTag['untagged'] = (byTag['untagged'] || 0) + 1;
    }

    // Count with authentication
    if (endpoint.security && endpoint.security.length > 0) {
      withAuth++;
    }

    // Count deprecated
    if (endpoint.deprecated) {
      deprecated++;
    }

    // Count with examples
    if (hasExamples(endpoint)) {
      withExamples++;
    }
  }

  return {
    byMethod,
    byTag,
    withAuth,
    deprecated,
    withExamples,
  };
}

/**
 * Analyze schemas
 */
function analyzeSchemas(schemas: Record<string, Schema>) {
  const types: Record<string, number> = {};
  let withValidation = 0;
  const circular: string[] = [];
  
  for (const [name, schema] of Object.entries(schemas)) {
    // Count by type
    const type = schema.type || 'object';
    types[type] = (types[type] || 0) + 1;

    // Count with validation
    if (hasValidationRules(schema)) {
      withValidation++;
    }

    // Check for circular references (simplified)
    if (hasCircularReference(name, schema, schemas)) {
      circular.push(name);
    }
  }

  // Determine complexity
  const totalSchemas = Object.keys(schemas).length;
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  
  if (totalSchemas > 50 || circular.length > 0) {
    complexity = 'complex';
  } else if (totalSchemas > 10 || withValidation > totalSchemas * 0.5) {
    complexity = 'moderate';
  }

  return {
    complexity,
    types,
    withValidation,
    circular,
  };
}

/**
 * Analyze security
 */
function analyzeSecurity(spec: ParsedSpec, endpoints: Endpoint[]) {
  const schemes: Array<{ name: string; type: string; description?: string }> = [];
  
  if (spec.components?.securitySchemes) {
    for (const [name, scheme] of Object.entries(spec.components.securitySchemes)) {
      schemes.push({
        name,
        type: scheme.type || 'unknown',
        description: scheme.description,
      });
    }
  }

  const globalSecurity = !!(spec.security && spec.security.length > 0);
  const endpointsWithSecurity = endpoints.filter(e => e.security && e.security.length > 0).length;

  return {
    schemes,
    globalSecurity,
    endpointsWithSecurity,
  };
}

/**
 * Analyze specification quality
 */
function analyzeQuality(spec: ParsedSpec, endpoints: Endpoint[]) {
  const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; path?: string }> = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check basic info
  if (!spec.info.description) {
    issues.push({
      type: 'warning',
      message: 'API description is missing',
      path: 'info.description',
    });
    score -= 5;
  }

  if (!spec.info.contact) {
    issues.push({
      type: 'info',
      message: 'Contact information is missing',
      path: 'info.contact',
    });
    score -= 2;
  }

  if (!spec.info.license) {
    issues.push({
      type: 'info',
      message: 'License information is missing',
      path: 'info.license',
    });
    score -= 2;
  }

  // Check endpoints
  const endpointsWithoutSummary = endpoints.filter(e => !e.summary).length;
  if (endpointsWithoutSummary > 0) {
    issues.push({
      type: 'warning',
      message: `${endpointsWithoutSummary} endpoint(s) missing summary`,
    });
    score -= Math.min(endpointsWithoutSummary * 2, 20);
  }

  const endpointsWithoutDescription = endpoints.filter(e => !e.description).length;
  if (endpointsWithoutDescription > endpoints.length * 0.5) {
    issues.push({
      type: 'info',
      message: 'Many endpoints are missing descriptions',
    });
    score -= 5;
  }

  const endpointsWithoutTags = endpoints.filter(e => !e.tags || e.tags.length === 0).length;
  if (endpointsWithoutTags > 0) {
    issues.push({
      type: 'info',
      message: `${endpointsWithoutTags} endpoint(s) without tags`,
    });
    score -= Math.min(endpointsWithoutTags, 10);
  }

  // Check responses
  const endpointsWithoutErrorResponses = endpoints.filter(e => 
    !Object.keys(e.responses).some(code => code.startsWith('4') || code.startsWith('5'))
  ).length;
  
  if (endpointsWithoutErrorResponses > endpoints.length * 0.3) {
    issues.push({
      type: 'warning',
      message: 'Many endpoints missing error response definitions',
    });
    score -= 10;
    recommendations.push('Define error responses (4xx, 5xx) for better API documentation');
  }

  // Check security
  if (!spec.components?.securitySchemes) {
    issues.push({
      type: 'info',
      message: 'No security schemes defined',
    });
    recommendations.push('Consider adding security schemes if your API requires authentication');
  }

  // Check examples
  const endpointsWithExamples = endpoints.filter(e => hasExamples(e)).length;
  if (endpointsWithExamples < endpoints.length * 0.3) {
    issues.push({
      type: 'info',
      message: 'Few endpoints have examples',
    });
    recommendations.push('Add examples to improve API documentation and testing');
  }

  // General recommendations
  if (endpoints.length > 20 && (!spec.tags || spec.tags.length < 3)) {
    recommendations.push('Consider organizing endpoints with more tags for better navigation');
  }

  if (spec.version === '2.0') {
    recommendations.push('Consider upgrading to OpenAPI 3.x for better features and tooling support');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    recommendations,
  };
}

/**
 * Extract endpoints from specification
 */
function extractEndpoints(spec: ParsedSpec): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const method of httpMethods) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') continue;

      const endpoint: Endpoint = {
        id: `${method.toUpperCase()}_${path}`.replace(/[^a-zA-Z0-9_]/g, '_'),
        method: method.toUpperCase() as HttpMethod,
        path,
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        tags: operation.tags,
        parameters: operation.parameters,
        requestBody: operation.requestBody,
        responses: operation.responses || {},
        security: operation.security,
        deprecated: operation.deprecated,
        servers: operation.servers,
      };

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

/**
 * Check if endpoint has examples
 */
function hasExamples(endpoint: Endpoint): boolean {
  // Check parameters for examples
  if (endpoint.parameters) {
    for (const param of endpoint.parameters) {
      if (param.example || param.examples) {
        return true;
      }
    }
  }

  // Check request body for examples
  if (endpoint.requestBody?.content) {
    for (const mediaType of Object.values(endpoint.requestBody.content)) {
      if (mediaType.example || mediaType.examples) {
        return true;
      }
    }
  }

  // Check responses for examples
  for (const response of Object.values(endpoint.responses)) {
    if (response.content) {
      for (const mediaType of Object.values(response.content)) {
        if (mediaType.example || mediaType.examples) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if schema has validation rules
 */
function hasValidationRules(schema: Schema): boolean {
  return !!(
    schema.minimum !== undefined ||
    schema.maximum !== undefined ||
    schema.minLength !== undefined ||
    schema.maxLength !== undefined ||
    schema.pattern ||
    schema.minItems !== undefined ||
    schema.maxItems !== undefined ||
    schema.minProperties !== undefined ||
    schema.maxProperties !== undefined ||
    schema.required?.length ||
    schema.enum?.length
  );
}

/**
 * Check for circular references (simplified detection)
 */
function hasCircularReference(schemaName: string, schema: Schema, _allSchemas: Record<string, Schema>): boolean {

  
  function checkCircular(currentSchema: Schema, path: string[]): boolean {
    if (path.includes(schemaName) && path.length > 1) {
      return true;
    }

    if (currentSchema.properties) {
      for (const [propName, propSchema] of Object.entries(currentSchema.properties)) {
        if (checkCircular(propSchema, [...path, propName])) {
          return true;
        }
      }
    }

    if (currentSchema.items) {
      if (checkCircular(currentSchema.items, [...path, 'items'])) {
        return true;
      }
    }

    if (currentSchema.allOf) {
      for (let i = 0; i < currentSchema.allOf.length; i++) {
        if (checkCircular(currentSchema.allOf[i], [...path, `allOf[${i}]`])) {
          return true;
        }
      }
    }

    return false;
  }

  return checkCircular(schema, [schemaName]);
}