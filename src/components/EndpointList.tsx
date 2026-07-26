import React, { useState, useMemo } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  EyeIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type { ExtractedEndpoint } from '../services/endpointExtractor';

interface EndpointListProps {
  endpoints: ExtractedEndpoint[];
  selectedEndpoints: Set<string>;
  onEndpointSelect: (endpointId: string) => void;
  onEndpointToggle: (endpointId: string) => void;
  className?: string;
}

interface EndpointItemProps {
  endpoint: ExtractedEndpoint;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

const methodColors = {
  GET: 'bg-green-100 text-green-800 border-green-200',
  POST: 'bg-blue-100 text-blue-800 border-blue-200',
  PUT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
  PATCH: 'bg-purple-100 text-purple-800 border-purple-200',
  HEAD: 'bg-gray-100 text-gray-800 border-gray-200',
  OPTIONS: 'bg-gray-100 text-gray-800 border-gray-200',
  TRACE: 'bg-gray-100 text-gray-800 border-gray-200',
};

const complexityColors = {
  simple: 'text-green-600',
  moderate: 'text-yellow-600',
  complex: 'text-red-600',
};

const EndpointItem: React.FC<EndpointItemProps> = ({
  endpoint,
  isSelected,
  onSelect,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const methodColor = methodColors[endpoint.method] || methodColors.GET;
  const complexityColor = complexityColors[endpoint.complexity];

  return (
    <div className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
      {/* Main endpoint row */}
      <div className="flex items-center p-4 hover:bg-gray-50 cursor-pointer">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
        />

        {/* Expand/Collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mr-3 p-1 hover:bg-gray-200 rounded"
        >
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {/* Method badge */}
        <span className={`px-2 py-1 text-xs font-medium rounded border ${methodColor} mr-3`}>
          {endpoint.method}
        </span>

        {/* Path and summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <code className="text-sm font-mono text-gray-900 mr-2">
              {endpoint.path}
            </code>
            {endpoint.deprecated && (
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-1" title="Deprecated" />
            )}
            {endpoint.security && endpoint.security.length > 0 && (
              <ShieldCheckIcon className="h-4 w-4 text-blue-500 mr-1" title="Requires Authentication" />
            )}
            {endpoint.hasExamples && (
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" title="Has Examples" />
            )}
          </div>
          {endpoint.summary && (
            <p className="text-sm text-gray-600 mt-1 truncate">
              {endpoint.summary}
            </p>
          )}
        </div>

        {/* Complexity indicator */}
        <div className="flex items-center ml-4">
          <span className={`text-xs font-medium ${complexityColor}`}>
            {endpoint.complexity}
          </span>
        </div>

        {/* View details button */}
        <button
          onClick={onSelect}
          className="ml-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
          title="View Details"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div>
              {endpoint.description && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Description</h4>
                  <p className="text-sm text-gray-600">{endpoint.description}</p>
                </div>
              )}

              {endpoint.tags && endpoint.tags.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {endpoint.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(endpoint.parameters?.length || 0) > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    Parameters ({endpoint.parameters?.length || 0})
                  </h4>
                  <div className="space-y-1">
                    {endpoint.parameters?.slice(0, 3).map((param) => (
                      <div key={param.name} className="text-xs">
                        <code className="text-blue-600">{param.name}</code>
                        <span className="text-gray-500 ml-1">({param.in})</span>
                        {param.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </div>
                    ))}
                    {(endpoint.parameters?.length || 0) > 3 && (
                      <div className="text-xs text-gray-500">
                        +{(endpoint.parameters?.length || 0) - 3} more...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div>
              <div className="mb-3">
                <h4 className="text-sm font-medium text-gray-900 mb-1">Response Codes</h4>
                <div className="flex flex-wrap gap-1">
                  {endpoint.responseStatusCodes.map((code) => (
                    <span
                      key={code}
                      className={`px-2 py-1 text-xs rounded ${
                        code.startsWith('2')
                          ? 'bg-green-100 text-green-700'
                          : code.startsWith('4')
                          ? 'bg-yellow-100 text-yellow-700'
                          : code.startsWith('5')
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Cacheable:</span>
                  <span className={`ml-1 ${endpoint.cacheable ? 'text-green-600' : 'text-gray-600'}`}>
                    {endpoint.cacheable ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Safe:</span>
                  <span className={`ml-1 ${endpoint.safe ? 'text-green-600' : 'text-gray-600'}`}>
                    {endpoint.safe ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Idempotent:</span>
                  <span className={`ml-1 ${endpoint.idempotent ? 'text-green-600' : 'text-gray-600'}`}>
                    {endpoint.idempotent ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Response Size:</span>
                  <span className="ml-1 text-gray-600 capitalize">
                    {endpoint.estimatedResponseSize}
                  </span>
                </div>
              </div>

              {endpoint.operationId && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Operation ID</h4>
                  <code className="text-xs text-gray-600">{endpoint.operationId}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const EndpointList: React.FC<EndpointListProps> = ({
  endpoints,
  selectedEndpoints,
  onEndpointSelect,
  onEndpointToggle,
  className = '',
}) => {
  const [sortBy, setSortBy] = useState<'path' | 'method' | 'complexity'>('path');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedEndpoints = useMemo(() => {
    const sorted = [...endpoints].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'path':
          comparison = a.path.localeCompare(b.path);
          break;
        case 'method':
          comparison = a.method.localeCompare(b.method);
          break;
        case 'complexity': {
          const complexityOrder = { simple: 0, moderate: 1, complex: 2 };
          comparison = complexityOrder[a.complexity] - complexityOrder[b.complexity];
          break;
        }
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [endpoints, sortBy, sortOrder]);

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const selectedCount = selectedEndpoints.size;
  const totalCount = endpoints.length;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">
            Endpoints ({totalCount})
          </h3>
          {selectedCount > 0 && (
            <span className="px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded">
              {selectedCount} selected
            </span>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <button
            onClick={() => handleSort('path')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'path'
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Path {sortBy === 'path' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSort('method')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'method'
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Method {sortBy === 'method' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSort('complexity')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'complexity'
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Complexity {sortBy === 'complexity' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* Endpoint list */}
      <div className="space-y-2">
        {sortedEndpoints.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No endpoints found
          </div>
        ) : (
          sortedEndpoints.map((endpoint) => (
            <EndpointItem
              key={endpoint.id}
              endpoint={endpoint}
              isSelected={selectedEndpoints.has(endpoint.id)}
              onSelect={() => onEndpointSelect(endpoint.id)}
              onToggle={() => onEndpointToggle(endpoint.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};