import React, { useState } from 'react';
import {
  RocketLaunchIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import type { InputMetadata, ParsedSpec } from '../types';
import { extractEndpoints, type ExtractedEndpoint } from '../services/endpointExtractor';

interface ApiExplorerProps {
  spec: ParsedSpec | null | undefined;
  metadata: InputMetadata | null | undefined;
  /** Non-blocking notices from the parser and validator. */
  warnings?: string[];
  onBack: () => void;
  onGenerateMCP: (selectedEndpoints: ExtractedEndpoint[]) => void;
}

export const ApiExplorer: React.FC<ApiExplorerProps> = ({
  spec,
  metadata,
  warnings = [],
  onBack,
  onGenerateMCP,
}) => {
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());
  const [showWarnings, setShowWarnings] = useState(true);

  // Use the shared extractor rather than walking `paths` here: it resolves
  // parameters, request bodies and responses across OpenAPI 3.x and Swagger
  // 2.0, all of which the generator needs downstream.
  const endpoints = React.useMemo<ExtractedEndpoint[]>(
    () => (spec ? extractEndpoints(spec) : []),
    [spec],
  );

  const handleEndpointToggle = (endpointId: string) => {
    const newSelected = new Set(selectedEndpoints);
    if (newSelected.has(endpointId)) {
      newSelected.delete(endpointId);
    } else {
      newSelected.add(endpointId);
    }
    setSelectedEndpoints(newSelected);
  };

  const allSelected =
    endpoints.length > 0 && selectedEndpoints.size === endpoints.length;
  const someSelected = selectedEndpoints.size > 0 && !allSelected;

  const handleToggleAll = () => {
    setSelectedEndpoints(
      allSelected ? new Set() : new Set(endpoints.map(e => e.id))
    );
  };

  // `indeterminate` is a DOM property with no HTML attribute, so React cannot
  // set it via JSX - it has to be assigned on the node.
  const selectAllRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  // Pass the endpoint objects themselves. Passing ids forced the generator to
  // reconstruct paths by splitting strings, which corrupted every path and
  // dropped every parameter.
  const handleGenerateMCP = () => {
    onGenerateMCP(endpoints.filter(e => selectedEndpoints.has(e.id)));
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">API Explorer</h2>
            <p className="text-gray-600">
              {spec?.info?.title || 'API Specification'} - {endpoints.length} endpoints
            </p>
          </div>
        </div>

        {selectedEndpoints.size > 0 && (
          <button
            onClick={handleGenerateMCP}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RocketLaunchIcon className="h-4 w-4 mr-2" />
            Generate MCP Server ({selectedEndpoints.size})
          </button>
        )}
      </div>

      {/* Parser and validator notices. These are advisory: the spec loaded, but
          something in it is questionable. Blocking errors never reach here -
          they are reported at the input stage. */}
      {warnings.length > 0 && showWarnings && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-900">
                {warnings.length} specification warning{warnings.length !== 1 ? 's' : ''}
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700">
                These do not block generation.
              </p>
            </div>
            <button
              onClick={() => setShowWarnings(false)}
              aria-label="Dismiss warnings"
              className="ml-4 text-amber-700 hover:text-amber-900"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </div>
      )}

      {/* API Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {spec?.info?.title || 'API Specification'}
        </h3>
        <p className="text-gray-600 mb-4">
          {spec?.info?.description || 'No description available'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Version:</span>
            <span className="ml-2 font-medium">{spec?.info?.version || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">OpenAPI:</span>
            <span className="ml-2 font-medium">{spec?.version || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">Endpoints:</span>
            <span className="ml-2 font-medium">{endpoints.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Source:</span>
            <span className="ml-2 font-medium capitalize">{metadata?.source || 'Unknown'}</span>
          </div>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Endpoints</h3>
              <p className="text-sm text-gray-600">
                Select endpoints to include in your MCP server
              </p>
            </div>

            {endpoints.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleToggleAll}
                  aria-label={
                    allSelected
                      ? `Deselect all ${endpoints.length} endpoints`
                      : `Select all ${endpoints.length} endpoints`
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                {allSelected ? 'Deselect all' : 'Select all'}
                <span className="text-gray-500">
                  ({selectedEndpoints.size}/{endpoints.length})
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {endpoints.map((endpoint) => (
            <div key={endpoint.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={selectedEndpoints.has(endpoint.id)}
                  onChange={() => handleEndpointToggle(endpoint.id)}
                  // Without a name these read as bare "checkbox" to a screen
                  // reader, and tests could only reach them by index.
                  aria-label={`Select ${endpoint.method} ${endpoint.path}`}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
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
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    {endpoint.summary}
                  </h4>
                  {endpoint.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {endpoint.description}
                    </p>
                  )}
                  {endpoint.operationId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Operation ID: {endpoint.operationId}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {endpoints.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            <p>No endpoints found in this specification.</p>
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedEndpoints.size > 0 && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-green-900">
                {selectedEndpoints.size} endpoint{selectedEndpoints.size !== 1 ? 's' : ''} selected
              </h4>
              <p className="text-sm text-green-700">
                Ready to generate your MCP server
              </p>
            </div>
            <button
              onClick={handleGenerateMCP}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Generate MCP Server
            </button>
          </div>
        </div>
      )}
    </div>
  );
};