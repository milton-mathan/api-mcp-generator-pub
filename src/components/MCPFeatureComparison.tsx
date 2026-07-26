import React from 'react';
import {
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface FeatureComparisonProps {
  className?: string;
}

interface Feature {
  name: string;
  description: string;
  basicMCP: boolean;
  fastMCP: boolean;
  category: 'core' | 'development' | 'deployment' | 'advanced';
}

const features: Feature[] = [
  // Core Features
  {
    name: 'Stdio Mode (MCP Clients)',
    description: 'Integration with Claude Desktop, Cline, and other MCP clients',
    basicMCP: true,
    fastMCP: true,
    category: 'core'
  },
  {
    name: 'Tool Registration',
    description: 'Register API endpoints as MCP tools',
    basicMCP: true,
    fastMCP: true,
    category: 'core'
  },
  {
    name: 'Authentication Support',
    description: 'API key, Bearer token, and OAuth2 authentication',
    basicMCP: true,
    fastMCP: true,
    category: 'core'
  },
  {
    name: 'HTTP Mode',
    description: 'Run server as HTTP API for web integration and testing',
    basicMCP: false,
    fastMCP: true,
    category: 'core'
  },
  
  // Development Features
  {
    name: 'Enhanced Logging',
    description: 'Structured logging with configurable levels and debugging info',
    basicMCP: false,
    fastMCP: true,
    category: 'development'
  },
  {
    name: 'Helper Scripts',
    description: 'Setup, stdio runner, HTTP runner scripts for easy development',
    basicMCP: false,
    fastMCP: true,
    category: 'development'
  },
  {
    name: 'Error Handling',
    description: 'Detailed error messages and recovery suggestions',
    basicMCP: false,
    fastMCP: true,
    category: 'development'
  },
  {
    name: 'Query Parameter Auth',
    description: 'Support for API keys in query parameters',
    basicMCP: false,
    fastMCP: true,
    category: 'development'
  },
  
  // Deployment Features
  {
    name: 'Docker Compose',
    description: 'Ready-to-use Docker Compose configuration for local development',
    basicMCP: false,
    fastMCP: true,
    category: 'deployment'
  },
  {
    name: 'Environment Setup',
    description: 'Automated environment validation and setup',
    basicMCP: false,
    fastMCP: true,
    category: 'deployment'
  },
  {
    name: 'Health Checks',
    description: 'Built-in health check endpoints for monitoring',
    basicMCP: false,
    fastMCP: true,
    category: 'deployment'
  },
  {
    name: 'CORS Support',
    description: 'Cross-origin resource sharing for web integration',
    basicMCP: false,
    fastMCP: true,
    category: 'deployment'
  },
  
  // Advanced Features
  {
    name: 'Dual Mode Support',
    description: 'Stdio transport, the mode MCP clients use',
    basicMCP: false,
    fastMCP: true,
    category: 'advanced'
  },
  {
    name: 'Request Debugging',
    description: 'Detailed request/response logging and debugging tools',
    basicMCP: false,
    fastMCP: true,
    category: 'advanced'
  },
  {
    name: 'Performance Monitoring',
    description: 'Built-in performance metrics and monitoring',
    basicMCP: false,
    fastMCP: true,
    category: 'advanced'
  }
];

const categoryNames = {
  core: 'Core Features',
  development: 'Development Experience',
  deployment: 'Deployment & Operations',
  advanced: 'Advanced Features'
};

const categoryDescriptions = {
  core: 'Essential MCP server functionality',
  development: 'Tools and features that improve the development experience',
  deployment: 'Features that help with deployment and operations',
  advanced: 'Advanced capabilities for complex use cases'
};

export const MCPFeatureComparison: React.FC<FeatureComparisonProps> = ({
  className = ''
}) => {
  const categories = Object.keys(categoryNames) as (keyof typeof categoryNames)[];

  const FeatureIcon: React.FC<{ supported: boolean }> = ({ supported }) => (
    supported ? (
      <CheckIcon className="h-5 w-5 text-green-600" />
    ) : (
      <XMarkIcon className="h-5 w-5 text-gray-400" />
    )
  );

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">MCP Framework Comparison</h2>
        <p className="mt-2 text-gray-600">
          Compare features between Basic MCP and FastMCP server generation
        </p>
      </div>

      {categories.map(category => (
        <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {categoryNames[category]}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {categoryDescriptions[category]}
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Basic MCP
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    FastMCP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {features
                  .filter(feature => feature.category === category)
                  .map((feature, index) => (
                    <tr key={feature.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {feature.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {feature.description}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <FeatureIcon supported={feature.basicMCP} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <FeatureIcon supported={feature.fastMCP} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="bg-blue-50 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <InformationCircleIcon className="h-6 w-6 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-blue-900">Migration Notes</h3>
            <div className="mt-2 text-sm text-blue-800 space-y-2">
              <p>
                <strong>Backward Compatibility:</strong> Existing Basic MCP servers will continue to work.
                You can generate new Basic MCP servers by disabling the FastMCP option.
              </p>
              <p>
                <strong>Recommended for New Projects:</strong> FastMCP provides a better development
                experience and more deployment options. It's the recommended choice for new projects.
              </p>
              <p>
                <strong>Migration Path:</strong> You can migrate existing projects by regenerating
                with FastMCP enabled and transferring your configuration and authentication settings.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">When to Use Basic MCP</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Maintaining existing projects</li>
            <li>• Simple stdio-only requirements</li>
            <li>• Minimal dependencies preferred</li>
            <li>• Legacy system compatibility</li>
          </ul>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">When to Use FastMCP</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• New projects and development</li>
            <li>• Need for HTTP API integration</li>
            <li>• Enhanced debugging and logging</li>
            <li>• Docker and containerized deployment</li>
            <li>• Web application integration</li>
          </ul>
        </div>
      </div>
    </div>
  );
};