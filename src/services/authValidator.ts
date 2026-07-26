import type { ValidationResult, ValidationError } from '../types';

interface AuthConfig {
  type: 'none' | 'bearer' | 'apiKey' | 'basic' | 'custom';
  token?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  headerName?: string;
  location?: 'header' | 'query';
  customHeaders?: Array<{ key: string; value: string }>;
}

/**
 * Validate authentication configuration
 */
export function validateAuthConfig(config: AuthConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  switch (config.type) {
    case 'none':
      // No validation needed
      break;

    case 'bearer':
      if (!config.token?.trim()) {
        errors.push({
          type: 'validation',
          message: 'Bearer token is required',
          field: 'token',
          timestamp: Date.now(),
          recoverable: true,
        });
      } else {
        // Check for common token format issues
        const token = config.token.trim();
        if (token.length < 10) {
          warnings.push('Bearer token seems unusually short');
        }
        if (token.includes(' ')) {
          warnings.push('Bearer token contains spaces, which may cause issues');
        }
        if (!token.match(/^[A-Za-z0-9._-]+$/)) {
          warnings.push('Bearer token contains unusual characters');
        }
      }
      break;

    case 'apiKey':
      if (!config.apiKey?.trim()) {
        errors.push({
          type: 'validation',
          message: 'API key is required',
          field: 'apiKey',
          timestamp: Date.now(),
          recoverable: true,
        });
      }
      if (!config.headerName?.trim()) {
        errors.push({
          type: 'validation',
          message: 'Header name is required for API key authentication',
          field: 'headerName',
          timestamp: Date.now(),
          recoverable: true,
        });
      } else {
        // Validate header name format
        const headerName = config.headerName.trim();
        if (!headerName.match(/^[A-Za-z][A-Za-z0-9-_]*$/)) {
          errors.push({
            type: 'validation',
            message: 'Header name must start with a letter and contain only letters, numbers, hyphens, and underscores',
            field: 'headerName',
            timestamp: Date.now(),
            recoverable: true,
          });
        }
      }
      break;

    case 'basic':
      if (!config.username?.trim()) {
        errors.push({
          type: 'validation',
          message: 'Username is required for basic authentication',
          field: 'username',
          timestamp: Date.now(),
          recoverable: true,
        });
      }
      if (!config.password?.trim()) {
        errors.push({
          type: 'validation',
          message: 'Password is required for basic authentication',
          field: 'password',
          timestamp: Date.now(),
          recoverable: true,
        });
      }
      break;

    case 'custom':
      if (!config.customHeaders || config.customHeaders.length === 0) {
        errors.push({
          type: 'validation',
          message: 'At least one custom header is required',
          field: 'customHeaders',
          timestamp: Date.now(),
          recoverable: true,
        });
      } else {
        const validHeaders = config.customHeaders.filter(h => h.key.trim() && h.value.trim());
        if (validHeaders.length === 0) {
          errors.push({
            type: 'validation',
            message: 'At least one custom header must have both key and value',
            field: 'customHeaders',
            timestamp: Date.now(),
            recoverable: true,
          });
        }

        // Validate header names
        config.customHeaders.forEach((header, index) => {
          if (header.key.trim() && !header.key.match(/^[A-Za-z][A-Za-z0-9-_]*$/)) {
            errors.push({
              type: 'validation',
              message: `Header name "${header.key}" is invalid. Must start with a letter and contain only letters, numbers, hyphens, and underscores`,
              field: `customHeaders[${index}].key`,
              timestamp: Date.now(),
              recoverable: true,
            });
          }
        });

        // Check for duplicate header names
        const headerNames = config.customHeaders
          .filter(h => h.key.trim())
          .map(h => h.key.trim().toLowerCase());
        const duplicates = headerNames.filter((name, index) => headerNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
          warnings.push(`Duplicate header names found: ${duplicates.join(', ')}`);
        }
      }
      break;

    default:
      errors.push({
        type: 'validation',
        message: 'Invalid authentication type',
        field: 'type',
        timestamp: Date.now(),
        recoverable: true,
      });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get security recommendations for authentication configuration
 */
export function getSecurityRecommendations(config: AuthConfig): string[] {
  const recommendations: string[] = [];

  switch (config.type) {
    case 'bearer':
      recommendations.push('Store bearer tokens securely and rotate them regularly');
      recommendations.push('Use HTTPS URLs to protect tokens in transit');
      break;

    case 'apiKey':
      recommendations.push('Store API keys securely and rotate them regularly');
      recommendations.push('Use HTTPS URLs to protect API keys in transit');
      if (config.location === 'query') {
        recommendations.push('Query parameter API keys may be logged in server access logs');
      }
      break;

    case 'basic':
      recommendations.push('Basic authentication sends credentials in base64 encoding, not encryption');
      recommendations.push('Always use HTTPS with basic authentication');
      recommendations.push('Consider using more secure authentication methods like OAuth 2.0');
      break;

    case 'custom':
      recommendations.push('Ensure custom headers do not contain sensitive information in plain text');
      recommendations.push('Use HTTPS URLs to protect custom headers in transit');
      break;
  }

  return recommendations;
}

/**
 * Sanitize authentication configuration for logging/debugging
 */
export function sanitizeAuthConfig(config: AuthConfig): Partial<AuthConfig> {
  const sanitized: Partial<AuthConfig> = {
    type: config.type,
    headerName: config.headerName,
    location: config.location,
  };

  // Don't include sensitive values
  if (config.token) {
    sanitized.token = '***';
  }
  if (config.apiKey) {
    sanitized.apiKey = '***';
  }
  if (config.username) {
    sanitized.username = config.username; // Username is usually not sensitive
  }
  if (config.password) {
    sanitized.password = '***';
  }
  if (config.customHeaders) {
    sanitized.customHeaders = config.customHeaders.map(h => ({
      key: h.key,
      value: h.value ? '***' : '',
    }));
  }

  return sanitized;
}

/**
 * Check if authentication configuration contains sensitive data
 */
export function hasSensitiveData(config: AuthConfig): boolean {
  switch (config.type) {
    case 'none':
      return false;
    case 'bearer':
      return !!config.token?.trim();
    case 'apiKey':
      return !!config.apiKey?.trim();
    case 'basic':
      return !!(config.username?.trim() || config.password?.trim());
    case 'custom':
      return !!(config.customHeaders?.some(h => h.value.trim()));
    default:
      return false;
  }
}