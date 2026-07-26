import React, { useState } from 'react';
import {
  XMarkIcon,
  ClipboardDocumentIcon,
  CodeBracketIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { ExtractedEndpoint, Parameter, Response } from '../types';

interface EndpointDetailProps {
  endpoint: ExtractedEndpoint;
  onClose: () => void;
  className?: string;
}

interface ParameterTableProps {
  parameters: Parameter[];
  title: string;
}

interface ResponseTableProps {
  responses: Record<string, Response>;
}

const ParameterTable: React.FC<ParameterTableProps> = ({ parameters, title }) => {
  if (parameters.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-gray-900 mb-3">{title}</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Required
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {parameters.map((param) => (
              <tr key={param.name}>
                <td className="px-3 py-2 text-sm">
                  <code className="text-blue-600 font-mono">{param.name}</code>
                </td>
                <td className="px-3 py-2 text-sm text-gray-600">
                  {param.schema?.type || 'string'}
                  {param.schema?.format && (
                    <span className="text-gray-400 ml-1">({param.schema.format})</span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm">
                  {param.required ? (
                    <span className="text-red-600 font-medium">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-gray-600">
                  {param.description || 'No description'}
                  {param.example && (
                    <div className="mt-1">
                      <span className="text-xs text-gray-500">Example: </span>
                      <code className="text-xs bg-gray-100 px-1 rounded">
                        {JSON.stringify(param.example)}
                      </code>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ResponseTable: React.FC<ResponseTableProps> = ({ responses }) => {
  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Responses</h4>
      <div className="space-y-3">
        {Object.entries(responses).map(([statusCode, response]) => (
          <div key={statusCode} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <span
                className={`px-2 py-1 text-xs font-medium rounded mr-2 ${
                  statusCode.startsWith('2')
                    ? 'bg-green-100 text-green-800'
                    : statusCode.startsWith('4')
                    ? 'bg-yellow-100 text-yellow-800'
                    : statusCode.startsWith('5')
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {statusCode}
              </span>
              <span className="text-sm text-gray-900">{response.description}</span>
            </div>
            
            {response.content && (
              <div className="mt-2">
                <span className="text-xs text-gray-500">Content Types:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.keys(response.content).map((contentType) => (
                    <code key={contentType} className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {contentType}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const EndpointDetail: React.FC<EndpointDetailProps> = ({
  endpoint,
  onClose,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'parameters' | 'responses' | 'examples'>('overview');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const methodColor = {
    GET: 'bg-green-100 text-green-800 border-green-200',
    POST: 'bg-blue-100 text-blue-800 border-blue-200',
    PUT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    DELETE: 'bg-red-100 text-red-800 border-red-200',
    PATCH: 'bg-purple-100 text-purple-800 border-purple-200',
    HEAD: 'bg-gray-100 text-gray-800 border-gray-200',
    OPTIONS: 'bg-gray-100 text-gray-800 border-gray-200',
    TRACE: 'bg-gray-100 text-gray-800 border-gray-200',
  }[endpoint.method] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 text-sm font-medium rounded border ${methodColor}`}>
            {endpoint.method}
          </span>
          <div>
            <div className="flex items-center">
              <code className="text-lg font-mono text-gray-900">{endpoint.path}</code>
              <button
                onClick={() => copyToClipboard(endpoint.path)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                title="Copy path"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
              </button>
            </div>
            {endpoint.summary && (
              <p className="text-sm text-gray-600 mt-1">{endpoint.summary}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {endpoint.deprecated && (
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" title="Deprecated" />
          )}
          {endpoint.security && endpoint.security.length > 0 && (
            <ShieldCheckIcon className="h-5 w-5 text-blue-500" title="Requires Authentication" />
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'parameters', label: `Parameters (${endpoint.parameters?.length || 0})` },
            { id: 'responses', label: `Responses (${Object.keys(endpoint.responses).length})` },
            { id: 'examples', label: 'Examples' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {endpoint.description && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-sm text-gray-600">{endpoint.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Details</h4>
                <dl className="space-y-1 text-sm">
                  {endpoint.operationId && (
                    <>
                      <dt className="text-gray-500">Operation ID:</dt>
                      <dd className="font-mono text-gray-900">{endpoint.operationId}</dd>
                    </>
                  )}
                  <dt className="text-gray-500">Complexity:</dt>
                  <dd className={`capitalize ${
                    endpoint.complexity === 'simple' ? 'text-green-600' :
                    endpoint.complexity === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {endpoint.complexity}
                  </dd>
                  <dt className="text-gray-500">Response Size:</dt>
                  <dd className="capitalize text-gray-900">{endpoint.estimatedResponseSize}</dd>
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Characteristics</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-500 w-20">Safe:</span>
                    <span className={endpoint.safe ? 'text-green-600' : 'text-gray-600'}>
                      {endpoint.safe ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500 w-20">Idempotent:</span>
                    <span className={endpoint.idempotent ? 'text-green-600' : 'text-gray-600'}>
                      {endpoint.idempotent ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500 w-20">Cacheable:</span>
                    <span className={endpoint.cacheable ? 'text-green-600' : 'text-gray-600'}>
                      {endpoint.cacheable ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {endpoint.tags && endpoint.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {endpoint.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {endpoint.securitySchemes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Security</h4>
                <div className="flex flex-wrap gap-1">
                  {endpoint.securitySchemes.map((scheme) => (
                    <span
                      key={scheme}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded flex items-center"
                    >
                      <ShieldCheckIcon className="h-3 w-3 mr-1" />
                      {scheme}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'parameters' && (
          <div>
            <ParameterTable parameters={endpoint.pathParameters} title="Path Parameters" />
            <ParameterTable parameters={endpoint.queryParameters} title="Query Parameters" />
            <ParameterTable parameters={endpoint.headerParameters} title="Header Parameters" />
            <ParameterTable parameters={endpoint.cookieParameters} title="Cookie Parameters" />
            
            {endpoint.hasRequestBody && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Request Body</h4>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex items-center mb-2">
                    <CodeBracketIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm font-medium">Request body required</span>
                  </div>
                  {endpoint.requestBody?.content && (
                    <div className="text-xs text-gray-600">
                      Content types: {Object.keys(endpoint.requestBody.content).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'responses' && (
          <ResponseTable responses={endpoint.responses} />
        )}

        {activeTab === 'examples' && (
          <div>
            {endpoint.hasExamples ? (
              <div className="space-y-4">
                <div className="flex items-center text-green-600">
                  <InformationCircleIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">Examples are available for this endpoint</span>
                </div>
                <p className="text-sm text-gray-600">
                  Examples can be found in the parameter definitions and response schemas above.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <CodeBracketIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">No examples available for this endpoint</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};