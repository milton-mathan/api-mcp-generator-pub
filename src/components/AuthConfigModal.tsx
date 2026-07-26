import React, { useState, useCallback, useEffect } from 'react';
import {
  XMarkIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { ChangeEvent } from 'react';

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

interface AuthConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AuthConfig) => void;
  initialConfig?: AuthConfig;
}

export const AuthConfigModal: React.FC<AuthConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}) => {
  const [authType, setAuthType] = useState<AuthConfig['type']>('none');
  const [token, setToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [headerName, setHeaderName] = useState('X-API-Key');
  const [location, setLocation] = useState<'header' | 'query'>('header');
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Initialize form with existing config
  useEffect(() => {
    if (initialConfig) {
      setAuthType(initialConfig.type);
      setToken(initialConfig.token || '');
      setApiKey(initialConfig.apiKey || '');
      setUsername(initialConfig.username || '');
      setPassword(initialConfig.password || '');
      setHeaderName(initialConfig.headerName || 'X-API-Key');
      setLocation(initialConfig.location || 'header');
      setCustomHeaders(initialConfig.customHeaders || []);
    }
  }, [initialConfig]);

  const handleSave = useCallback(() => {
    const config: AuthConfig = {
      type: authType,
    };

    switch (authType) {
      case 'bearer':
        config.token = token;
        break;
      case 'apiKey':
        config.apiKey = apiKey;
        config.headerName = headerName;
        config.location = location;
        break;
      case 'basic':
        config.username = username;
        config.password = password;
        break;
      case 'custom':
        config.customHeaders = customHeaders.filter(h => h.key && h.value);
        break;
    }

    onSave(config);
    onClose();
  }, [authType, token, apiKey, headerName, location, username, password, customHeaders, onSave, onClose]);

  const addCustomHeader = useCallback(() => {
    setCustomHeaders(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const removeCustomHeader = useCallback((index: number) => {
    setCustomHeaders(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateCustomHeader = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setCustomHeaders(prev => prev.map((header, i) => 
      i === index ? { ...header, [field]: value } : header
    ));
  }, []);

  const isValid = useCallback(() => {
    switch (authType) {
      case 'none':
        return true;
      case 'bearer':
        return token.trim().length > 0;
      case 'apiKey':
        return apiKey.trim().length > 0 && headerName.trim().length > 0;
      case 'basic':
        return username.trim().length > 0 && password.trim().length > 0;
      case 'custom':
        return customHeaders.some(h => h.key.trim() && h.value.trim());
      default:
        return false;
    }
  }, [authType, token, apiKey, headerName, username, password, customHeaders]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Authentication Configuration
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Auth type selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Authentication Type
              </label>
              <select
                value={authType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setAuthType(e.target.value as AuthConfig['type'])}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="apiKey">API Key</option>
                <option value="basic">Basic Authentication</option>
                <option value="custom">Custom Headers</option>
              </select>
            </div>

            {/* Auth configuration based on type */}
            {authType === 'bearer' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bearer Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
                      placeholder="Enter your bearer token"
                      className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showToken ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Will be sent as: Authorization: Bearer {token ? '***' : '[token]'}
                  </p>
                </div>
              </div>
            )}

            {authType === 'apiKey' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Header Name
                  </label>
                  <input
                    type="text"
                    value={headerName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setHeaderName(e.target.value)}
                    placeholder="X-API-Key"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <select
                    value={location}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setLocation(e.target.value as 'header' | 'query')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500">
                  Will be sent as: {location === 'header' ? `${headerName}: ***` : `?${headerName}=***`}
                </p>
              </div>
            )}

            {authType === 'basic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Will be sent as: Authorization: Basic [base64-encoded credentials]
                </p>
              </div>
            )}

            {authType === 'custom' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Custom Headers
                  </label>
                  <button
                    onClick={addCustomHeader}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Add Header
                  </button>
                </div>
                {customHeaders.map((header, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Header name"
                      value={header.key}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateCustomHeader(index, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Header value"
                      value={header.value}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateCustomHeader(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => removeCustomHeader(index)}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {customHeaders.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No custom headers configured. Click "Add Header" to get started.
                  </p>
                )}
              </div>
            )}

            {/* Security warning */}
            <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex">
                <InformationCircleIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-amber-800">
                    Security Notice
                  </h4>
                  <p className="mt-1 text-sm text-amber-700">
                    Authentication credentials are only used for this request and are not stored permanently. 
                    Avoid using production credentials when possible.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={handleSave}
              disabled={!isValid()}
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${
                isValid()
                  ? 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Save Configuration
            </button>
            <button
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};