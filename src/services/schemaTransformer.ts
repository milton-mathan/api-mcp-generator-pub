import type { ExtractedEndpoint, Parameter, Schema } from './endpointExtractor';

export interface JSONSchema {
  type?: string;
  format?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  $ref?: string;
}

export interface MCPToolSchema {
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
}

/** The subset of an OpenAPI media type object this transformer reads. */
interface MediaTypeLike {
  schema?: Schema;
}

/** The subset of an OpenAPI request body object this transformer reads. */
interface RequestBodyLike {
  description?: string;
  content?: Record<string, MediaTypeLike>;
}

export class SchemaTransformer {
  /**
   * Transform OpenAPI endpoint to MCP tool schema
   */
  static transformEndpointToMCPSchema(endpoint: ExtractedEndpoint): MCPToolSchema {
    const inputSchema = this.generateInputSchema(endpoint);
    const outputSchema = this.generateOutputSchema(endpoint);

    return {
      inputSchema,
      outputSchema,
    };
  }

  /**
   * Generate input schema for MCP tool from endpoint parameters
   */
  private static generateInputSchema(endpoint: ExtractedEndpoint): JSONSchema {
    const schema: JSONSchema = {
      type: "object",
      properties: {},
      required: [],
      description: `Input parameters for ${endpoint.method} ${endpoint.path}`,
    };

    // Add parameters to schema
    endpoint.parameters?.forEach(param => {
      if (param.in === 'header' && ['authorization', 'x-api-key'].includes(param.name.toLowerCase())) {
        return; // Skip auth headers
      }

      const paramSchema = this.transformParameterToSchema(param);
      schema.properties![param.name] = {
        ...paramSchema,
        description: param.description || `${param.in} parameter: ${param.name}`,
      };
      
      if (param.required) {
        schema.required!.push(param.name);
      }
    });

    // Add request body for POST/PUT/PATCH methods
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && endpoint.requestBody) {
      const bodySchema = this.transformRequestBodyToSchema(endpoint.requestBody);
      schema.properties!.body = {
        ...bodySchema,
        description: "Request body data",
      };
      
      if (endpoint.requestBody.required) {
        schema.required!.push('body');
      }
    }

    // If no properties, add a placeholder
    if (Object.keys(schema.properties!).length === 0) {
      schema.properties = {
        _placeholder: {
          type: "string",
          description: "This endpoint requires no parameters",
          default: "",
        },
      };
    }

