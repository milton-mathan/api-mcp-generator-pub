import type { ParsedSpec } from '../types';
import { 
  extractEndpoints, 
  groupEndpoints, 
  type ExtractedEndpoint, 
  type EndpointExtractionOptions 
} from './endpointExtractor';
import { 
  normalizeEndpoints, 
  type NormalizedEndpoint, 
  type NormalizationOptions 
} from './endpointNormalizer';

export interface EndpointProcessingOptions {
  extraction: Partial<EndpointExtractionOptions>;
  normalization: Partial<NormalizationOptions>;
}

export interface ProcessedEndpoints {
  raw: ExtractedEndpoint[];
  normalized: NormalizedEndpoint[];
  groups: {
    byMethod: Record<string, ExtractedEndpoint[]>;
    byTag: Record<string, ExtractedEndpoint[]>;
    byComplexity: Record<string, ExtractedEndpoint[]>;
    byPath: Record<string, ExtractedEndpoint[]>;
    bySecurity: Record<string, ExtractedEndpoint[]>;
    byResponseSize: Record<string, ExtractedEndpoint[]>;
  };
  statistics: EndpointStatistics;
  recommendations: string[];
}

export interface EndpointStatistics {
  total: number;
  byMethod: Record<string, number>;
  byComplexity: Record<string, number>;
  withAuth: number;
  withExamples: number;
  deprecated: number;
  averageParameters: number;
  averageResponseCodes: number;
  mostComplexEndpoint: ExtractedEndpoint | null;
  leastComplexEndpoint: ExtractedEndpoint | null;
}

const defaultProcessingOptions: EndpointProcessingOptions = {
  extraction: {
    includeDeprecated: true,
    includeInternal: false,
    normalizeParameters: true,
    resolveReferences: false,
    extractExamples: true,
    generateOperationIds: true,
  },
  normalization: {
    resolveReferences: true,
    flattenSchemas: true,
    generateExamples: true,
    validateSchemas: true,
    optimizeForMCP: true,
  },
};

/**
 * Comprehensive endpoint processing service
 */
export class EndpointService {
  /**
   * Process endpoints from specification
   */
  static processEndpoints(
    spec: ParsedSpec,
    options: Partial<EndpointProcessingOptions> = {}
  ): ProcessedEndpoints {
    const opts = this.mergeOptions(defaultProcessingOptions, options);

    // Extract endpoints
    const rawEndpoints = extractEndpoints(spec, opts.extraction);

    // Normalize endpoints
    const normalizedEndpoints = normalizeEndpoints(rawEndpoints, spec, opts.normalization);

    // Group endpoints
    const groups = groupEndpoints(rawEndpoints);

    // Calculate statistics
    const statistics = this.calculateStatistics(rawEndpoints);

    // Generate recommendations
    const recommendations = this.generateRecommendations(rawEndpoints, statistics);

    return {
      raw: rawEndpoints,
      normalized: normalizedEndpoints,
      groups,
      statistics,
      recommendations,
    };
  }

  /**
   * Get endpoints suitable for MCP tool generation
   */
  static getMCPCandidates(
    endpoints: ExtractedEndpoint[],
    criteria: MCPCandidateCriteria = {}
  ): MCPCandidate[] {
    const {
      excludeDeprecated = true,
      excludeComplex = false,
      requireExamples = false,
      maxParameters = 10,
      allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      requireAuth = false,
    } = criteria;

    return endpoints
      .filter(endpoint => {
        // Filter by deprecation
        if (excludeDeprecated && endpoint.deprecated) return false;

        // Filter by complexity
        if (excludeComplex && endpoint.complexity === 'complex') return false;

        // Filter by examples
        if (requireExamples && !endpoint.hasExamples) return false;

        // Filter by parameter count
        if ((endpoint.parameters?.length ?? 0) > maxParameters) return false;

        // Filter by HTTP method
        if (!allowedMethods.includes(endpoint.method)) return false;

        // Filter by authentication
        if (requireAuth && (!endpoint.security || endpoint.security.length === 0)) return false;

        return true;
      })
      .map(endpoint => this.createMCPCandidate(endpoint))
      .sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }

  /**
   * Search endpoints by various criteria
   */
  static searchEndpoints(
    endpoints: ExtractedEndpoint[],
    query: string,
    filters: EndpointFilters = {}
  ): ExtractedEndpoint[] {
    const normalizedQuery = query.toLowerCase().trim();
    
    return endpoints.filter(endpoint => {
      // Text search
      if (normalizedQuery) {
        const searchText = [
          endpoint.summary,
          endpoint.description,
          endpoint.operationId,
          endpoint.path,
          ...(endpoint.tags || []),
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchText.includes(normalizedQuery)) return false;
      }

      // Apply filters
      if (filters.methods && !filters.methods.includes(endpoint.method)) return false;
      if (filters.tags && !(endpoint.tags?.some(tag => filters.tags!.includes(tag)) || false)) return false;
      if (filters.complexity && endpoint.complexity !== filters.complexity) return false;
      if (filters.hasAuth !== undefined) {
        const hasAuth = !!(endpoint.security && endpoint.security.length > 0);
        if (hasAuth !== filters.hasAuth) return false;
      }
      if (filters.deprecated !== undefined && endpoint.deprecated !== filters.deprecated) return false;
      if (filters.hasExamples !== undefined && endpoint.hasExamples !== filters.hasExamples) return false;

      return true;
    });
  }

