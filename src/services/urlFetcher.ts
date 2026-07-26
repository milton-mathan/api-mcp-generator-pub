import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type { 
  UrlFetch, 
  ApiResponse, 
  NetworkError, 
  ParserResult,
  FileUpload,
  JsonValue
} from '../types';
import { parseSpecFromFile } from './specParser';

// Default configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Fetch API specification from URL
 */
export async function fetchSpecFromUrl(
  urlFetch: UrlFetch,
  onProgress?: (progress: { loaded: number; total?: number }) => void
): Promise<ParserResult> {
  let { url, headers = {}, timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES } = urlFetch;
  
  // Handle API key in query parameters
  const apiKeyQueryParams = extractApiKeyQueryParams(headers);
  if (apiKeyQueryParams.length > 0) {
    url = addQueryParamsToUrl(url, apiKeyQueryParams);
    // Remove API key headers that should be query params
    headers = { ...headers };
    apiKeyQueryParams.forEach(param => {
      delete headers[param.headerName];
    });
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithRetry(url, {
        headers: {
          'Accept': 'application/json, application/yaml, text/yaml, text/plain, */*',
          'User-Agent': 'API-Spec-Explorer/1.0',
          ...headers,
        },
        timeout,
        onDownloadProgress: onProgress ? (progressEvent) => {
          onProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total || undefined,
          });
        } : undefined,
      });

      // Validate response
      if (!response.data) {
        throw new Error('Empty response received');
      }

      // Detect content type
      const contentType = response.headers['content-type'] || '';
      const isJson = contentType.includes('application/json') || 
                    contentType.includes('text/json');
      const isYaml = contentType.includes('application/yaml') || 
                    contentType.includes('text/yaml') || 
                    contentType.includes('application/x-yaml');

      // Convert response to string if it's an object
      let content: string;
      if (typeof response.data === 'string') {
        content = response.data;
      } else {
        content = JSON.stringify(response.data, null, 2);
      }

      // Detect file type from content or URL
      let fileType: 'json' | 'yaml';
      if (isJson) {
        fileType = 'json';
      } else if (isYaml) {
        fileType = 'yaml';
      } else {
        // Try to detect from URL extension
        const urlPath = new URL(url).pathname.toLowerCase();
        if (urlPath.endsWith('.json')) {
          fileType = 'json';
        } else if (urlPath.endsWith('.yaml') || urlPath.endsWith('.yml')) {
          fileType = 'yaml';
        } else {
          // Try to detect from content
          try {
            JSON.parse(content);
            fileType = 'json';
          } catch {
            fileType = 'yaml';
          }
        }
      }

      // Create a mock file upload object for parsing
      const mockFile = new File([content], getFilenameFromUrl(url), {
        type: fileType === 'json' ? 'application/json' : 'application/yaml',
      });

      const fileUpload: FileUpload = {
        file: mockFile,
        content,
        type: fileType,
        size: content.length,
        lastModified: Date.now(),
      };

      // Parse the specification
      return await parseSpecFromFile(fileUpload);

    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        
        // Don't retry on client errors (4xx) except for rate limiting
        if (status && status >= 400 && status < 500 && status !== 429) {
          break;
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }

  // If we get here, all retries failed
  const networkError: NetworkError = {
    type: 'network',
    message: getErrorMessage(lastError, url),
    details: lastError ? { message: lastError.message, name: lastError.name } as JsonValue : null,
    timestamp: Date.now(),
    recoverable: isRecoverableError(lastError),
    status: lastError instanceof AxiosError ? lastError.response?.status : undefined,
    url,
  };

  return {
    spec: {},
    errors: [networkError],
    warnings: [],
    metadata: {
      version: 'unknown',
      format: 'json',
      size: 0,
      endpointCount: 0,
      tagCount: 0,
      schemaCount: 0,
      parseTime: Date.now(),
    },
  };
}

