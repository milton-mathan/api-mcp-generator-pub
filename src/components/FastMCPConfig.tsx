import React from 'react';
import {
  CogIcon,
  ServerIcon,
  GlobeAltIcon,
  CommandLineIcon,
  WrenchScrewdriverIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { MCPConfig } from '../types/mcp';

interface FastMCPConfigProps {
  config: MCPConfig;
  onChange: (config: Partial<MCPConfig>) => void;
  className?: string;
}

export const FastMCPConfig: React.FC<FastMCPConfigProps> = ({
  config,
  onChange,
  className = '',
}) => {
  const handleServerModeChange = (mode: 'stdio' | 'http', enabled: boolean) => {
    const newModes = enabled
      ? [...config.serverModes, mode]
      : config.serverModes.filter(m => m !== mode);
    
    // Ensure at least one mode is selected
    if (newModes.length === 0) {
      return;
    }
    
    onChange({ serverModes: newModes });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* FastMCP Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start space-x-3">
          <CogIcon className="h-6 w-6 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">FastMCP Framework</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Use FastMCP for enhanced performance and developer experience
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.useFastMCP}
                  onChange={(e) => {
                    const useFastMCP = e.target.checked;
                    // If enabling FastMCP, disable HTTP mode as it's not supported
                    if (useFastMCP) {
                      onChange({ 
                        useFastMCP, 
                        serverModes: config.serverModes.filter(mode => mode !== 'http')
                      });
                    } else {
                      onChange({ useFastMCP });
                    }
                  }}
                  aria-label="FastMCP Framework"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {config.useFastMCP && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">FastMCP Benefits:</p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      <li>Enhanced logging and error handling</li>
                      <li>Concise decorator-based tool definitions</li>
                      <li>Better development experience with helper scripts</li>
                      <li>Improved authentication handling</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {config.useFastMCP && (
        <>
          {/* Server Modes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start space-x-3">
              <ServerIcon className="h-6 w-6 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">Server Modes</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Choose which modes your MCP server should support
                </p>
                
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="flex items-center space-x-3" htmlFor="server-mode-stdio">
                      <input
                        id="server-mode-stdio"
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={config.serverModes.includes('stdio')}
                        onChange={(e) => handleServerModeChange('stdio', e.target.checked)}
                        aria-describedby="server-mode-stdio-description"
                      />
                      <div className="flex items-center space-x-2">
                        <CommandLineIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">Stdio Mode</span>
                      </div>
                    </label>
                    <p id="server-mode-stdio-description" className="text-xs text-gray-600 ml-7">
                      For MCP clients like Claude Desktop, Cline, etc.
                    </p>
                  </div>

                  <div className="opacity-60">
                    <label className="flex items-center space-x-3" htmlFor="server-mode-http">
                      <input
                        id="server-mode-http"
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={config.serverModes.includes('http')}
                        onChange={(e) => handleServerModeChange('http', e.target.checked)}
                        // Neither template implements HTTP: FastMCP is stdio-only
                        // and the basic template never parses --http, so the
                        // option produced servers that silently ignored it.
                        disabled
                        aria-describedby="server-mode-http-description"
                      />
                      <div className="flex items-center space-x-2">
                        <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">HTTP Mode</span>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          Not implemented
                        </span>
                      </div>
                    </label>
                    <p id="server-mode-http-description" className="text-xs text-gray-500 ml-7">
                      MCP servers communicate over stdio. Generated servers do not
                      expose an HTTP interface — for that, put a FastAPI or Flask
                      app in front of the generated client code.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HTTP Configuration */}
          {config.serverModes.includes('http') && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start space-x-3">
                <GlobeAltIcon className="h-6 w-6 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">HTTP Configuration</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure HTTP server settings
                  </p>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">
                      HTTP Port
                    </label>
                    <div className="mt-1">
                      <input
                        type="number"
                        min="1000"
                        max="65535"
                        className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={config.httpPort}
                        onChange={(e) => onChange({ httpPort: parseInt(e.target.value) || 8000 })}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Port for HTTP server (default: 8000)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Development Options */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start space-x-3">
              <WrenchScrewdriverIcon className="h-6 w-6 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">Development Options</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Configure development and debugging options
                </p>
                
                <div className="mt-4 space-y-4">
                  {/* Log Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Log Level
                    </label>
                    <select
                      className="mt-1 block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={config.logLevel}
                      onChange={(e) => onChange({ logLevel: e.target.value as FastMCPConfigProps['config']['logLevel'] })}
                    >
                      <option value="DEBUG">DEBUG</option>
                      <option value="INFO">INFO</option>
                      <option value="WARNING">WARNING</option>
                      <option value="ERROR">ERROR</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Logging verbosity level
                    </p>
                  </div>

                  {/* Python Version */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Python Version
                    </label>
                    <select
                      className="mt-1 block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={config.pythonVersion}
                      onChange={(e) => onChange({ pythonVersion: e.target.value as FastMCPConfigProps['config']['pythonVersion'] })}
                    >
                      <option value="3.8">Python 3.8</option>
                      <option value="3.9">Python 3.9</option>
                      <option value="3.10">Python 3.10</option>
                      <option value="3.11">Python 3.11</option>
                      <option value="3.12">Python 3.12</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Target Python version for generated code
                    </p>
                  </div>

                  {/* Helper Scripts */}
                  <div>
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={config.includeRunScripts}
                        onChange={(e) => onChange({ includeRunScripts: e.target.checked })}
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          Include Helper Scripts
                        </span>
                        <p className="text-xs text-gray-600">
                          Generate setup.py, run-stdio.py, and docker-compose.yml
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};