  /**
   * Analyze endpoint relationships
   */
  static analyzeRelationships(endpoints: ExtractedEndpoint[]): EndpointRelationship[] {
    const relationships: EndpointRelationship[] = [];
    
    for (let i = 0; i < endpoints.length; i++) {
      for (let j = i + 1; j < endpoints.length; j++) {
        const endpoint1 = endpoints[i];
        const endpoint2 = endpoints[j];
        
        const relationship = this.findRelationship(endpoint1, endpoint2);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  /**
   * Generate endpoint documentation
   */
  static generateDocumentation(
    endpoints: ExtractedEndpoint[],
    format: 'markdown' | 'html' | 'json' = 'markdown'
  ): string {
    switch (format) {
      case 'markdown':
        return this.generateMarkdownDocs(endpoints);
      case 'html':
        return this.generateHTMLDocs(endpoints);
      case 'json':
        return JSON.stringify(endpoints, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Private helper methods

  private static mergeOptions(
    defaults: EndpointProcessingOptions,
    overrides: Partial<EndpointProcessingOptions>
  ): EndpointProcessingOptions {
    return {
      extraction: { ...defaults.extraction, ...overrides.extraction },
      normalization: { ...defaults.normalization, ...overrides.normalization },
    };
  }

  private static calculateStatistics(endpoints: ExtractedEndpoint[]): EndpointStatistics {
    const byMethod: Record<string, number> = {};
    const byComplexity: Record<string, number> = {};
    let withAuth = 0;
    let withExamples = 0;
    let deprecated = 0;
    let totalParameters = 0;
    let totalResponseCodes = 0;
    let mostComplex: ExtractedEndpoint | null = null;
    let leastComplex: ExtractedEndpoint | null = null;

    for (const endpoint of endpoints) {
      // Count by method
      byMethod[endpoint.method] = (byMethod[endpoint.method] || 0) + 1;

      // Count by complexity
      byComplexity[endpoint.complexity] = (byComplexity[endpoint.complexity] || 0) + 1;

      // Count features
      if (endpoint.security && endpoint.security.length > 0) withAuth++;
      if (endpoint.hasExamples) withExamples++;
      if (endpoint.deprecated) deprecated++;

      // Accumulate for averages
      totalParameters += (endpoint.parameters?.length ?? 0);
      totalResponseCodes += endpoint.responseStatusCodes.length;

      // Track complexity extremes
      if (!mostComplex || this.getComplexityScore(endpoint) > this.getComplexityScore(mostComplex)) {
        mostComplex = endpoint;
      }
      if (!leastComplex || this.getComplexityScore(endpoint) < this.getComplexityScore(leastComplex)) {
        leastComplex = endpoint;
      }
    }

    return {
      total: endpoints.length,
      byMethod,
      byComplexity,
      withAuth,
      withExamples,
      deprecated,
      averageParameters: endpoints.length > 0 ? totalParameters / endpoints.length : 0,
      averageResponseCodes: endpoints.length > 0 ? totalResponseCodes / endpoints.length : 0,
      mostComplexEndpoint: mostComplex,
      leastComplexEndpoint: leastComplex,
    };
  }

  private static getComplexityScore(endpoint: ExtractedEndpoint): number {
    let score = (endpoint.parameters?.length ?? 0);
    if (endpoint.hasRequestBody) score += 3;
    score += endpoint.responseStatusCodes.length;
    if (endpoint.complexity === 'complex') score += 10;
    else if (endpoint.complexity === 'moderate') score += 5;
    return score;
  }

  private static generateRecommendations(
    endpoints: ExtractedEndpoint[],
    stats: EndpointStatistics
  ): string[] {
    const recommendations: string[] = [];

    // Documentation recommendations
    const withoutSummary = endpoints.filter(e => !e.summary).length;
    if (withoutSummary > 0) {
      recommendations.push(`${withoutSummary} endpoint(s) are missing summaries`);
    }

    const withoutDescription = endpoints.filter(e => !e.description).length;
    if (withoutDescription > stats.total * 0.5) {
      recommendations.push('Consider adding descriptions to more endpoints for better documentation');
    }

    // Examples recommendations
    if (stats.withExamples < stats.total * 0.3) {
      recommendations.push('Add examples to more endpoints to improve API usability');
    }

    // Tagging recommendations
    const untagged = endpoints.filter(e => !e.tags || e.tags.length === 0).length;
    if (untagged > 0) {
      recommendations.push(`${untagged} endpoint(s) are not tagged - consider organizing with tags`);
    }

    // Security recommendations
    if (stats.withAuth < stats.total * 0.5 && stats.withAuth > 0) {
      recommendations.push('Consider consistent authentication across all endpoints');
    }

    // Complexity recommendations
    if (stats.byComplexity.complex > stats.total * 0.3) {
      recommendations.push('Many endpoints are complex - consider simplifying or breaking them down');
    }

    return recommendations;
  }

  private static createMCPCandidate(endpoint: ExtractedEndpoint): MCPCandidate {
    const suitabilityScore = this.calculateMCPSuitability(endpoint);
    
    return {
      endpoint,
      suitabilityScore,
      toolName: this.generateMCPToolName(endpoint),
      reasons: this.getMCPSuitabilityReasons(endpoint),
      warnings: this.getMCPWarnings(endpoint),
    };
  }

  private static calculateMCPSuitability(endpoint: ExtractedEndpoint): number {
    let score = 50; // Base score

    // Method scoring
    if (['GET', 'POST'].includes(endpoint.method)) score += 20;
    else if (['PUT', 'DELETE', 'PATCH'].includes(endpoint.method)) score += 10;

    // Complexity scoring
    if (endpoint.complexity === 'simple') score += 20;
    else if (endpoint.complexity === 'moderate') score += 10;
    else score -= 10;

    // Documentation scoring
    if (endpoint.summary) score += 10;
    if (endpoint.description) score += 10;
    if (endpoint.hasExamples) score += 15;

    // Parameter scoring
    if ((endpoint.parameters?.length ?? 0) <= 3) score += 10;
    else if ((endpoint.parameters?.length ?? 0) <= 6) score += 5;
    else score -= 5;

    // Response scoring
    if (endpoint.responseStatusCodes.includes('200')) score += 10;
    if (endpoint.estimatedResponseSize === 'small') score += 10;
    else if (endpoint.estimatedResponseSize === 'medium') score += 5;

    // Penalties
    if (endpoint.deprecated) score -= 30;
    if (!endpoint.operationId) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private static generateMCPToolName(endpoint: ExtractedEndpoint): string {
    if (endpoint.operationId) {
      return endpoint.operationId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    }

    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith('{'));
    return [endpoint.method.toLowerCase(), ...pathParts].join('_').replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private static getMCPSuitabilityReasons(endpoint: ExtractedEndpoint): string[] {
    const reasons: string[] = [];

    if (endpoint.complexity === 'simple') {
      reasons.push('Simple endpoint structure');
    }
    if (endpoint.hasExamples) {
      reasons.push('Has examples for better understanding');
    }
    if (endpoint.summary && endpoint.description) {
      reasons.push('Well documented');
    }
    if ((endpoint.parameters?.length ?? 0) <= 3) {
      reasons.push('Few parameters make it easy to use');
    }
    if (['GET', 'POST'].includes(endpoint.method)) {
      reasons.push('Common HTTP method');
    }

    return reasons;
  }

  private static getMCPWarnings(endpoint: ExtractedEndpoint): string[] {
    const warnings: string[] = [];

    if (endpoint.deprecated) {
      warnings.push('Endpoint is deprecated');
    }
    if (endpoint.complexity === 'complex') {
      warnings.push('Complex endpoint may be difficult to use');
    }
    if ((endpoint.parameters?.length ?? 0) > 6) {
      warnings.push('Many parameters may make the tool complex');
    }
    if (!endpoint.hasExamples) {
      warnings.push('No examples available');
    }
    if (endpoint.estimatedResponseSize === 'large') {
      warnings.push('Large response size may impact performance');
    }

    return warnings;
  }

  private static findRelationship(
    endpoint1: ExtractedEndpoint,
    endpoint2: ExtractedEndpoint
  ): EndpointRelationship | null {
    // Same path, different methods
    if (endpoint1.normalizedPath === endpoint2.normalizedPath) {
      return {
        type: 'same_resource',
        endpoint1: endpoint1.id,
        endpoint2: endpoint2.id,
        description: `Both endpoints operate on the same resource: ${endpoint1.path}`,
      };
    }

    // CRUD relationships
    if (this.isCRUDRelated(endpoint1, endpoint2)) {
      return {
        type: 'crud_related',
        endpoint1: endpoint1.id,
        endpoint2: endpoint2.id,
        description: 'Endpoints appear to be CRUD operations on related resources',
      };
    }

    // Tag relationships
    if (endpoint1.tags?.some(tag => endpoint2.tags?.includes(tag) || false) || false) {
      return {
        type: 'tag_related',
        endpoint1: endpoint1.id,
        endpoint2: endpoint2.id,
        description: `Endpoints share common tags: ${endpoint1.tags?.filter(tag => endpoint2.tags?.includes(tag) || false).join(', ') || ''}`,
      };
    }

    return null;
  }

  private static isCRUDRelated(endpoint1: ExtractedEndpoint, endpoint2: ExtractedEndpoint): boolean {
    const path1Parts = endpoint1.path.split('/').filter(part => part && !part.startsWith('{'));
    const path2Parts = endpoint2.path.split('/').filter(part => part && !part.startsWith('{'));

    // Check if one path is a subset of another (collection vs item)
    if (path1Parts.length === path2Parts.length - 1 || path2Parts.length === path1Parts.length - 1) {
      const shorterPath = path1Parts.length < path2Parts.length ? path1Parts : path2Parts;
      const longerPath = path1Parts.length > path2Parts.length ? path1Parts : path2Parts;

      return shorterPath.every((part, index) => part === longerPath[index]);
    }

    return false;
  }

  private static generateMarkdownDocs(endpoints: ExtractedEndpoint[]): string {
    const lines: string[] = [];
    
    lines.push('# API Endpoints\n');
    
    const groupedByTag = groupEndpoints(endpoints).byTag;
    
    for (const [tag, tagEndpoints] of Object.entries(groupedByTag)) {
      lines.push(`## ${tag}\n`);
      
      for (const endpoint of tagEndpoints) {
        lines.push(`### ${endpoint.method} ${endpoint.path}\n`);
        
        if (endpoint.summary) {
          lines.push(`${endpoint.summary}\n`);
        }
        
        if (endpoint.description) {
          lines.push(`${endpoint.description}\n`);
        }
        
        if ((endpoint.parameters?.length ?? 0) > 0) {
          lines.push('**Parameters:**\n');
          for (const param of endpoint.parameters || []) {
            const required = param.required ? ' (required)' : '';
            lines.push(`- \`${param.name}\` (${param.in})${required}: ${param.description || 'No description'}`);
          }
          lines.push('');
        }
        
        lines.push('**Responses:**\n');
        for (const [statusCode, response] of Object.entries(endpoint.responses)) {
          lines.push(`- \`${statusCode}\`: ${response.description}`);
        }
        lines.push('\n---\n');
      }
    }
    
    return lines.join('\n');
  }

  private static generateHTMLDocs(endpoints: ExtractedEndpoint[]): string {
    // Simplified HTML generation
    return `
      <html>
        <head><title>API Documentation</title></head>
        <body>
          <h1>API Endpoints</h1>
          <p>Total endpoints: ${endpoints.length}</p>
          <pre>${JSON.stringify(endpoints, null, 2)}</pre>
        </body>
      </html>
    `;
  }
}

// Supporting interfaces

export interface MCPCandidateCriteria {
  excludeDeprecated?: boolean;
  excludeComplex?: boolean;
  requireExamples?: boolean;
  maxParameters?: number;
  allowedMethods?: string[];
  requireAuth?: boolean;
}

export interface MCPCandidate {
  endpoint: ExtractedEndpoint;
  suitabilityScore: number;
  toolName: string;
  reasons: string[];
  warnings: string[];
}

export interface EndpointFilters {
  methods?: string[];
  tags?: string[];
  complexity?: 'simple' | 'moderate' | 'complex';
  hasAuth?: boolean;
  deprecated?: boolean;
  hasExamples?: boolean;
}

export interface EndpointRelationship {
  type: 'same_resource' | 'crud_related' | 'tag_related';
  endpoint1: string;
  endpoint2: string;
  description: string;
}