/**
 * Fetch with axios and proper error handling
 */
async function fetchWithRetry(url: string, config: AxiosRequestConfig): Promise<ApiResponse> {
  try {
    const response = await axios.get(url, config);
    
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      // Handle specific HTTP errors
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Network error: Unable to reach the server');
      }
    }
    
    throw error;
  }
}

/**
 * Get a reasonable filename from URL
 */
function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Extract filename from path
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];
    
    if (lastSegment && lastSegment.includes('.')) {
      return lastSegment;
    }
    
    // Generate a reasonable filename
    const hostname = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '-');
    return `${hostname}-api-spec.json`;
  } catch {
    return 'api-spec.json';
  }
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: Error | null, _url: string): string {
  if (!error) return 'Unknown error occurred';

  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 400:
          return 'Bad request: The URL or request format is invalid';
        case 401:
          return 'Unauthorized: Authentication required or invalid credentials';
        case 403:
          return 'Forbidden: Access denied to the resource';
        case 404:
          return 'Not found: The API specification was not found at this URL';
        case 429:
          return 'Rate limited: Too many requests, please try again later';
        case 500:
          return 'Server error: The remote server encountered an error';
        case 502:
        case 503:
        case 504:
          return 'Service unavailable: The remote server is temporarily unavailable';
        default:
          return `HTTP error ${status}: ${error.response.statusText}`;
      }
    } else if (error.request) {
      if (error.code === 'ENOTFOUND') {
        return 'DNS error: Unable to resolve the hostname';
      } else if (error.code === 'ECONNREFUSED') {
        return 'Connection refused: The server is not accepting connections';
      } else if (error.code === 'ETIMEDOUT') {
        return 'Timeout: The request took too long to complete';
      } else {
        return 'Network error: Unable to connect to the server';
      }
    }
  }

  // Handle parsing errors
  if (error.message.includes('JSON') || error.message.includes('YAML')) {
    return `Invalid specification format: ${error.message}`;
  }

  return error.message || 'An unexpected error occurred';
}

/**
 * Determine if an error is recoverable (user can retry)
 */
function isRecoverableError(error: Error | null): boolean {
  if (!error) return false;

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    
    // Client errors (except 429) are usually not recoverable
    if (status && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
    
    // Network errors and server errors are usually recoverable
    return true;
  }

  // Parsing errors are usually not recoverable without fixing the source
  if (error.message.includes('JSON') || error.message.includes('YAML')) {
    return false;
  }

  return true;
}

/**
 * Validate URL before fetching
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url.trim()) {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Check for suspicious or blocked domains
    const hostname = urlObj.hostname.toLowerCase();
    const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
    
    if (blockedDomains.some(domain => hostname.includes(domain))) {
      return { valid: false, error: 'Local URLs are not allowed for security reasons' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Extract API key query parameters from headers
 */
function extractApiKeyQueryParams(headers: Record<string, string>): Array<{ headerName: string; paramName: string; value: string }> {
  const queryParams: Array<{ headerName: string; paramName: string; value: string }> = [];
  
  // Check for special header that indicates query parameter usage
  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.startsWith('__query_param__')) {
      const paramName = headerName.replace('__query_param__', '');
      queryParams.push({ headerName, paramName, value });
    }
  }
  
  return queryParams;
}

/**
 * Add query parameters to URL
 */
function addQueryParamsToUrl(url: string, params: Array<{ paramName: string; value: string }>): string {
  try {
    const urlObj = new URL(url);
    params.forEach(param => {
      urlObj.searchParams.set(param.paramName, param.value);
    });
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

/**
 * Get common headers for API requests
 */
export function getCommonHeaders(): Record<string, string> {
  return {
    'Accept': 'application/json, application/yaml, text/yaml, text/plain, */*',
    'User-Agent': 'API-Spec-Explorer/1.0',
    'Cache-Control': 'no-cache',
  };
}