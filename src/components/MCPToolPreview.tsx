import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  StarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import type { MCPCandidate } from '../services/endpointService';
import { MCPAuthConfig, type MCPAuthConfigType } from './MCPAuthConfig';
import { AuthConfigService, type AuthConfigMap } from '../services/authConfigService';

interface MCPToolPreviewProps {
  candidates: MCPCandidate[];
  onClose: () => void;
  onGenerate: () => void;
}

interface ToolConfig {
  name: string;
  description: string;
  enabled: boolean;
  customName?: string;
}

type TabType = 'config' | 'auth' | 'schema';

export const MCPToolPreview: React.FC<MCPToolPreviewProps> = ({
  candidates,
  onClose,
  onGenerate,
}) => {
  const [toolConfigs, setToolConfigs] = useState<Record<string, ToolConfig>>(() => {
    const configs: Record<string, ToolConfig> = {};
    candidates.forEach((candidate) => {
      configs[candidate.endpoint.id] = {
        name: candidate.toolName,
        description: candidate.endpoint.summary || candidate.endpoint.description || `${candidate.endpoint.method} ${candidate.endpoint.path}`,
        enabled: candidate.suitabilityScore >= 60, // Auto-enable high-scoring candidates
      };
    });
    return configs;
  });

  const [authConfigs, setAuthConfigs] = useState<AuthConfigMap>(() => {
    return AuthConfigService.generateConfigMap(candidates.map(c => c.endpoint));
  });

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('config');

  const enabledTools = useMemo(() => {
    return Object.entries(toolConfigs).filter(([_, config]) => config.enabled);
  }, [toolConfigs]);

  const authSummary = useMemo(() => {
    const enabledEndpoints = enabledTools.map(([id]) => id);
    const enabledAuthConfigs: AuthConfigMap = {};
    enabledEndpoints.forEach(id => {
      enabledAuthConfigs[id] = authConfigs[id];
    });
    return AuthConfigService.getAuthSummary(enabledAuthConfigs);
  }, [enabledTools, authConfigs]);

  const selectedCandidate = useMemo(() => {
    return selectedTool ? candidates.find(c => c.endpoint.id === selectedTool) : null;
  }, [selectedTool, candidates]);

  const handleToolToggle = (endpointId: string) => {
    setToolConfigs(prev => ({
      ...prev,
      [endpointId]: {
        ...prev[endpointId],
        enabled: !prev[endpointId].enabled,
      },
    }));
  };

  const handleToolNameChange = (endpointId: string, name: string) => {
    setToolConfigs(prev => ({
      ...prev,
      [endpointId]: {
        ...prev[endpointId],
        customName: name,
        name: name || prev[endpointId].name,
      },
    }));
  };

  const handleToolDescriptionChange = (endpointId: string, description: string) => {
    setToolConfigs(prev => ({
      ...prev,
      [endpointId]: {
        ...prev[endpointId],
        description,
      },
    }));
  };

  const handleAuthConfigChange = (endpointId: string, config: MCPAuthConfigType) => {
    setAuthConfigs(prev => ({
      ...prev,
      [endpointId]: config,
    }));
  };

  const getSuitabilityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSuitabilityBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="bg-white max-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <CogIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              MCP Tool Preview & Configuration
            </h3>
            <p className="text-sm text-gray-500">
              Review and customize your MCP tools before generation
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Tool List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-900">
                  Available Tools ({candidates.length})
                </h4>
                <span className="text-xs text-gray-500">
                  {enabledTools.length} enabled
                </span>
              </div>

              <div className="space-y-2">
                {candidates.map((candidate) => {
                  const config = toolConfigs[candidate.endpoint.id];
                  const isSelected = selectedTool === candidate.endpoint.id;
                  
                  return (
                    <div
                      key={candidate.endpoint.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedTool(candidate.endpoint.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={() => handleToolToggle(candidate.endpoint.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-sm font-medium text-gray-900 truncate">
                              {config.customName || candidate.toolName}
                            </h5>
                            <div className="flex items-center space-x-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSuitabilityBadge(candidate.suitabilityScore)}`}>
                                {candidate.suitabilityScore}%
                              </span>
                              {candidate.suitabilityScore >= 80 && (
                                <StarIcon className="h-3 w-3 text-yellow-500" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              candidate.endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                              candidate.endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                              candidate.endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                              candidate.endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {candidate.endpoint.method}
                            </span>
                            <code className="text-xs font-mono text-gray-600 truncate">
                              {candidate.endpoint.path}
                            </code>
                          </div>
                          
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {config.description}
                          </p>
                          
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {candidate.warnings.length > 0 && (
                                <div className="flex items-center">
                                  <ExclamationTriangleIcon className="h-3 w-3 text-yellow-500 mr-1" />
                                  <span className="text-xs text-yellow-600">
                                    {candidate.warnings.length} warning{candidate.warnings.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              {authConfigs[candidate.endpoint.id]?.type !== 'none' && (
                                <div className="flex items-center">
                                  <ShieldCheckIcon className="h-3 w-3 text-blue-500" />
                                  <span className="text-xs text-blue-600 ml-1">Auth</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tool Details */}
          <div className="w-1/2 overflow-y-auto">
            {selectedCandidate ? (
              <div className="p-4">
                {/* Tab Navigation */}
                <div className="mb-4">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                      <button
                        onClick={() => setActiveTab('config')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'config'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Configuration
                      </button>
                      <button
                        onClick={() => setActiveTab('auth')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                          activeTab === 'auth'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <ShieldCheckIcon className="h-4 w-4 mr-1" />
                        Authentication
                        {authConfigs[selectedCandidate.endpoint.id]?.type !== 'none' && (
                          <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('schema')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'schema'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Schema
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'config' && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      Tool Configuration
                    </h4>
                  
                    <div className="space-y-4">
                      {/* Tool Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Tool Name
                        </label>
                        <input
                          type="text"
                          value={toolConfigs[selectedCandidate.endpoint.id].customName || selectedCandidate.toolName}
                          onChange={(e) => handleToolNameChange(selectedCandidate.endpoint.id, e.target.value)}
                          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={selectedCandidate.toolName}
                        />
                      </div>

                      {/* Tool Description */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={toolConfigs[selectedCandidate.endpoint.id].description}
                          onChange={(e) => handleToolDescriptionChange(selectedCandidate.endpoint.id, e.target.value)}
                          rows={3}
                          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'auth' && (
                  <MCPAuthConfig
                    endpoint={selectedCandidate.endpoint}
                    config={authConfigs[selectedCandidate.endpoint.id]}
                    onChange={(config) => handleAuthConfigChange(selectedCandidate.endpoint.id, config)}
                  />
                )}

                {activeTab === 'schema' && (
                  <div className="space-y-4">

                    {/* Suitability Score */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700">Suitability Score</span>
                        <span className={`text-sm font-bold ${getSuitabilityColor(selectedCandidate.suitabilityScore)}`}>
                          {selectedCandidate.suitabilityScore}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            selectedCandidate.suitabilityScore >= 80 ? 'bg-green-500' :
                            selectedCandidate.suitabilityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${selectedCandidate.suitabilityScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Reasons */}
                    {selectedCandidate.reasons.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-xs font-medium text-gray-700 mb-2">
                          Why this endpoint is suitable:
                        </h5>
                        <ul className="space-y-1">
                          {selectedCandidate.reasons.map((reason, index) => (
                            <li key={index} className="flex items-start">
                              <CheckCircleIcon className="h-3 w-3 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-600">{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warnings */}
                    {selectedCandidate.warnings.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-xs font-medium text-gray-700 mb-2">
                          Considerations:
                        </h5>
                        <ul className="space-y-1">
                          {selectedCandidate.warnings.map((warning, index) => (
                            <li key={index} className="flex items-start">
                              <ExclamationTriangleIcon className="h-3 w-3 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-600">{warning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Endpoint Details */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-700 mb-2">
                        Endpoint Details
                      </h5>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Method:</span>
                          <span className="font-medium">{selectedCandidate.endpoint.method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Path:</span>
                          <code className="font-mono text-gray-900">{selectedCandidate.endpoint.path}</code>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Parameters:</span>
                          <span className="font-medium">{selectedCandidate.endpoint.parameters?.length || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Complexity:</span>
                          <span className={`font-medium capitalize ${
                            selectedCandidate.endpoint.complexity === 'simple' ? 'text-green-600' :
                            selectedCandidate.endpoint.complexity === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {selectedCandidate.endpoint.complexity}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Generated Schema Preview */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-700 mb-2">
                        Input Schema Preview
                      </h5>
                      <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                        <pre>{JSON.stringify({
                          type: "object",
                          properties: selectedCandidate.endpoint.parameters?.reduce((acc, param) => {
                            acc[param.name] = {
                              type: param.schema?.type || "string",
                              description: param.description,
                              required: param.required
                            };
                            return acc;
                          }, {} as Record<string, { type: string; description?: string; required?: boolean }>) || {},
                          required: selectedCandidate.endpoint.parameters?.filter(p => p.required).map(p => p.name) || []
                        }, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <CogIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm">Select a tool to configure</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm text-gray-600">
              {enabledTools.length} of {candidates.length} tools will be generated
            </div>
            {authSummary.authRequired > 0 && (
              <div className="flex items-center text-xs text-gray-500">
                <ShieldCheckIcon className="h-3 w-3 mr-1" />
                {authSummary.authRequired} tools require authentication
                {authSummary.envVarsNeeded > 0 && (
                  <span className="ml-2">
                    ({authSummary.envVarsNeeded} env var{authSummary.envVarsNeeded !== 1 ? 's' : ''} needed)
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              onClick={onGenerate}
              disabled={enabledTools.length === 0}
              className={`px-4 py-2 text-sm font-medium rounded-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                enabledTools.length > 0
                  ? 'text-white bg-blue-600 border border-transparent hover:bg-blue-700'
                  : 'text-gray-400 bg-gray-100 border border-gray-300 cursor-not-allowed'
              }`}
            >
              Generate MCP Server ({enabledTools.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};