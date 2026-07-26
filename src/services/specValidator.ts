import type { ParsedSpec, ValidationResult, ValidationError } from '../types';

/**
 * Comprehensive OpenAPI specification validator
 */
export class SpecValidator {
  private errors: ValidationError[] = [];
  private warnings: string[] = [];

  /**
   * Validate complete specification
   */
  validate(spec: ParsedSpec): ValidationResult {
    this.errors = [];
    this.warnings = [];

    this.validateInfo(spec.info);
    this.validatePaths(spec.paths);
    this.validateTags(spec.tags);
    this.validateSecurity(spec.security, spec.components?.securitySchemes);
    this.validateComponents(spec.components);
    this.validateServers(spec.servers);

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Validate info object
   */
  private validateInfo(info: unknown) {
    if (!info) {
      this.addError('Missing required "info" object', 'info');
      return;
    }

    const infoObj = info as Record<string, unknown>;

    if (!infoObj.title) {
      this.addError('Missing required field "info.title"', 'info.title');
    } else if (typeof infoObj.title !== 'string') {
      this.addError('Field "info.title" must be a string', 'info.title');
    }

    if (!infoObj.version) {
      this.addError('Missing required field "info.version"', 'info.version');
    } else if (typeof infoObj.version !== 'string') {
      this.addError('Field "info.version" must be a string', 'info.version');
    }

    if (infoObj.description && typeof infoObj.description !== 'string') {
      this.addError('Field "info.description" must be a string', 'info.description');
    }

    if (infoObj.termsOfService && typeof infoObj.termsOfService !== 'string') {
      this.addError('Field "info.termsOfService" must be a string', 'info.termsOfService');
    }

    if (infoObj.contact) {
      this.validateContact(infoObj.contact);
    }

    if (infoObj.license) {
      this.validateLicense(infoObj.license);
    }
  }

  /**
   * Validate contact object
   */
  private validateContact(contact: unknown) {
    if (typeof contact !== 'object') {
      this.addError('Field "info.contact" must be an object', 'info.contact');
      return;
    }

    const contactObj = contact as Record<string, unknown>;

    if (contactObj.name && typeof contactObj.name !== 'string') {
      this.addError('Field "info.contact.name" must be a string', 'info.contact.name');
    }

    if (contactObj.url && typeof contactObj.url !== 'string') {
      this.addError('Field "info.contact.url" must be a string', 'info.contact.url');
    } else if (contactObj.url && !this.isValidUrl(contactObj.url as string)) {
      this.addWarning('Field "info.contact.url" should be a valid URL');
    }

    if (contactObj.email && typeof contactObj.email !== 'string') {
      this.addError('Field "info.contact.email" must be a string', 'info.contact.email');
    } else if (contactObj.email && !this.isValidEmail(contactObj.email as string)) {
      this.addWarning('Field "info.contact.email" should be a valid email address');
    }
  }

  /**
   * Validate license object
   */
  private validateLicense(license: unknown) {
    if (typeof license !== 'object') {
      this.addError('Field "info.license" must be an object', 'info.license');
      return;
    }

    const licenseObj = license as Record<string, unknown>;

    if (!licenseObj.name) {
      this.addError('Missing required field "info.license.name"', 'info.license.name');
    } else if (typeof licenseObj.name !== 'string') {
      this.addError('Field "info.license.name" must be a string', 'info.license.name');
    }

    if (licenseObj.url && typeof licenseObj.url !== 'string') {
      this.addError('Field "info.license.url" must be a string', 'info.license.url');
    } else if (licenseObj.url && !this.isValidUrl(licenseObj.url as string)) {
      this.addWarning('Field "info.license.url" should be a valid URL');
    }
  }

  /**
   * Validate paths object
   */
  private validatePaths(paths: Record<string, unknown>) {
    if (!paths) {
      this.addError('Missing required "paths" object', 'paths');
      return;
    }

    if (typeof paths !== 'object') {
      this.addError('Field "paths" must be an object', 'paths');
      return;
    }

    if (Object.keys(paths).length === 0) {
      this.addWarning('No paths defined in specification');
    }

    for (const [path, pathItem] of Object.entries(paths)) {
      this.validatePath(path, pathItem);
    }
  }

  /**
   * Validate individual path
   */
  private validatePath(path: string, pathItem: unknown) {
    if (!path.startsWith('/')) {
      this.addWarning(`Path "${path}" should start with "/"`);
    }

    if (typeof pathItem !== 'object') {
      this.addError(`Path "${path}" must be an object`, `paths.${path}`);
      return;
    }

    const pathItemObj = pathItem as Record<string, unknown>;
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
    let hasOperations = false;

    for (const method of httpMethods) {
      if (pathItemObj[method]) {
        hasOperations = true;
        this.validateOperation(path, method, pathItemObj[method]);
      }
    }

    if (!hasOperations) {
      this.addWarning(`Path "${path}" has no HTTP operations defined`);
    }

    if (pathItemObj.parameters) {
      this.validateParameters(pathItemObj.parameters, `paths.${path}.parameters`);
    }
  }

  /**
   * Validate operation
   */
  private validateOperation(path: string, method: string, operation: unknown) {
    const operationPath = `paths.${path}.${method}`;

    if (typeof operation !== 'object') {
      this.addError(`Operation ${method.toUpperCase()} ${path} must be an object`, operationPath);
      return;
    }

    const operationObj = operation as Record<string, unknown>;

    // Responses are required
    if (!operationObj.responses) {
      this.addError(`Operation ${method.toUpperCase()} ${path} is missing required "responses"`, `${operationPath}.responses`);
    } else {
      this.validateResponses(operationObj.responses, `${operationPath}.responses`);
    }

    // Validate optional fields
    if (operationObj.tags && !Array.isArray(operationObj.tags)) {
      this.addError(`Operation ${method.toUpperCase()} ${path} "tags" must be an array`, `${operationPath}.tags`);
    }

    if (operationObj.summary && typeof operationObj.summary !== 'string') {
      this.addError(`Operation ${method.toUpperCase()} ${path} "summary" must be a string`, `${operationPath}.summary`);
    }

    if (operationObj.description && typeof operationObj.description !== 'string') {
      this.addError(`Operation ${method.toUpperCase()} ${path} "description" must be a string`, `${operationPath}.description`);
    }

    if (operationObj.operationId && typeof operationObj.operationId !== 'string') {
      this.addError(`Operation ${method.toUpperCase()} ${path} "operationId" must be a string`, `${operationPath}.operationId`);
    }

    if (operationObj.parameters) {
      this.validateParameters(operationObj.parameters, `${operationPath}.parameters`);
    }

    if (operationObj.requestBody) {
      this.validateRequestBody(operationObj.requestBody, `${operationPath}.requestBody`);
    }

    if (operationObj.security) {
      this.validateSecurityRequirements(operationObj.security as unknown[], `${operationPath}.security`);
    }

    // Quality checks
    if (!operationObj.summary) {
      this.addWarning(`Operation ${method.toUpperCase()} ${path} is missing summary`);
    }

    if (!operationObj.description) {
      this.addWarning(`Operation ${method.toUpperCase()} ${path} is missing description`);
    }
  }

  /**
   * Validate responses object
   */
  private validateResponses(responses: unknown, path: string) {
    if (typeof responses !== 'object') {
      this.addError('Responses must be an object', path);
      return;
    }

    const responsesObj = responses as Record<string, unknown>;

    if (Object.keys(responsesObj).length === 0) {
      this.addError('At least one response must be defined', path);
      return;
    }

    let hasSuccessResponse = false;
    let hasErrorResponse = false;

    for (const [statusCode, response] of Object.entries(responsesObj)) {
      if (statusCode.startsWith('2')) {
        hasSuccessResponse = true;
      }
      if (statusCode.startsWith('4') || statusCode.startsWith('5')) {
        hasErrorResponse = true;
      }

      this.validateResponse(response, `${path}.${statusCode}`);
    }

    if (!hasSuccessResponse) {
      this.addWarning('No success response (2xx) defined');
    }

    if (!hasErrorResponse) {
      this.addWarning('No error response (4xx/5xx) defined');
    }
  }

  /**
   * Validate response object
   */
  private validateResponse(response: unknown, path: string) {
    if (typeof response !== 'object') {
      this.addError('Response must be an object', path);
      return;
    }

    const responseObj = response as Record<string, unknown>;

    if (!responseObj.description) {
      this.addError('Response is missing required "description"', `${path}.description`);
    } else if (typeof responseObj.description !== 'string') {
      this.addError('Response "description" must be a string', `${path}.description`);
    }

    if (responseObj.headers && typeof responseObj.headers !== 'object') {
      this.addError('Response "headers" must be an object', `${path}.headers`);
    }

    if (responseObj.content && typeof responseObj.content !== 'object') {
      this.addError('Response "content" must be an object', `${path}.content`);
    }
  }

  /**
   * Validate parameters array
   */
  private validateParameters(parameters: unknown, path: string) {
    if (!Array.isArray(parameters)) {
      this.addError('Parameters must be an array', path);
      return;
    }

    const paramNames = new Map<string, Set<string>>();

    for (let i = 0; i < parameters.length; i++) {
      const parameter = parameters[i];
      const paramPath = `${path}[${i}]`;

      if (typeof parameter !== 'object') {
        this.addError(`Parameter at index ${i} must be an object`, paramPath);
        continue;
      }

      if (!parameter.name) {
        this.addError(`Parameter at index ${i} is missing required "name"`, `${paramPath}.name`);
      }

      if (!parameter.in) {
        this.addError(`Parameter at index ${i} is missing required "in"`, `${paramPath}.in`);
      } else if (!['query', 'header', 'path', 'cookie'].includes(parameter.in)) {
        this.addError(`Parameter at index ${i} "in" must be one of: query, header, path, cookie`, `${paramPath}.in`);
      }

      // Check for duplicate parameters
      if (parameter.name && parameter.in) {
        if (!paramNames.has(parameter.in)) {
          paramNames.set(parameter.in, new Set());
        }
        const namesInLocation = paramNames.get(parameter.in)!;
        if (namesInLocation.has(parameter.name)) {
          this.addError(`Duplicate parameter "${parameter.name}" in "${parameter.in}"`, paramPath);
        } else {
          namesInLocation.add(parameter.name);
        }
      }

      // Path parameters must be required
      if (parameter.in === 'path' && !parameter.required) {
        this.addError(`Path parameter "${parameter.name}" must be required`, `${paramPath}.required`);
      }
    }
  }

  /**
   * Validate request body
   */
  private validateRequestBody(requestBody: unknown, path: string) {
    if (typeof requestBody !== 'object') {
      this.addError('Request body must be an object', path);
      return;
    }

    const requestBodyObj = requestBody as Record<string, unknown>;

    if (!requestBodyObj.content) {
      this.addError('Request body is missing required "content"', `${path}.content`);
    } else if (typeof requestBodyObj.content !== 'object') {
      this.addError('Request body "content" must be an object', `${path}.content`);
    }

    if (requestBodyObj.description && typeof requestBodyObj.description !== 'string') {
      this.addError('Request body "description" must be a string', `${path}.description`);
    }
  }

  /**
   * Validate tags array
   */
  private validateTags(tags?: unknown[]) {
    if (!tags) return;

    if (!Array.isArray(tags)) {
      this.addError('Tags must be an array', 'tags');
      return;
    }

    const tagNames = new Set<string>();

    for (let i = 0; i < tags.length; i++) {
      const tagValue = tags[i];
      const tagPath = `tags[${i}]`;

      if (typeof tagValue !== 'object' || tagValue === null) {
        this.addError(`Tag at index ${i} must be an object`, tagPath);
        continue;
      }

      const tag = tagValue as Record<string, unknown>;
      const name = tag.name;
      const description = tag.description;

      if (!name) {
        this.addError(`Tag at index ${i} is missing required "name"`, `${tagPath}.name`);
      } else if (typeof name !== 'string') {
        this.addError(`Tag at index ${i} "name" must be a string`, `${tagPath}.name`);
      } else if (tagNames.has(name)) {
        this.addError(`Duplicate tag name: "${name}"`, tagPath);
      } else {
        tagNames.add(name);
      }

      if (description && typeof description !== 'string') {
        this.addError(`Tag "${String(name)}" "description" must be a string`, `${tagPath}.description`);
      }
    }
  }

  /**
   * Validate security requirements
   */
  private validateSecurity(security?: unknown[], securitySchemes?: Record<string, unknown>) {
    if (!security) return;

    if (!Array.isArray(security)) {
      this.addError('Security must be an array', 'security');
      return;
    }

    for (let i = 0; i < security.length; i++) {
      const requirement = security[i];
      const reqPath = `security[${i}]`;

      if (typeof requirement !== 'object') {
        this.addError(`Security requirement at index ${i} must be an object`, reqPath);
        continue;
      }

      this.validateSecurityRequirement(requirement, reqPath, securitySchemes);
    }
  }

  /**
   * Validate security requirements array
   */
  private validateSecurityRequirements(security: unknown[], path: string, securitySchemes?: Record<string, unknown>) {
    if (!Array.isArray(security)) {
      this.addError('Security requirements must be an array', path);
      return;
    }

    for (let i = 0; i < security.length; i++) {
      const requirement = security[i];
      const reqPath = `${path}[${i}]`;

      if (typeof requirement !== 'object') {
        this.addError(`Security requirement at index ${i} must be an object`, reqPath);
        continue;
      }

      this.validateSecurityRequirement(requirement, reqPath, securitySchemes);
    }
  }

  /**
   * Validate individual security requirement
   */
  private validateSecurityRequirement(requirement: unknown, path: string, securitySchemes?: Record<string, unknown>) {
    const requirementObj = requirement as Record<string, unknown>;
    for (const [schemeName, scopes] of Object.entries(requirementObj)) {
      if (!Array.isArray(scopes)) {
        this.addError(`Security requirement "${schemeName}" scopes must be an array`, path);
      }

      if (securitySchemes && !securitySchemes[schemeName]) {
        this.addError(`Security scheme "${schemeName}" is not defined in components.securitySchemes`, path);
      }
    }
  }

  /**
   * Validate components object
   */
  private validateComponents(components?: unknown) {
    if (!components) return;

    if (typeof components !== 'object') {
      this.addError('Components must be an object', 'components');
      return;
    }

    const componentsObj = components as Record<string, unknown>;

    if (componentsObj.schemas) {
      this.validateSchemas(componentsObj.schemas);
    }

    if (componentsObj.securitySchemes) {
      this.validateSecuritySchemes(componentsObj.securitySchemes);
    }
  }

  /**
   * Validate schemas object
   */
  private validateSchemas(schemas: unknown) {
    if (typeof schemas !== 'object') {
      this.addError('Components schemas must be an object', 'components.schemas');
      return;
    }

    const schemasObj = schemas as Record<string, unknown>;
    for (const [schemaName, schema] of Object.entries(schemasObj)) {
      this.validateSchema(schema, `components.schemas.${schemaName}`);
    }
  }

  /**
   * Validate individual schema
   */
  private validateSchema(schema: unknown, path: string) {
    if (typeof schema !== 'object') {
      this.addError('Schema must be an object', path);
      return;
    }

    // Basic schema validation would go here
    // This is a simplified version - full JSON Schema validation would be more complex
  }

  /**
   * Validate security schemes
   */
  private validateSecuritySchemes(securitySchemes: unknown) {
    if (typeof securitySchemes !== 'object') {
      this.addError('Components securitySchemes must be an object', 'components.securitySchemes');
      return;
    }

    const schemesObj = securitySchemes as Record<string, unknown>;
    for (const [schemeName, scheme] of Object.entries(schemesObj)) {
      this.validateSecurityScheme(scheme, `components.securitySchemes.${schemeName}`);
    }
  }

  /**
   * Validate individual security scheme
   */
  private validateSecurityScheme(scheme: unknown, path: string) {
    if (typeof scheme !== 'object') {
      this.addError('Security scheme must be an object', path);
      return;
    }

    const schemeObj = scheme as Record<string, unknown>;

    if (!schemeObj.type) {
      this.addError('Security scheme is missing required "type"', `${path}.type`);
    } else if (!['apiKey', 'http', 'oauth2', 'openIdConnect'].includes(schemeObj.type as string)) {
      this.addError('Security scheme "type" must be one of: apiKey, http, oauth2, openIdConnect', `${path}.type`);
    }

    // Type-specific validation
    if (schemeObj.type === 'apiKey') {
      if (!schemeObj.name) {
        this.addError('API key security scheme is missing required "name"', `${path}.name`);
      }
      if (!schemeObj.in) {
        this.addError('API key security scheme is missing required "in"', `${path}.in`);
      } else if (!['query', 'header', 'cookie'].includes(schemeObj.in as string)) {
        this.addError('API key security scheme "in" must be one of: query, header, cookie', `${path}.in`);
      }
    }
  }

  /**
   * Validate servers array
   */
  private validateServers(servers?: unknown[]) {
    if (!servers) return;

    if (!Array.isArray(servers)) {
      this.addError('Servers must be an array', 'servers');
      return;
    }

    for (let i = 0; i < servers.length; i++) {
      const serverValue = servers[i];
      const serverPath = `servers[${i}]`;

      if (typeof serverValue !== 'object' || serverValue === null) {
        this.addError(`Server at index ${i} must be an object`, serverPath);
        continue;
      }

      const server = serverValue as Record<string, unknown>;
      const url = server.url;
      const description = server.description;

      if (!url) {
        this.addError(`Server at index ${i} is missing required "url"`, `${serverPath}.url`);
      } else if (typeof url !== 'string') {
        this.addError(`Server at index ${i} "url" must be a string`, `${serverPath}.url`);
      }

      if (description && typeof description !== 'string') {
        this.addError(`Server at index ${i} "description" must be a string`, `${serverPath}.description`);
      }
    }
  }

  /**
   * Add validation error
   */
  private addError(message: string, field?: string) {
    this.errors.push({
      type: 'validation',
      message,
      field,
      timestamp: Date.now(),
      recoverable: true,
    });
  }

  /**
   * Add validation warning
   */
  private addWarning(message: string) {
    this.warnings.push(message);
  }

  /**
   * Check if string is valid URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if string is valid email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}