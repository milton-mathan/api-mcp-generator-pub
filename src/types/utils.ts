// Utility types for better type safety and developer experience
import { JsonValue } from './openapi';

// Make all properties optional recursively
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Make specific properties required
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Make specific properties optional
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Extract function parameters
export type Parameters<T extends (...args: JsonValue[]) => JsonValue> = T extends (...args: infer P) => JsonValue ? P : never;

// Extract function return type
export type ReturnType<T extends (...args: JsonValue[]) => JsonValue> = T extends (...args: JsonValue[]) => infer R ? R : JsonValue;

// Create a union of all values in an object
export type ValueOf<T> = T[keyof T];

// Create a union of all keys in an object
export type KeyOf<T> = keyof T;

// Exclude null and undefined
export type NonNullable<T> = T extends null | undefined ? never : T;

// Create a type that represents either T or a Promise<T>
export type MaybePromise<T> = T | Promise<T>;

// Create a type that represents a function that may be async
export type MaybeAsync<T extends (...args: JsonValue[]) => JsonValue> = T | ((...args: Parameters<T>) => Promise<ReturnType<T>>);

// Create a branded type for better type safety
export type Brand<T, B> = T & { __brand: B };

// Common branded types
export type EndpointId = Brand<string, 'EndpointId'>;
export type SpecId = Brand<string, 'SpecId'>;
export type ToolId = Brand<string, 'ToolId'>;

// Event handler types
export type EventHandler<T = JsonValue> = (event: T) => void;
export type AsyncEventHandler<T = JsonValue> = (event: T) => Promise<void>;

// State updater types
export type StateUpdater<T> = (prevState: T) => T;
export type StateAction<T> = T | StateUpdater<T>;

// Conditional types for better API design
export type If<C extends boolean, T, F> = C extends true ? T : F;

// Create a type that makes certain fields readonly
export type ReadonlyFields<T, K extends keyof T> = Omit<T, K> & Readonly<Pick<T, K>>;

// Create a type that represents a configuration object with defaults
export type WithDefaults<T, D extends Partial<T>> = T & D;

// Create a type for error boundaries
export type ErrorBoundary<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Create a type for async operations
export type AsyncOperation<T, E = Error> = {
  loading: boolean;
  data: T | null;
  error: E | null;
};

// Create a type for paginated results
export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// Create a type for search results
export type SearchableField<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

// Create a type for sortable fields
export type SortableField<T> = {
  [K in keyof T]: T[K] extends string | number | Date ? K : never;
}[keyof T];

// Create a type for filterable fields
export type FilterableField<T> = {
  [K in keyof T]: T[K] extends string | number | boolean | Date ? K : never;
}[keyof T];

// Create a type for form field validation
export type FieldValidator<T> = (value: T) => string | null;

// Create a type for form state
export type FormState<T> = {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
};

// Create a type for API endpoints
export type ApiEndpoint<TRequest = JsonValue, TResponse = JsonValue> = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  request?: TRequest;
  response: TResponse;
};

// Create a type for theme configuration
export type ThemeConfig = {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, JsonValue>;
  breakpoints: Record<string, string>;
};

// Create a type for component variants
export type ComponentVariant<T extends string> = {
  [K in T]: {
    className: string;
    props?: Record<string, JsonValue>;
  };
};

// Create a type for environment variables
export type EnvVar<T extends string> = {
  [K in T]: string | undefined;
};