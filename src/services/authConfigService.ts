import type { ExtractedEndpoint } from './endpointExtractor';
import type { MCPAuthConfigType } from '../components/MCPAuthConfig';

export interface AuthConfigMap {
  [endpointId: string]: MCPAuthConfigType;
}

export interface GlobalAuthConfig {
  baseUrl?: string;
  globalHeaders?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export class AuthConfigService {
  /**
   * Generate default authentication configuration for an endpoint
   */
  static generateDefaultConfig(endpoint: ExtractedEndpoint): MCPAuthConfigType {
    // If no security requirements, return none
    if (!endpoint.security || endpoint.security.length === 0) {
      return {
        type: 'none',
        envVarName: '',
        required: false,
      };
    }

    // Get the first security requirement
    const firstSecurity = endpoint.security[0];
    const securityName = Object.keys(firstSecurity)[0];
    
    // Generate base environment variable name
    const baseEnvName = this.generateEnvVarName(endpoint, securityName);

    // Try to infer auth type from security scheme name
    const lowerName = securityName.toLowerCase();
    
    if (lowerName.includes('bearer') || lowerName.includes('jwt')) {
      return {
        type: 'bearer',
        envVarName: `${baseEnvName}_TOKEN`,
        headerName: 'Authorization',
        location: 'header',
        required: true,
        description: `Bearer token for ${securityName} authentication`,
      };
    }
    
    if (lowerName.includes('api') || lowerName.includes('key')) {
      return {
        type: 'apiKey',
        envVarName: `${baseEnvName}_API_KEY`,
        headerName: 'X-API-Key',
        location: 'header',
        required: true,
        description: `API key for ${securityName} authentication`,
      };
    }
    
    if (lowerName.includes('basic')) {
      return {
        type: 'basic',
        envVarName: `${baseEnvName}_BASIC_AUTH`,
        headerName: 'Authorization',
        location: 'header',
        required: true,
        description: `Basic authentication for ${securityName}`,
      };
    }
    
    if (lowerName.includes('oauth')) {
      return {
        type: 'oauth2',
        envVarName: `${baseEnvName}_ACCESS_TOKEN`,
        headerName: 'Authorization',
        location: 'header',
        required: true,
        description: `OAuth2 access token for ${securityName}`,
      };
    }

    // Default to custom
    return {
      type: 'custom',
      envVarName: `${baseEnvName}_AUTH`,
      headerName: 'Authorization',
      location: 'header',
      required: true,
      description: `Custom authentication for ${securityName}`,
    };
  }

  /**
   * Generate environment variable name from endpoint and security scheme
   */
  private static generateEnvVarName(endpoint: ExtractedEndpoint, securityName?: string): string {
    // Try operation ID first
    if (endpoint.operationId) {
      return endpoint.operationId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    }

    // Use security name if available
    if (securityName) {
      return securityName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    }

    // Fall back to path-based name
    const pathName = endpoint.path
      .replace(/[{}]/g, '') // Remove path parameters
      .replace(/[^a-zA-Z0-9]/g, '_') // Replace special chars with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .toUpperCase();

    return `${endpoint.method}_${pathName}`;
  }

  /**
   * Generate authentication configurations for multiple endpoints
   */
  static generateConfigMap(endpoints: ExtractedEndpoint[]): AuthConfigMap {
    const configMap: AuthConfigMap = {};
    
    endpoints.forEach(endpoint => {
      configMap[endpoint.id] = this.generateDefaultConfig(endpoint);
    });

    return configMap;
  }

  /**
   * Validate authentication configuration
   */
  static validateConfig(config: MCPAuthConfigType): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.type === 'none') {
      return { valid: true, errors: [] };
    }

    // Check required fields
    if (!config.envVarName || config.envVarName.trim() === '') {
      errors.push('Environment variable name is required');
    }

    // Validate environment variable name format
    if (config.envVarName && !/^[A-Z][A-Z0-9_]*$/.test(config.envVarName)) {
      errors.push('Environment variable name must start with a letter and contain only uppercase letters, numbers, and underscores');
    }

