import React, { ReactElement, act } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock Zustand stores for testing
export const mockAppStore = {
  inputSpec: null,
  inputMetadata: null,
  endpoints: [],
  selectedEndpoints: new Set<string>(),
  explorerConfig: {
    groupBy: 'tags' as const,
    searchQuery: '',
    expandedGroups: new Set<string>(),
    viewMode: 'tree' as const,
  },
  mcpConfig: {
    serverName: 'Test Server',
    baseUrl: 'https://api.example.com',
    endpoints: [],
    authConfigs: {},
    toolNaming: 'operationId' as const,
    includeExamples: true,
    errorHandling: 'basic' as const,
    pythonVersion: '3.9' as const,
  },
  generatedProject: null,
  currentPhase: 'input' as const,
  loading: false,
  error: null,
  setInputSpec: vi.fn(),
  setEndpoints: vi.fn(),
  toggleEndpoint: vi.fn(),
  setMCPConfig: vi.fn(),
  setGeneratedProject: vi.fn(),
  setPhase: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  reset: vi.fn(),
};

export const mockUIStore = {
  toasts: [],
  theme: 'light' as const,
  sidebarOpen: true,
  addToast: vi.fn(),
  removeToast: vi.fn(),
  clearToasts: vi.fn(),
  setTheme: vi.fn(),
  setSidebarOpen: vi.fn(),
};

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Export act from React for test utilities
export { act };

export * from '@testing-library/react';
export { customRender as render };

// Helper functions for testing
export const createMockFile = (content: string, filename = 'test.json', type = 'application/json') => {
  const file = new File([content], filename, { type });
  // Ensure the file has the text method for testing
  if (!file.text) {
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(content),
      writable: false,
    });
  }
  return file;
};

export const createMockEvent = (overrides = {}) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  target: { value: '' },
  ...overrides,
});

export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

// Mock fetch responses
export const mockFetchSuccess = (data: unknown) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
};

export const mockFetchError = (status = 500, statusText = 'Internal Server Error') => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: () => Promise.reject(new Error('Failed to parse JSON')),
    text: () => Promise.resolve(statusText),
  } as Response);
};

export const mockFetchNetworkError = () => {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
};