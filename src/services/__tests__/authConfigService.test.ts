import { describe, it, expect } from 'vitest';
import { AuthConfigService } from '../authConfigService';
import { mockExtractedEndpoints } from '../../test/mocks/openapi';
import type { MCPAuthConfig } from '../../components/MCPAuthConfig';

describe('AuthConfigService', () => {
  describe('generateDefaultConfig', () => {
    it('should generate none config for endpoint without security', () => {
      const endpoint = mockExtractedEndpoints[0]; // GET /users (no security)
      const config = AuthConfigService.generateDefaultConfig(endpoint);

      expect(config.type).toBe('none');
      expect(config.required).toBe(false);
      expect(config.envVarName).toBe('');
    });

    it('should generate bearer config for JWT security', () => {
      const endpoint = {
        ...mockExtractedEndpoints[1], // POST /users
        security: [{ jwtAuth: [] }],
      };

      const config = AuthConfigService.generateDefaultConfig(endpoint);

      expect(config.type).toBe('bearer');
      expect(config.required).toBe(true);
      expect(config.envVarName).toContain('TOKEN');
      expect(config.headerName).toBe('Authorization');
      expect(config.location).toBe('header');
    });

    it('should generate apiKey config for API key security', () => {
      const endpoint = {
        ...mockExtractedEndpoints[0],
        security: [{ apiKey: [] }],
      };

      const config = AuthConfigService.generateDefaultConfig(endpoint);

      expect(config.type).toBe('apiKey');
      expect(config.required).toBe(true);
      expect(config.envVarName).toContain('API_KEY');
      expect(config.headerName).toBe('X-API-Key');
    });

    it('should generate basic config for basic auth', () => {
      const endpoint = {
        ...mockExtractedEndpoints[0],
        security: [{ basicAuth: [] }],
      };

      const config = AuthConfigService.generateDefaultConfig(endpoint);

      expect(config.type).toBe('basic');
      expect(config.required).toBe(true);
      expect(config.envVarName).toContain('BASIC_AUTH');
    });

    it('should generate oauth2 config for OAuth security', () => {
      const endpoint = {
        ...mockExtractedEndpoints[0],
        security: [{ oauth2: [] }],
      };

      const config = AuthConfigService.generateDefaultConfig(endpoint);

      expect(config.type).toBe('oauth2');
      expect(config.required).toBe(true);
      expect(config.envVarName).toContain('ACCESS_TOKEN');
    });

    it('should fallback to custom for unknown security schemes', () => {
      const endpoint = {
        ...mockExtractedEndpoints[0],
        security: [{ customAuth: [] }],
      };

      const config = AuthConfigService.generateDefaultConfig(endpoint);

      expect(config.type).toBe('custom');
      expect(config.required).toBe(true);
      expect(config.envVarName).toContain('AUTH');
    });
  });

  describe('generateConfigMap', () => {
    it('should generate config map for multiple endpoints', () => {
      const configMap = AuthConfigService.generateConfigMap(mockExtractedEndpoints);

      expect(Object.keys(configMap)).toHaveLength(3);
      expect(configMap[mockExtractedEndpoints[0].id]).toBeDefined();
      expect(configMap[mockExtractedEndpoints[1].id]).toBeDefined();
      expect(configMap[mockExtractedEndpoints[2].id]).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate none config as valid', () => {
      const config: MCPAuthConfig = {
        type: 'none',
        envVarName: '',
        required: false,
      };

      const result = AuthConfigService.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate complete bearer config as valid', () => {
      const config: MCPAuthConfig = {
        type: 'bearer',
        envVarName: 'API_TOKEN',
        headerName: 'Authorization',
        location: 'header',
        required: true,
        description: 'Bearer token',
      };

      const result = AuthConfigService.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config without env var name', () => {
      const config: MCPAuthConfig = {
        type: 'bearer',
        envVarName: '',
        required: true,
      };

      const result = AuthConfigService.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Environment variable name is required');
    });

    it('should reject config with invalid env var name format', () => {
      const config: MCPAuthConfig = {
        type: 'bearer',
        envVarName: 'invalid-name',
        required: true,
      };

      const result = AuthConfigService.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase letters'))).toBe(true);
    });

    it('should reject header auth without header name', () => {
      const config: MCPAuthConfig = {
        type: 'bearer',
        envVarName: 'API_TOKEN',
        location: 'header',
        headerName: '',
        required: true,
      };

      const result = AuthConfigService.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Header name is required for header-based authentication');
    });
  });

  describe('getUniqueEnvVars', () => {
    it('should return unique environment variables', () => {
      const configMap = {
        endpoint1: {
          type: 'bearer' as const,
          envVarName: 'API_TOKEN',
          required: true,
        },
        endpoint2: {
          type: 'bearer' as const,
          envVarName: 'API_TOKEN', // Same as endpoint1
          required: true,
        },
        endpoint3: {
          type: 'apiKey' as const,
          envVarName: 'API_KEY',
          required: true,
        },
        endpoint4: {
          type: 'none' as const,
          envVarName: '',
          required: false,
        },
      };

      const envVars = AuthConfigService.getUniqueEnvVars(configMap);
      expect(envVars).toEqual(['API_KEY', 'API_TOKEN']);
    });
  });

  describe('generateEnvTemplate', () => {
    it('should generate env template for auth configs', () => {
      const configMap = {
        endpoint1: {
          type: 'bearer' as const,
          envVarName: 'API_TOKEN',
          description: 'Bearer token for authentication',
          required: true,
        },
        endpoint2: {
          type: 'apiKey' as const,
          envVarName: 'API_KEY',
          description: 'API key for access',
          required: true,
        },
      };

      const template = AuthConfigService.generateEnvTemplate(configMap);

      expect(template).toContain('API_TOKEN=your-bearer-here');
      expect(template).toContain('API_KEY=your-apiKey-here');
      expect(template).toContain('Bearer token for authentication');
      expect(template).toContain('API key for access');
    });

    it('should handle no auth configs', () => {
      const configMap = {
        endpoint1: {
          type: 'none' as const,
          envVarName: '',
          required: false,
        },
      };

      const template = AuthConfigService.generateEnvTemplate(configMap);
      expect(template).toContain('No authentication required');
    });
  });

  describe('getAuthSummary', () => {
    it('should generate auth summary', () => {
      const configMap = {
        endpoint1: {
          type: 'bearer' as const,
          envVarName: 'API_TOKEN',
          required: true,
        },
        endpoint2: {
          type: 'apiKey' as const,
          envVarName: 'API_KEY',
          required: true,
        },
        endpoint3: {
          type: 'none' as const,
          envVarName: '',
          required: false,
        },
      };

      const summary = AuthConfigService.getAuthSummary(configMap);

      expect(summary.totalEndpoints).toBe(3);
      expect(summary.authRequired).toBe(2);
      expect(summary.authTypes.bearer).toBe(1);
      expect(summary.authTypes.apiKey).toBe(1);
      expect(summary.authTypes.none).toBe(1);
      expect(summary.envVarsNeeded).toBe(2);
    });
  });
});