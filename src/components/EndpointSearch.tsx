import React, { useState, useMemo, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import type { ExtractedEndpoint } from '../services/endpointExtractor';
import { EndpointService } from '../services/endpointService';

interface EndpointSearchProps {
  endpoints: ExtractedEndpoint[];
  onFilteredEndpoints: (endpoints: ExtractedEndpoint[]) => void;
  className?: string;
}

interface FilterState {
  methods: Set<string>;
  tags: Set<string>;
  complexity: 'simple' | 'moderate' | 'complex' | null;
  hasAuth: boolean | null;
  deprecated: boolean | null;
  hasExamples: boolean | null;
}

const initialFilterState: FilterState = {
  methods: new Set(),
  tags: new Set(),
  complexity: null,
  hasAuth: null,
  deprecated: null,
  hasExamples: null,
};

export const EndpointSearch: React.FC<EndpointSearchProps> = ({
  endpoints,
  onFilteredEndpoints,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [showFilters, setShowFilters] = useState(false);

  // Extract filter options from endpoints
  const filterOptions = useMemo(() => {
    const methods = new Set<string>();
    const tags = new Set<string>();
    const complexities = new Set<string>();
    let hasAuthCount = 0;
    let deprecatedCount = 0;
    let hasExamplesCount = 0;

    endpoints.forEach(endpoint => {
      methods.add(endpoint.method);
      endpoint.tags?.forEach(tag => tags.add(tag));
      complexities.add(endpoint.complexity);
      
      if (endpoint.security && endpoint.security.length > 0) hasAuthCount++;
      if (endpoint.deprecated) deprecatedCount++;
      if (endpoint.hasExamples) hasExamplesCount++;
    });

    return {
      methods: Array.from(methods).sort(),
      tags: Array.from(tags).sort(),
      complexities: Array.from(complexities).sort(),
      hasAuthCount,
      deprecatedCount,
      hasExamplesCount,
    };
  }, [endpoints]);

  // Filter and search endpoints
  const filteredEndpoints = useMemo(() => {
    return EndpointService.searchEndpoints(endpoints, searchQuery, {
      methods: filters.methods.size > 0 ? Array.from(filters.methods) : undefined,
      tags: filters.tags.size > 0 ? Array.from(filters.tags) : undefined,
      complexity: filters.complexity || undefined,
      hasAuth: filters.hasAuth ?? undefined,
      deprecated: filters.deprecated ?? undefined,
      hasExamples: filters.hasExamples ?? undefined,
    });
  }, [endpoints, searchQuery, filters]);

  // Update parent component when filtered endpoints change
  React.useEffect(() => {
    onFilteredEndpoints(filteredEndpoints);
  }, [filteredEndpoints, onFilteredEndpoints]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleMethodToggle = useCallback((method: string) => {
    setFilters(prev => {
      const newMethods = new Set(prev.methods);
      if (newMethods.has(method)) {
        newMethods.delete(method);
      } else {
        newMethods.add(method);
      }
      return { ...prev, methods: newMethods };
    });
  }, []);

  const handleTagToggle = useCallback((tag: string) => {
    setFilters(prev => {
      const newTags = new Set(prev.tags);
      if (newTags.has(tag)) {
        newTags.delete(tag);
      } else {
        newTags.add(tag);
      }
      return { ...prev, tags: newTags };
    });
  }, []);

  const handleComplexityChange = useCallback((complexity: FilterState['complexity']) => {
    setFilters(prev => ({
      ...prev,
      complexity: prev.complexity === complexity ? null : complexity,
    }));
  }, []);

  const handleBooleanFilterChange = useCallback((
    field: 'hasAuth' | 'deprecated' | 'hasExamples',
    value: boolean | null
  ) => {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field] === value ? null : value,
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilters(initialFilterState);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.length > 0 ||
      filters.methods.size > 0 ||
      filters.tags.size > 0 ||
      filters.complexity !== null ||
      filters.hasAuth !== null ||
      filters.deprecated !== null ||
      filters.hasExamples !== null
    );
  }, [searchQuery, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.length > 0) count++;
    if (filters.methods.size > 0) count++;
    if (filters.tags.size > 0) count++;
    if (filters.complexity !== null) count++;
    if (filters.hasAuth !== null) count++;
    if (filters.deprecated !== null) count++;
    if (filters.hasExamples !== null) count++;
    return count;
  }, [searchQuery, filters]);

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

  return (
    <div className={className}>
      {/* Search Bar */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search endpoints by path, summary, description, or tags..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
            showFilters || hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FunnelIcon className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Clear
          </button>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
        <span>
          {filteredEndpoints.length} of {endpoints.length} endpoints
          {searchQuery && ` matching "${searchQuery}"`}
        </span>
        
        {hasActiveFilters && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4 mr-1" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
          {/* HTTP Methods */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">HTTP Methods</h4>
            <div className="flex flex-wrap gap-2">
              {filterOptions.methods.map((method) => (
                <button
                  key={method}
                  onClick={() => handleMethodToggle(method)}
                  className={`px-3 py-1 text-xs font-medium rounded border ${
                    filters.methods.has(method)
                      ? methodColors[method as keyof typeof methodColors] || methodColors.GET
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {filterOptions.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {filterOptions.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1 text-xs font-medium rounded border ${
                      filters.tags.has(tag)
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Complexity */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Complexity</h4>
            <div className="flex space-x-2">
              {(['simple', 'moderate', 'complex'] as const).map((complexity) => (
                <button
                  key={complexity}
                  onClick={() => handleComplexityChange(complexity)}
                  className={`px-3 py-1 text-xs font-medium rounded border capitalize ${
                    filters.complexity === complexity
                      ? complexity === 'simple'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : complexity === 'moderate'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        : 'bg-red-100 text-red-800 border-red-200'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {complexity}
                </button>
              ))}
            </div>
          </div>

          {/* Boolean Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Authentication ({filterOptions.hasAuthCount})
              </h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBooleanFilterChange('hasAuth', true)}
                  className={`px-3 py-1 text-xs font-medium rounded border ${
                    filters.hasAuth === true
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Required
                </button>
                <button
                  onClick={() => handleBooleanFilterChange('hasAuth', false)}
                  className={`px-3 py-1 text-xs font-medium rounded border ${
                    filters.hasAuth === false
                      ? 'bg-gray-100 text-gray-800 border-gray-200'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Not Required
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Deprecated ({filterOptions.deprecatedCount})
              </h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBooleanFilterChange('deprecated', true)}
                  className={`px-3 py-1 text-xs font-medium rounded border ${
                    filters.deprecated === true
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleBooleanFilterChange('deprecated', false)}
                  className={`px-3 py-1 text-xs font-medium rounded border ${
                    filters.deprecated === false
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Examples ({filterOptions.hasExamplesCount})
              </h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBooleanFilterChange('hasExamples', true)}
                  className={`px-3 py-1 text-xs font-medium rounded border ${
                    filters.hasExamples === true
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Available
                </button>
                <button
                  onClick={() => handleBooleanFilterChange('hasExamples', false)}
                  className={`px-3 py-1 text-xs font-medium rounded border ${
                    filters.hasExamples === false
                      ? 'bg-gray-100 text-gray-800 border-gray-200'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Missing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {searchQuery && (
            <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
              Search: "{searchQuery}"
              <button
                onClick={() => setSearchQuery('')}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}
          
          {Array.from(filters.methods).map((method) => (
            <span key={method} className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
              Method: {method}
              <button
                onClick={() => handleMethodToggle(method)}
                className="ml-1 text-green-600 hover:text-green-800"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          
          {Array.from(filters.tags).map((tag) => (
            <span key={tag} className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
              Tag: {tag}
              <button
                onClick={() => handleTagToggle(tag)}
                className="ml-1 text-purple-600 hover:text-purple-800"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          
          {filters.complexity && (
            <span className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
              Complexity: {filters.complexity}
              <button
                onClick={() => handleComplexityChange(null)}
                className="ml-1 text-yellow-600 hover:text-yellow-800"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};