import { describe, it, expect } from 'vitest';
import { 
  extractEndpoints, 
  generateEndpointId, 
  assessComplexity, 
  normalizeEndpoint, 
  extractResponseExamples 
} from '../endpointExtractor';
import { mockOpenAPISpec, mockExtractedEndpoints } from '../../test/mocks/openapi';

describe('EndpointExtractor', () => {
  describe('extractEndpoints', () => {
    it('should extract all endpoints from OpenAPI spec', () => {
      const endpoints = extractEndpoints(mockOpenAPISpec);

      expect(endpoints).toHaveLength(3);
      expect(endpoints.map(e => e.id)).toEqual([
        'get-users',
        'post-users',
        'get-users-id',
      ]);
    });

    it('should extract endpoint metadata correctly', () => {
      const endpoints = extractEndpoints(mockOpenAPISpec);
      const getUsersEndpoint = endpoints.find(e => e.operationId === 'getUsers');

      expect(getUsersEndpoint).toBeDefined();
      expect(getUsersEndpoint?.method).toBe('GET');
      expect(getUsersEndpoint?.path).toBe('/users');
      expect(getUsersEndpoint?.summary).toBe('Get all users');
      expect(getUsersEndpoint?.tags).toEqual(['users']);
      expect(getUsersEndpoint?.parameters).toHaveLength(2);
    });

    it('should extract parameters correctly', () => {
      const endpoints = extractEndpoints(mockOpenAPISpec);
      const getUsersEndpoint = endpoints.find(e => e.operationId === 'getUsers');

      expect(getUsersEndpoint?.parameters).toEqual([
        {
          name: 'limit',
          in: 'query',
          description: 'Maximum number of users to return',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
        },
        {
          name: 'offset',
          in: 'query',
          description: 'Number of users to skip',
          required: false,
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0,
          },
        },
      ]);
    });

    it('should extract security requirements', () => {
      const endpoints = extractEndpoints(mockOpenAPISpec);
      const createUserEndpoint = endpoints.find(e => e.operationId === 'createUser');

      expect(createUserEndpoint?.security).toEqual([
        {
          bearerAuth: [],
        },
      ]);
    });

    it('should handle endpoints without operationId', () => {
      const specWithoutOperationId = {
        ...mockOpenAPISpec,
        paths: {
          '/test': {
            get: {
              summary: 'Test endpoint',
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      };

      const endpoints = extractEndpoints(specWithoutOperationId);
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].operationId).toBeUndefined();
      expect(endpoints[0].id).toBe('get-test');
    });
  });

  describe('generateEndpointId', () => {
    it('should generate ID from method and path', () => {
      const id = generateEndpointId('GET', '/users/{id}');
      expect(id).toBe('get-users-id');
    });

    it('should handle complex paths', () => {
      const id = generateEndpointId('POST', '/api/v1/users/{userId}/posts/{postId}');
      expect(id).toBe('post-api-v1-users-userid-posts-postid');
    });

    it('should handle special characters', () => {
      const id = generateEndpointId('GET', '/users?search=test&limit=10');
      expect(id).toBe('get-users-search-test-limit-10');
    });
  });

  describe('assessComplexity', () => {
    it('should assess simple endpoint as simple', () => {
      const simpleEndpoint = mockExtractedEndpoints[0]; // GET /users
      const complexity = assessComplexity(simpleEndpoint);
      expect(complexity).toBe('simple');
    });

    it('should assess endpoint with request body as moderate', () => {
      const moderateEndpoint = mockExtractedEndpoints[1]; // POST /users
      const complexity = assessComplexity(moderateEndpoint);
      expect(complexity).toBe('moderate');
    });

    it('should assess endpoint with many parameters as complex', () => {
      const complexEndpoint = {
        ...mockExtractedEndpoints[0],
        parameters: Array.from({ length: 8 }, (_, i) => ({
          name: `param${i}`,
          in: 'query' as const,
          required: false,
          schema: { type: 'string' },
        })),
      };

      const complexity = assessComplexity(complexEndpoint);
      expect(complexity).toBe('complex');
    });
  });

  describe('normalizeEndpoint', () => {
    it('should normalize endpoint data', () => {
      const rawEndpoint = {
        method: 'GET',
        path: '/users',
        operationId: 'getUsers',
        summary: 'Get all users',
        description: 'Retrieve a list of all users',
        tags: ['users'],
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
          },
        },
        security: [],
        deprecated: false,
      };

      const normalized = normalizeEndpoint(rawEndpoint as Record<string, unknown>);

      expect(normalized.id).toBe('get-users');
      expect(normalized.complexity).toBe('simple');
      expect(normalized.hasExamples).toBe(false);
    });

    it('should detect examples in responses', () => {
      const endpointWithExamples = {
        method: 'GET',
        path: '/users',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                example: { users: [] },
              },
            },
          },
        },
        security: [],
        deprecated: false,
      };

      const normalized = normalizeEndpoint(endpointWithExamples as Record<string, unknown>);
      expect(normalized.hasExamples).toBe(true);
    });
  });

  describe('extractResponseExamples', () => {
    it('should extract examples from response content', () => {
      const response = {
        description: 'Success',
        content: {
          'application/json': {
            example: { id: 1, name: 'John' },
            examples: {
              user1: {
                value: { id: 1, name: 'John' },
              },
              user2: {
                value: { id: 2, name: 'Jane' },
              },
            },
          },
        },
      };

      const examples = extractResponseExamples(response);
      expect(examples).toHaveLength(3); // 1 example + 2 examples
    });

    it('should return empty array when no examples', () => {
      const response = {
        description: 'Success',
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      };

      const examples = extractResponseExamples(response);
      expect(examples).toHaveLength(0);
    });
  });
});