    return schema;
  } 
 /**
   * Generate output schema from endpoint responses
   */
  private static generateOutputSchema(endpoint: ExtractedEndpoint): JSONSchema | undefined {
    // Find successful response (200, 201, etc.)
    const successResponse = Object.entries(endpoint.responses).find(([code]) => 
      code.startsWith('2') || code === 'default'
    );

    if (!successResponse) {
      return {
        type: "object",
        description: "API response",
        properties: {
          data: {
            type: "object",
            description: "Response data",
          },
          status: {
            type: "integer",
            description: "HTTP status code",
          },
        },
      };
    }

    const [, response] = successResponse;
    
    if (response.content) {
      // Handle JSON content
      const jsonContent = response.content['application/json'];
      if (jsonContent && jsonContent.schema) {
        return this.transformOpenAPISchemaToJSON(jsonContent.schema);
      }

      // Handle other content types
      const firstContent = Object.values(response.content)[0];
      if (firstContent && firstContent.schema) {
        return this.transformOpenAPISchemaToJSON(firstContent.schema);
      }
    }

    // Default response schema
    return {
      type: "object",
      description: response.description || "API response",
      properties: {
        data: {
          type: "object",
          description: "Response data",
        },
      },
    };
  }

  /**
   * Transform OpenAPI parameter to JSON Schema
   */
  private static transformParameterToSchema(param: Parameter): JSONSchema {
    if (!param.schema) {
      return {
        type: "string",
        description: param.description,
      };
    }

    return this.transformOpenAPISchemaToJSON(param.schema);
  }

  /**
   * Transform request body to JSON Schema
   */
  private static transformRequestBodyToSchema(requestBody: RequestBodyLike): JSONSchema {
    if (!requestBody.content) {
      return {
        type: "object",
        description: requestBody.description || "Request body",
      };
    }

    // Handle JSON content
    const jsonContent = requestBody.content['application/json'];
    if (jsonContent && jsonContent.schema) {
      return this.transformOpenAPISchemaToJSON(jsonContent.schema);
    }

    // Handle form data
    const formContent = requestBody.content['application/x-www-form-urlencoded'] ||
                       requestBody.content['multipart/form-data'];
    if (formContent && formContent.schema) {
      return this.transformOpenAPISchemaToJSON(formContent.schema);
    }

    // Handle other content types
    const firstContent = Object.values(requestBody.content)[0] as MediaTypeLike;
    if (firstContent && firstContent.schema) {
      return this.transformOpenAPISchemaToJSON(firstContent.schema);
    }

    return {
      type: "object",
      description: requestBody.description || "Request body",
    };
  }  /**

   * Transform OpenAPI schema to JSON Schema
   */
  private static transformOpenAPISchemaToJSON(schema: Schema): JSONSchema {
    const jsonSchema: JSONSchema = {};

    // Basic type information
    if (schema.type) {
      jsonSchema.type = schema.type;
    }

    if (schema.format) {
      jsonSchema.format = schema.format;
    }

    if (schema.description) {
      jsonSchema.description = schema.description;
    }

    if (schema.example !== undefined) {
      jsonSchema.example = schema.example;
    }

    if (schema.default !== undefined) {
      jsonSchema.default = schema.default;
    }

    // Validation constraints
    if (schema.minimum !== undefined) {
      jsonSchema.minimum = schema.minimum;
    }

    if (schema.maximum !== undefined) {
      jsonSchema.maximum = schema.maximum;
    }

    if (schema.minLength !== undefined) {
      jsonSchema.minLength = schema.minLength;
    }

    if (schema.maxLength !== undefined) {
      jsonSchema.maxLength = schema.maxLength;
    }

    if (schema.pattern) {
      jsonSchema.pattern = schema.pattern;
    }

    if (schema.enum) {
      jsonSchema.enum = schema.enum;
    }

    // Object properties
    if (schema.properties) {
      jsonSchema.properties = {};
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        jsonSchema.properties![key] = this.transformOpenAPISchemaToJSON(propSchema);
      });
    }

    if (schema.required) {
      jsonSchema.required = schema.required;
    }

    if (schema.additionalProperties !== undefined) {
      if (typeof schema.additionalProperties === 'boolean') {
        jsonSchema.additionalProperties = schema.additionalProperties;
      } else {
        jsonSchema.additionalProperties = this.transformOpenAPISchemaToJSON(schema.additionalProperties);
      }
    }

    // Array items
    if (schema.items) {
      jsonSchema.items = this.transformOpenAPISchemaToJSON(schema.items);
    }

    // Composition schemas
    if (schema.oneOf) {
      jsonSchema.oneOf = schema.oneOf.map(s => this.transformOpenAPISchemaToJSON(s));
    }

    if (schema.anyOf) {
      jsonSchema.anyOf = schema.anyOf.map(s => this.transformOpenAPISchemaToJSON(s));
    }

    if (schema.allOf) {
      jsonSchema.allOf = schema.allOf.map(s => this.transformOpenAPISchemaToJSON(s));
    }

    // References
    if (schema.$ref) {
      jsonSchema.$ref = schema.$ref;
    }

    return jsonSchema;
  }

  /**
   * Validate JSON Schema
   */
  static validateSchema(schema: JSONSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!schema.type && !schema.$ref && !schema.oneOf && !schema.anyOf && !schema.allOf) {
      errors.push('Schema must have a type or reference');
    }

    // Array schema validation
    if (schema.type === 'array' && !schema.items) {
      errors.push('Array schema must have items definition');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Simplify complex schemas for MCP tools
   */
  static simplifySchema(schema: JSONSchema, maxDepth: number = 3): JSONSchema {
    if (maxDepth <= 0) {
      return {
        type: "object",
        description: "Complex object (simplified)",
      };
    }

    const simplified: JSONSchema = { ...schema };

    // Simplify object properties
    if (simplified.properties) {
      const simplifiedProps: Record<string, JSONSchema> = {};
      Object.entries(simplified.properties).forEach(([key, propSchema]) => {
        simplifiedProps[key] = this.simplifySchema(propSchema, maxDepth - 1);
      });
      simplified.properties = simplifiedProps;
    }

    // Simplify array items
    if (simplified.items) {
      simplified.items = this.simplifySchema(simplified.items, maxDepth - 1);
    }

    return simplified;
  }
}