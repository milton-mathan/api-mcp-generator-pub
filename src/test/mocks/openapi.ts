import type { ParsedSpec, ExtractedEndpoint } from '../../services/endpointExtractor';

/**
 * A raw OpenAPI 3.0 document, as a user would upload it.
 *
 * Distinct from `mockOpenAPISpec` below, which is the *normalized* `ParsedSpec`
 * the parser produces. Feeding a normalized spec back in as input fails: it
 * carries `version`, while version detection looks for `openapi` / `swagger`.
 * Use this for anything that goes through InputHandler or the parser.
 */
export const mockOpenAPIDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
    description: 'A test API for unit testing',
  },
  servers: [{ url: 'https://api.example.com/v1', description: 'Production server' }],
  paths: {
    '/users': {
      get: {
        operationId: 'getUsers',
        summary: 'Get all users',
        description: 'Retrieve a list of all users',
        tags: ['users'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum number of users to return',
            schema: { type: 'integer', default: 10 },
          },
        ],
        responses: { '200': { description: 'A list of users' } },
      },
      post: {
        operationId: 'createUser',
        summary: 'Create a user',
        tags: ['users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' }, email: { type: 'string' } },
                required: ['name'],
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUserById',
        summary: 'Get a user by id',
        tags: ['users'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'The user id',
            schema: { type: 'integer' },
          },
        ],
        responses: { '200': { description: 'A user' } },
      },
    },
  },
};

export const mockOpenAPISpec: ParsedSpec = {
  version: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
    description: 'A test API for unit testing',
  },
  servers: [
    {
      url: 'https://api.example.com/v1',
      description: 'Production server',
    },
  ],
  paths: {
    '/users': {
      get: {
        operationId: 'getUsers',
        summary: 'Get all users',
        description: 'Retrieve a list of all users',
        tags: ['users'],
        parameters: [
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
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/User',
                      },
                    },
                    total: {
                      type: 'integer',
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: 'createUser',
        summary: 'Create a new user',
        description: 'Create a new user account',
        tags: ['users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateUserRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
    },
    '/users/{id}': {
      get: {
        operationId: 'getUserById',
        summary: 'Get user by ID',
        description: 'Retrieve a specific user by their ID',
        tags: ['users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            description: 'User ID',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
          '404': {
            description: 'User not found',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        required: ['id', 'name', 'email'],
      },
      CreateUserRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
          },
          email: {
            type: 'string',
            format: 'email',
          },
        },
        required: ['name', 'email'],
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

export const mockExtractedEndpoints: ExtractedEndpoint[] = [
  {
    id: 'get-users',
    method: 'GET',
    path: '/users',
    operationId: 'getUsers',
    summary: 'Get all users',
    description: 'Retrieve a list of all users',
    tags: ['users'],
    parameters: [
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
    ],
    responses: {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                users: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/User',
                  },
                },
                total: {
                  type: 'integer',
                },
              },
            },
          },
        },
      },
    },
    security: [],
    deprecated: false,
    complexity: 'simple',
    hasExamples: false,
    requestBody: undefined,
  },
  {
    id: 'create-user',
    method: 'POST',
    path: '/users',
    operationId: 'createUser',
    summary: 'Create a new user',
    description: 'Create a new user account',
    tags: ['users'],
    parameters: [],
    responses: {
      '201': {
        description: 'User created successfully',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/User',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    deprecated: false,
    complexity: 'moderate',
    hasExamples: false,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/CreateUserRequest',
          },
        },
      },
    },
  },
  {
    id: 'get-user-by-id',
    method: 'GET',
    path: '/users/{id}',
    operationId: 'getUserById',
    summary: 'Get user by ID',
    description: 'Retrieve a specific user by their ID',
    tags: ['users'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        description: 'User ID',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid',
        },
      },
    ],
    responses: {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/User',
            },
          },
        },
      },
      '404': {
        description: 'User not found',
      },
    },
    security: [],
    deprecated: false,
    complexity: 'simple',
    hasExamples: false,
    requestBody: undefined,
  },
];