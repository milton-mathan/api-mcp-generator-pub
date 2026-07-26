import React, { useMemo } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  TagIcon,
  GlobeAltIcon,
  CubeIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { EndpointList } from './EndpointList';
import type { ExtractedEndpoint } from '../services/endpointExtractor';
import { groupEndpoints } from '../services/endpointExtractor';

interface EndpointGroupsProps {
  endpoints: ExtractedEndpoint[];
  selectedEndpoints: Set<string>;
  groupBy: 'tags' | 'paths' | 'methods';
  expandedGroups: Set<string>;
  onEndpointSelect: (endpointId: string) => void;
  onEndpointToggle: (endpointId: string) => void;
  onGroupToggle: (groupId: string) => void;
  className?: string;
}

interface GroupHeaderProps {
  groupId: string;
  groupName: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  groupType: 'tags' | 'paths' | 'methods';
}

const GroupHeader: React.FC<GroupHeaderProps> = ({
  groupId: _groupId,
  groupName,
  count,
  isExpanded,
  onToggle,
  groupType,
}) => {
  const getGroupIcon = () => {
    switch (groupType) {
      case 'tags':
        return <TagIcon className="h-5 w-5 text-blue-500" />;
      case 'paths':
        return <FolderIcon className="h-5 w-5 text-green-500" />;
      case 'methods':
        return <CubeIcon className="h-5 w-5 text-purple-500" />;
      default:
        return <GlobeAltIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getGroupColor = () => {
    switch (groupType) {
      case 'tags':
        return 'border-blue-200 bg-blue-50';
      case 'paths':
        return 'border-green-200 bg-green-50';
      case 'methods':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow ${getGroupColor()}`}
    >
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          )}
          {getGroupIcon()}
        </div>
        <div className="text-left">
          <h3 className="font-medium text-gray-900">
            {groupName === 'untagged' ? 'Untagged Endpoints' : groupName}
          </h3>
          <p className="text-sm text-gray-600">
            {count} endpoint{count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="px-2 py-1 text-xs font-medium bg-white rounded border">
          {count}
        </span>
      </div>
    </button>
  );
};

export const EndpointGroups: React.FC<EndpointGroupsProps> = ({
  endpoints,
  selectedEndpoints,
  groupBy,
  expandedGroups,
  onEndpointSelect,
  onEndpointToggle,
  onGroupToggle,
  className = '',
}) => {
  const groups = useMemo(() => {
    const grouped = groupEndpoints(endpoints);
    
    switch (groupBy) {
      case 'tags':
        return grouped.byTag;
      case 'paths':
        return grouped.byPath;
      case 'methods':
        return grouped.byMethod;
      default:
        return grouped.byTag;
    }
  }, [endpoints, groupBy]);

  const sortedGroups = useMemo(() => {
    return Object.entries(groups).sort(([a], [b]) => {
      // Sort untagged/ungrouped items last
      if (a === 'untagged' || a === 'ungrouped') return 1;
      if (b === 'untagged' || b === 'ungrouped') return -1;
      return a.localeCompare(b);
    });
  }, [groups]);

  const totalEndpoints = endpoints.length;
  const selectedCount = selectedEndpoints.size;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-medium text-gray-900">
            API Endpoints
          </h2>
          <span className="text-sm text-gray-500">
            {totalEndpoints} total, {Object.keys(groups).length} groups
          </span>
          {selectedCount > 0 && (
            <span className="px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded">
              {selectedCount} selected
            </span>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {sortedGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No endpoints found
          </div>
        ) : (
          sortedGroups.map(([groupName, groupEndpoints]) => {
            const groupId = `${groupBy}_${groupName}`;
            const isExpanded = expandedGroups.has(groupId);
            
            return (
              <div key={groupId} className="border border-gray-200 rounded-lg overflow-hidden">
                <GroupHeader
                  groupId={groupId}
                  groupName={groupName}
                  count={groupEndpoints.length}
                  isExpanded={isExpanded}
                  onToggle={() => onGroupToggle(groupId)}
                  groupType={groupBy}
                />
                
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-white p-4">
                    <EndpointList
                      endpoints={groupEndpoints}
                      selectedEndpoints={selectedEndpoints}
                      onEndpointSelect={onEndpointSelect}
                      onEndpointToggle={onEndpointToggle}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {sortedGroups.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Groups:</span>
              <span className="ml-2 font-medium">{Object.keys(groups).length}</span>
            </div>
            <div>
              <span className="text-gray-500">Total Endpoints:</span>
              <span className="ml-2 font-medium">{totalEndpoints}</span>
            </div>
            <div>
              <span className="text-gray-500">Selected:</span>
              <span className="ml-2 font-medium">{selectedCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Expanded:</span>
              <span className="ml-2 font-medium">{expandedGroups.size}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};