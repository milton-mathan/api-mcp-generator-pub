import React, { useState, useCallback } from 'react';
import { 
  LinkIcon, 
  ArrowDownTrayIcon, 
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
  ShieldCheckIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { AuthConfigModal } from './AuthConfigModal';
import type { ChangeEvent, KeyboardEvent } from 'react';

interface UrlInputProps {
  onUrlFetch: (url: string, headers?: Record<string, string>) => void;
  loading?: boolean;
  className?: string;
}

interface CustomHeader {
  id: string;
  key: string;
  value: string;
}

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

export const UrlInput: React.FC<UrlInputProps> = ({
  onUrlFetch,
  loading = false,
  className = '',
}) => {
  const [url, setUrl] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ type: 'none' });
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>([]);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isValidUrl, setIsValidUrl] = useState(false);

  const validateUrl = useCallback((inputUrl: string): boolean => {
    if (!inputUrl.trim()) {
      setUrlError(null);
      return false;
    }

    try {
      const urlObj = new URL(inputUrl);
      
      // Check if it's HTTP or HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setUrlError('URL must use HTTP or HTTPS protocol');
        return false;
      }

      // Check for common API spec file extensions or paths
      const pathname = urlObj.pathname.toLowerCase();
      const hasApiPath = pathname.includes('swagger') || 
                        pathname.includes('openapi') || 
                        pathname.includes('api-docs') ||
                        pathname.endsWith('.json') ||
                        pathname.endsWith('.yaml') ||
                        pathname.endsWith('.yml');

      if (!hasApiPath) {
        setUrlError('URL should point to an API specification file (JSON/YAML) or API docs endpoint');
        return false;
      }

      setUrlError(null);
      return true;
    } catch {
      setUrlError('Please enter a valid URL');
      return false;
    }
  }, []);

  const handleUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    const valid = validateUrl(newUrl);
    setIsValidUrl(valid);
  }, [validateUrl]);

  const addCustomHeader = useCallback(() => {
    const newHeader: CustomHeader = {
      id: Math.random().toString(36).substring(2, 11),
      key: '',
      value: '',
    };
    setCustomHeaders(prev => [...prev, newHeader]);
  }, []);

  const removeCustomHeader = useCallback((id: string) => {
    setCustomHeaders(prev => prev.filter(header => header.id !== id));
  }, []);

  const updateCustomHeader = useCallback((id: string, field: 'key' | 'value', value: string) => {
    setCustomHeaders(prev => prev.map(header => 
      header.id === id ? { ...header, [field]: value } : header
    ));
  }, []);

  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    
    // Add authentication headers based on config
    switch (authConfig.type) {
      case 'bearer':
        if (authConfig.token) {
          headers['Authorization'] = `Bearer ${authConfig.token}`;
        }
        break;
      case 'apiKey':
        if (authConfig.apiKey && authConfig.headerName) {
          if (authConfig.location === 'header') {
            headers[authConfig.headerName] = authConfig.apiKey;
          } else {
            // Use special header format for query parameters
            headers[`__query_param__${authConfig.headerName}`] = authConfig.apiKey;
          }
        }
        break;
      case 'basic':
        if (authConfig.username && authConfig.password) {
          const credentials = btoa(`${authConfig.username}:${authConfig.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case 'custom':
        if (authConfig.customHeaders) {
          authConfig.customHeaders.forEach(header => {
            if (header.key.trim() && header.value.trim()) {
              headers[header.key.trim()] = header.value.trim();
            }
          });
        }
        break;
    }
    
    // Add legacy custom headers (for backward compatibility)
    customHeaders.forEach(header => {
      if (header.key.trim() && header.value.trim()) {
        headers[header.key.trim()] = header.value.trim();
      }
    });

    return headers;
  }, [authConfig, customHeaders]);

  const handleFetch = useCallback(() => {
    if (!isValidUrl || loading) return;

    const headers = getHeaders();
    onUrlFetch(url.trim(), Object.keys(headers).length > 0 ? headers : undefined);
  }, [isValidUrl, loading, url, getHeaders, onUrlFetch]);

  const handleKeyPress = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isValidUrl && !loading) {
      handleFetch();
    }
  }, [isValidUrl, loading, handleFetch]);

  // Common header presets
  const commonHeaders = [
    { key: 'Authorization', placeholder: 'Bearer your-token-here' },
    { key: 'X-API-Key', placeholder: 'your-api-key-here' },
    { key: 'Accept', placeholder: 'application/json' },
    { key: 'User-Agent', placeholder: 'API-Spec-Explorer/1.0' },
  ];

  const addPresetHeader = useCallback((key: string, _placeholder: string) => {
    const newHeader: CustomHeader = {
      id: Math.random().toString(36).substring(2, 11),
      key,
      value: '',
    };
    setCustomHeaders(prev => [...prev, newHeader]);
  }, []);

  const handleAuthConfigSave = useCallback((config: AuthConfig) => {
    setAuthConfig(config);
    // Clear legacy custom headers if using new auth config
    if (config.type !== 'none') {
      setCustomHeaders([]);
    }
  }, []);

  const getAuthSummary = useCallback(() => {
    switch (authConfig.type) {
      case 'bearer':
        return 'Bearer Token';
      case 'apiKey':
        return `API Key (${authConfig.headerName})`;
      case 'basic':
        return 'Basic Auth';
      case 'custom': {
        const count = authConfig.customHeaders?.filter(h => h.key && h.value).length || 0;
        return `${count} Custom Header${count !== 1 ? 's' : ''}`;
      }
      default:
        return 'No Authentication';
    }
  }, [authConfig]);

  const hasAuthentication = useCallback(() => {
    return authConfig.type !== 'none' || customHeaders.some(h => h.key && h.value);
  }, [authConfig, customHeaders]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* URL Input */}
      <div className="space-y-2">
        <label htmlFor="api-url" className="block text-sm font-medium text-gray-700">
          API Specification URL
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LinkIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="api-url"
            type="url"
            value={url}
            onChange={handleUrlChange}
            onKeyPress={handleKeyPress}
            placeholder="https://api.example.com/swagger.json"
            className={`block w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              urlError 
                ? 'border-red-300 bg-red-50' 
                : isValidUrl 
                ? 'border-green-300 bg-green-50' 
                : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {isValidUrl && (
            <button
              onClick={handleFetch}
              disabled={loading}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              ) : (
                <ArrowDownTrayIcon className="h-5 w-5 text-blue-600 hover:text-blue-800" />
              )}
            </button>
          )}
        </div>
        
        {urlError && (
          <div className="flex items-start space-x-2 text-sm text-red-600">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>{urlError}</p>
          </div>
        )}
      </div>

      {/* Authentication Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowAuth(!showAuth)}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800"
          disabled={loading}
        >
          {showAuth ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
          <span>Authentication & Headers</span>
          {hasAuthentication() && (
            <ShieldCheckIcon className="h-4 w-4 text-green-600" />
          )}
        </button>
        
        <div className="flex items-center space-x-2">
          {hasAuthentication() && (
            <span className="text-xs text-green-600 font-medium">
              {getAuthSummary()}
            </span>
          )}
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800"
            disabled={loading}
          >
            <CogIcon className="h-3 w-3" />
            <span>Configure</span>
          </button>
        </div>
      </div>

      {/* Authentication Section */}
      {showAuth && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">Custom Headers</h4>
            <button
              onClick={addCustomHeader}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
              disabled={loading}
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add Header</span>
            </button>
          </div>

          {/* Common header presets */}
          {customHeaders.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Quick add common headers:</p>
              <div className="flex flex-wrap gap-2">
                {commonHeaders.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => addPresetHeader(preset.key, preset.placeholder)}
                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                    disabled={loading}
                  >
                    {preset.key}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom headers list */}
          {customHeaders.length > 0 && (
            <div className="space-y-3">
              {customHeaders.map((header) => (
                <div key={header.id} className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Header name (e.g., Authorization)"
                    value={header.key}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateCustomHeader(header.id, 'key', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder="Header value (e.g., Bearer token123)"
                    value={header.value}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateCustomHeader(header.id, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                  <button
                    onClick={() => removeCustomHeader(header.id)}
                    className="p-2 text-red-600 hover:text-red-800"
                    disabled={loading}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Security notice */}
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
            <strong>Security Notice:</strong> Headers are sent with the request but not stored permanently. 
            Avoid using production API keys in this tool.
          </div>
        </div>
      )}

      {/* Fetch Button */}
      <button
        onClick={handleFetch}
        disabled={!isValidUrl || loading}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          !isValidUrl || loading
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Fetching specification...</span>
          </div>
        ) : (
          'Fetch API Specification'
        )}
      </button>

      {/* Examples */}
      <div className="text-xs text-gray-500">
        <p className="font-medium mb-1">Example URLs:</p>
        <ul className="space-y-1">
          <li>• https://petstore.swagger.io/v2/swagger.json</li>
          <li>• https://api.github.com/swagger.yaml</li>
          <li>• https://your-api.com/docs/openapi.json</li>
        </ul>
      </div>

      {/* Authentication Configuration Modal */}
      <AuthConfigModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSave={handleAuthConfigSave}
        initialConfig={authConfig}
      />
    </div>
  );
};