    // Check header name for header-based auth
    if (config.location === 'header' && (!config.headerName || config.headerName.trim() === '')) {
      errors.push('Header name is required for header-based authentication');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get unique environment variables from config map
   */
  static getUniqueEnvVars(configMap: AuthConfigMap): string[] {
    const envVars = new Set<string>();
    
    Object.values(configMap).forEach(config => {
      if (config.type !== 'none' && config.envVarName) {
        envVars.add(config.envVarName);
      }
    });

    return Array.from(envVars).sort();
  }

  /**
   * Generate .env template from config map
   */
  static generateEnvTemplate(configMap: AuthConfigMap): string {
    const envVars = this.getUniqueEnvVars(configMap);
    
    if (envVars.length === 0) {
      return '# No authentication required for selected endpoints\n';
    }

    let template = '# Authentication Configuration\n';
    template += '# Copy this file to .env and fill in your actual values\n';
    template += '# Never commit .env files to version control!\n\n';

    // Group configs by environment variable
    const envVarConfigs: Record<string, MCPAuthConfigType[]> = {};
    Object.values(configMap).forEach(config => {
      if (config.type !== 'none' && config.envVarName) {
        if (!envVarConfigs[config.envVarName]) {
          envVarConfigs[config.envVarName] = [];
        }
        envVarConfigs[config.envVarName].push(config);
      }
    });

    envVars.forEach(envVar => {
      const configs = envVarConfigs[envVar];
      const firstConfig = configs[0];
      
      template += `# ${firstConfig.description || 'Authentication value'}\n`;
      
      if (configs.length > 1) {
        template += `# Used by ${configs.length} endpoints\n`;
      }
      
      template += `${envVar}=your-${firstConfig.type}-here\n\n`;
    });

    return template;
  }

  /**
   * Generate Python code for authentication handling
   */
  static generateAuthCode(configMap: AuthConfigMap): string {
    const envVars = this.getUniqueEnvVars(configMap);
    
    if (envVars.length === 0) {
      return `
# No authentication required
def get_auth_headers(endpoint_id: str = None) -> Dict[str, str]:
    return {}

def validate_auth_config() -> None:
    """Validate authentication configuration."""
    # No authentication configuration to validate
    pass
`;
    }

    let code = `import os
from typing import Dict, Optional

# Authentication configuration
AUTH_CONFIG = {
`;

    Object.entries(configMap).forEach(([endpointId, config]) => {
      if (config.type !== 'none') {
        code += `    "${endpointId}": {
        "type": "${config.type}",
        "env_var": "${config.envVarName}",
        "header_name": "${config.headerName || 'Authorization'}",
        "location": "${config.location || 'header'}",
        "required": ${config.required},
    },
`;
      }
    });

    code += `}

def get_auth_headers(endpoint_id: str) -> Dict[str, str]:
    """Get authentication headers for a specific endpoint."""
    config = AUTH_CONFIG.get(endpoint_id)
    if not config:
        return {}
    
    env_var = config["env_var"]
    auth_value = os.getenv(env_var)
    
    if config["required"] and not auth_value:
        raise ValueError(f"Required authentication environment variable {env_var} is not set")
    
    if not auth_value:
        return {}
    
    headers = {}
    header_name = config["header_name"]
    
    if config["type"] == "bearer":
        headers[header_name] = f"Bearer {auth_value}"
    elif config["type"] == "basic":
        headers[header_name] = f"Basic {auth_value}"
    elif config["type"] == "oauth2":
        headers[header_name] = f"Bearer {auth_value}"
    else:
        headers[header_name] = auth_value
    
    return headers

def validate_auth_config() -> None:
    """Validate that all required authentication environment variables are set."""
    missing_vars = []
    
    for endpoint_id, config in AUTH_CONFIG.items():
        if config["required"]:
            env_var = config["env_var"]
            if not os.getenv(env_var):
                missing_vars.append(env_var)
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
`;

    return code;
  }

  /**
   * Generate FastMCP-specific authentication code with enhanced logging and error handling
   */
  static generateFastMCPAuthCode(configMap: AuthConfigMap): string {
    const envVars = this.getUniqueEnvVars(configMap);
    
    if (envVars.length === 0) {
      return `
# No authentication required
def get_auth_headers(endpoint_id: str = None) -> Dict[str, str]:
    """Get authentication headers for a specific endpoint."""
    return {}

def get_auth_params(endpoint_id: str = None) -> Dict[str, str]:
    """Get authentication parameters for a specific endpoint."""
    return {}

def get_auth_summary(endpoint_id: str = None) -> str:
    """Get authentication summary for a specific endpoint."""
    return "No authentication required"

def validate_auth_config() -> None:
    """Validate authentication configuration."""
    pass
`;
    }

    let code = `import os
from typing import Dict, Optional
import logging

# Get logger for authentication
auth_logger = logging.getLogger("fastmcp.auth")

# Authentication configuration
AUTH_CONFIG = {
`;

    Object.entries(configMap).forEach(([endpointId, config]) => {
      if (config.type !== 'none') {
        code += `    "${endpointId}": {
        "type": "${config.type}",
        "env_var": "${config.envVarName}",
        "header_name": "${config.headerName || 'Authorization'}",
        "location": "${config.location || 'header'}",
        "required": ${config.required},
        "description": "${config.description || `${config.type} authentication`}",
    },
`;
      }
    });

    code += `}

def get_auth_headers(endpoint_id: str) -> Dict[str, str]:
    """Get authentication headers for a specific endpoint with FastMCP logging."""
    config = AUTH_CONFIG.get(endpoint_id)
    if not config:
        auth_logger.debug(f"No authentication config found for endpoint: {endpoint_id}")
        return {}
    
    env_var = config["env_var"]
    auth_value = os.getenv(env_var)
    
    if config["required"] and not auth_value:
        error_msg = f"Required authentication environment variable {env_var} is not set for endpoint {endpoint_id}"
        auth_logger.error(error_msg)
        raise ValueError(error_msg)
    
    if not auth_value:
        auth_logger.debug(f"No authentication value found for {env_var}, skipping auth headers")
        return {}
    
    headers = {}
    header_name = config["header_name"]
    auth_type = config["type"]
    
    try:
        if auth_type == "bearer":
            headers[header_name] = f"Bearer {auth_value}"
        elif auth_type == "basic":
            headers[header_name] = f"Basic {auth_value}"
        elif auth_type == "oauth2":
            headers[header_name] = f"Bearer {auth_value}"
        elif auth_type == "apiKey":
            if config["location"] == "query":
                # For query parameters, return empty headers and handle in request params
                auth_logger.debug(f"API key authentication for query parameter: {header_name}")
                return {}
            else:
                headers[header_name] = auth_value
        else:
            headers[header_name] = auth_value
        
        auth_logger.debug(f"Generated auth headers for endpoint {endpoint_id} using {auth_type} authentication")
        return headers
        
    except Exception as e:
        auth_logger.error(f"Error generating auth headers for endpoint {endpoint_id}: {str(e)}")
        raise

def get_auth_params(endpoint_id: str) -> Dict[str, str]:
    """Get authentication query parameters for endpoints that use query-based auth."""
    config = AUTH_CONFIG.get(endpoint_id)
    if not config or config["location"] != "query":
        return {}
    
    env_var = config["env_var"]
    auth_value = os.getenv(env_var)
    
    if config["required"] and not auth_value:
        error_msg = f"Required authentication environment variable {env_var} is not set for endpoint {endpoint_id}"
        auth_logger.error(error_msg)
        raise ValueError(error_msg)
    
    if not auth_value:
        return {}
    
    param_name = config.get("param_name", config["header_name"])
    return {param_name: auth_value}

def validate_auth_config() -> None:
    """Validate that all required authentication environment variables are set."""
    missing_vars = []
    
    for endpoint_id, config in AUTH_CONFIG.items():
        if config["required"]:
            env_var = config["env_var"]
            if not os.getenv(env_var):
                missing_vars.append(f"{env_var} (for {config['description']})")
    
    if missing_vars:
        error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
        auth_logger.error(error_msg)
        raise ValueError(error_msg)
    
    auth_logger.info(f"Authentication configuration validated successfully for {len(AUTH_CONFIG)} endpoints")

def get_auth_summary() -> Dict[str, any]:
    """Get a summary of authentication configuration for debugging."""
    summary = {
        "total_endpoints": len(AUTH_CONFIG),
        "auth_types": {},
        "required_env_vars": [],
        "optional_env_vars": []
    }
    
    for endpoint_id, config in AUTH_CONFIG.items():
        auth_type = config["type"]
        summary["auth_types"][auth_type] = summary["auth_types"].get(auth_type, 0) + 1
        
        env_var = config["env_var"]
        if config["required"]:
            summary["required_env_vars"].append(env_var)
        else:
            summary["optional_env_vars"].append(env_var)
    
    return summary
`;

    return code;
  }

  /**
   * Get authentication summary for display
   */
  static getAuthSummary(configMap: AuthConfigMap): {
    totalEndpoints: number;
    authRequired: number;
    authTypes: Record<string, number>;
    envVarsNeeded: number;
  } {
    const totalEndpoints = Object.keys(configMap).length;
    const authRequired = Object.values(configMap).filter(c => c.type !== 'none').length;
    const authTypes: Record<string, number> = {};
    
    Object.values(configMap).forEach(config => {
      authTypes[config.type] = (authTypes[config.type] || 0) + 1;
    });

    const envVarsNeeded = this.getUniqueEnvVars(configMap).length;

    return {
      totalEndpoints,
      authRequired,
      authTypes,
      envVarsNeeded,
    };
  }
}