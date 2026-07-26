import React, { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { ExtractedEndpoint } from '../services/endpointExtractor';

export interface MCPAuthConfigType {
  type: 'none' | 'apiKey' | 'bearer' | 'basic' | 'oauth2' | 'custom';
  envVarName: string;
  location?: 'header' | 'query';
  headerName?: string;
  description?: string;
  required: boolean;
}

interface MCPAuthConfigProps {
  endpoint: ExtractedEndpoint;
  config: MCPAuthConfigType;
  onChange: (config: MCPAuthConfigType) => void;
  className?: string;
}

export const MCPAuthConfig: React.FC<MCPAuthConfigProps> = ({
  endpoint,
  config,
  onChange,
  className = '',
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEnvPreview, setShowEnvPreview] = useState(false);

  // Auto-detect authentication from endpoint security requirements
  useEffect(() => {
    if (endpoint.security && endpoint.security.length > 0 && config.type === 'none') {
      const firstSecurity = endpoint.security[0];
      const securityName = Object.keys(firstSecurity)[0];
      
      // Try to infer auth type from security scheme name
      if (securityName.toLowerCase().includes('bearer') || securityName.toLowerCase().includes('jwt')) {
        onChange({
          ...config,
          type: 'bearer',
          envVarName: `${securityName.toUpperCase()}_TOKEN`,
          headerName: 'Authorization',
          location: 'header',
          required: true,
          description: `Bearer token for ${securityName}`,
        });
      } else if (securityName.toLowerCase().includes('api') || securityName.toLowerCase().includes('key')) {
        onChange({
          ...config,
          type: 'apiKey',
          envVarName: `${securityName.toUpperCase()}_KEY`,
          headerName: 'X-API-Key',
          location: 'header',
          required: true,
          description: `API key for ${securityName}`,
        });
      } else {
        onChange({
          ...config,
          type: 'custom',
          envVarName: `${securityName.toUpperCase()}_AUTH`,
          headerName: 'Authorization',
          location: 'header',
          required: true,
          description: `Authentication for ${securityName}`,
        });
      }
    }
  }, [endpoint.security, config.type, onChange]);

  const handleTypeChange = (type: MCPAuthConfigType['type']) => {
    const baseEnvName = endpoint.operationId 
      ? endpoint.operationId.toUpperCase().replace(/[^A-Z0-9]/g, '_')
      : endpoint.path.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

    let newConfig: MCPAuthConfigType = {
      ...config,
      type,
      required: type !== 'none',
    };

    switch (type) {
      case 'none':
        newConfig = {
          type: 'none',
          envVarName: '',
          required: false,
        };
        break;
      case 'bearer':
        newConfig = {
          ...newConfig,
          envVarName: `${baseEnvName}_TOKEN`,
          headerName: 'Authorization',
          location: 'header',
          description: 'Bearer token for authentication',
        };
        break;
      case 'apiKey':
        newConfig = {
          ...newConfig,
          envVarName: `${baseEnvName}_API_KEY`,
          headerName: 'X-API-Key',
          location: 'header',
          description: 'API key for authentication',
        };
        break;
      case 'basic':
        newConfig = {
          ...newConfig,
          envVarName: `${baseEnvName}_BASIC_AUTH`,
          headerName: 'Authorization',
          location: 'header',
          description: 'Basic authentication (base64 encoded username:password)',
        };
        break;
      case 'oauth2':
        newConfig = {
          ...newConfig,
          envVarName: `${baseEnvName}_ACCESS_TOKEN`,
          headerName: 'Authorization',
          location: 'header',
          description: 'OAuth2 access token',
        };
        break;
      case 'custom':
        newConfig = {
          ...newConfig,
          envVarName: `${baseEnvName}_AUTH`,
          headerName: 'Authorization',
          location: 'header',
          description: 'Custom authentication header',
        };
        break;
    }

    onChange(newConfig);
  };

  const getEnvExample = () => {
    if (config.type === 'none') return '';
    
    switch (config.type) {
      case 'bearer':
        return `${config.envVarName}=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;
      case 'apiKey':
        return `${config.envVarName}=your-api-key-here`;
      case 'basic':
        return `${config.envVarName}=dXNlcm5hbWU6cGFzc3dvcmQ=`;
      case 'oauth2':
        return `${config.envVarName}=ya29.a0AfH6SMC...`;
      case 'custom':
        return `${config.envVarName}=your-auth-value`;
      default:
        return `${config.envVarName}=your-value`;
    }
  };

  const getSecurityInfo = () => {
    if (!endpoint.security || endpoint.security.length === 0) {
      return {
        detected: false,
        schemes: [],
        message: 'No authentication requirements detected in the API specification.',
      };
    }

    const schemes = endpoint.security.flatMap(sec => Object.keys(sec));
    return {
      detected: true,
      schemes,
      message: `Detected security schemes: ${schemes.join(', ')}`,
    };
  };

  const securityInfo = getSecurityInfo();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
          <h4 className="text-sm font-medium text-gray-900">Authentication Configuration</h4>
        </div>
        {config.required && (
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
            Required
          </span>
        )}
      </div>

      {/* Security Detection Info */}
      <div className={`p-3 rounded-lg border ${
        securityInfo.detected 
          ? 'bg-blue-50 border-blue-200' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-start space-x-2">
          <InformationCircleIcon className={`h-4 w-4 mt-0.5 ${
            securityInfo.detected ? 'text-blue-500' : 'text-gray-400'
          }`} />
          <div>
            <p className="text-xs text-gray-700">{securityInfo.message}</p>
            {securityInfo.detected && (
              <p className="text-xs text-blue-600 mt-1">
                Configuration has been auto-detected and pre-filled below.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Authentication Type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Authentication Type
        </label>
        <select
          value={config.type}
          onChange={(e) => handleTypeChange(e.target.value as MCPAuthConfigType['type'])}
          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="none">No Authentication</option>
          <option value="bearer">Bearer Token (JWT)</option>
          <option value="apiKey">API Key</option>
          <option value="basic">Basic Authentication</option>
          <option value="oauth2">OAuth2</option>
          <option value="custom">Custom Header</option>
        </select>
      </div>

      {config.type !== 'none' && (
        <>
          {/* Environment Variable Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Environment Variable Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={config.envVarName}
                onChange={(e) => onChange({ ...config, envVarName: e.target.value })}
                className="block w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="API_KEY"
              />
              <button
                type="button"
                onClick={() => setShowEnvPreview(!showEnvPreview)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showEnvPreview ? (
                  <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                ) : (
                  <EyeIcon className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            {showEnvPreview && (
              <div className="mt-2 p-2 bg-gray-900 text-gray-100 rounded text-xs font-mono">
                {getEnvExample()}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={config.description || ''}
              onChange={(e) => onChange({ ...config, description: e.target.value })}
              rows={2}
              className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Description of this authentication method..."
            />
          </div>

          {/* Advanced Configuration */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-xs text-blue-600 hover:text-blue-800"
            >
              <span>Advanced Configuration</span>
              <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
                {/* Header Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Header Name
                  </label>
                  <input
                    type="text"
                    value={config.headerName || ''}
                    onChange={(e) => onChange({ ...config, headerName: e.target.value })}
                    className="block w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Authorization"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <select
                    value={config.location || 'header'}
                    onChange={(e) => onChange({ ...config, location: e.target.value as 'header' | 'query' })}
                    className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="header">HTTP Header</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>

                {/* Required Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`required-${endpoint.id}`}
                    checked={config.required}
                    onChange={(e) => onChange({ ...config, required: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`required-${endpoint.id}`} className="text-xs text-gray-700">
                    Required for this endpoint
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Security Warning */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-yellow-800">Security Notice</p>
                <p className="text-xs text-yellow-700 mt-1">
                  The authentication value will be stored in an environment variable. 
                  Never commit secrets to version control. Use secure secret management 
                  in production environments.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};