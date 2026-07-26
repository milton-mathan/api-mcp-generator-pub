import React from 'react';
import {
  RocketLaunchIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { ExtractedEndpoint } from '../services/endpointExtractor';

interface MCPGenerationPromptProps {
  selectedEndpoints: ExtractedEndpoint[];
  onClose: () => void;
  onContinue: () => void;
}

export const MCPGenerationPrompt: React.FC<MCPGenerationPromptProps> = ({
  selectedEndpoints,
  onClose,
  onContinue,
}) => {
  const stats = {
    total: selectedEndpoints.length,
    withAuth: selectedEndpoints.filter(e => e.security && e.security.length > 0).length,
    deprecated: selectedEndpoints.filter(e => e.deprecated).length,
    complex: selectedEndpoints.filter(e => e.complexity === 'complex').length,
    withExamples: selectedEndpoints.filter(e => e.hasExamples).length,
  };

  const warnings = [];
  if (stats.deprecated > 0) {
    warnings.push(`${stats.deprecated} deprecated endpoint${stats.deprecated !== 1 ? 's' : ''}`);
  }
  if (stats.complex > 0) {
    warnings.push(`${stats.complex} complex endpoint${stats.complex !== 1 ? 's' : ''}`);
  }
  if (stats.withAuth === 0) {
    warnings.push('No authentication required');
  }

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <RocketLaunchIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Generate MCP Server
            </h3>
            <p className="text-sm text-gray-500">
              Create a Python MCP server from selected endpoints
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
      <div className="p-6">
        {/* Selection Summary */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Selected Endpoints ({stats.total})
          </h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center">
                <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-gray-600">Total endpoints:</span>
                <span className="ml-auto font-medium">{stats.total}</span>
              </div>
              <div className="flex items-center">
                <CheckCircleIcon className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-gray-600">With authentication:</span>
                <span className="ml-auto font-medium">{stats.withAuth}</span>
              </div>
              <div className="flex items-center">
                <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-gray-600">With examples:</span>
                <span className="ml-auto font-medium">{stats.withExamples}</span>
              </div>
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-2" />
                <span className="text-gray-600">Complex endpoints:</span>
                <span className="ml-auto font-medium">{stats.complex}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">
                  Please Review
                </h4>
                <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* What will be generated */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            What will be generated
          </h4>
          <div className="space-y-3">
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Python MCP Server</p>
                <p className="text-sm text-gray-600">
                  Complete server implementation with all selected endpoints as MCP tools
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Tool Definitions</p>
                <p className="text-sm text-gray-600">
                  JSON schema definitions for input/output validation
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Documentation</p>
                <p className="text-sm text-gray-600">
                  README with setup instructions and usage examples
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Configuration Files</p>
                <p className="text-sm text-gray-600">
                  Requirements.txt, .env template, and deployment scripts
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoint Preview */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Endpoint Preview
          </h4>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
            {selectedEndpoints.slice(0, 5).map((endpoint) => (
              <div key={endpoint.id} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                    endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                    endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                    endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-sm font-mono text-gray-900">
                    {endpoint.path}
                  </code>
                </div>
                <div className="flex items-center space-x-2">
                  {endpoint.deprecated && (
                    <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" title="Deprecated" />
                  )}
                  {endpoint.security && endpoint.security.length > 0 && (
                    <CheckCircleIcon className="h-4 w-4 text-blue-500" title="Requires Authentication" />
                  )}
                  {endpoint.hasExamples && (
                    <CheckCircleIcon className="h-4 w-4 text-green-500" title="Has Examples" />
                  )}
                </div>
              </div>
            ))}
            {selectedEndpoints.length > 5 && (
              <div className="p-3 text-center text-sm text-gray-500">
                +{selectedEndpoints.length - 5} more endpoints...
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">
                Next Steps
              </h4>
              <p className="mt-1 text-sm text-blue-700">
                You'll be able to preview and customize the generated MCP tools before downloading the complete project.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        <button
          onClick={onContinue}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Continue to Preview
        </button>
      </div>
    </div>
  );
};