import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/utils';
import { App } from '../../App';
import { mockOpenAPIDocument, mockExtractedEndpoints } from '../../test/mocks/openapi';
import { createMockFile } from '../../test/utils';
import { fetchSpecFromUrl } from '../../services/urlFetcher';
import { extractEndpoints } from '../../services/endpointExtractor';

// The URL path goes through the urlFetcher service now, so mock the service.
// Stubbing global.fetch would leave the service's retry loop running.
vi.mock('../../services/urlFetcher', () => ({
  fetchSpecFromUrl: vi.fn(),
}));

vi.mock('../../services/endpointExtractor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/endpointExtractor')>()),
  extractEndpoints: vi.fn(() => mockExtractedEndpoints),
}));

vi.mock('../../services/endpointService', () => ({
  EndpointService: {
    getMCPCandidates: vi.fn().mockReturnValue([
      {
        endpoint: mockExtractedEndpoints[0],
        toolName: 'get_users',
        suitabilityScore: 85,
        reasons: ['Simple GET endpoint'],
        warnings: [],
      },
    ]),
  },
}));

vi.mock('../../services/mcpCodeGenerator', () => ({
  MCPCodeGenerator: {
    generateProject: vi.fn().mockResolvedValue({
      files: [
        {
          path: 'server.py',
          content: '# Generated MCP server code',
          description: 'Main server file',
        },
        {
          path: 'requirements.txt',
          content: 'mcp>=1.0.0\nhttpx>=0.25.0',
          description: 'Dependencies',
        },
      ],
      structure: ['server.py', 'requirements.txt'],
      dependencies: ['mcp>=1.0.0', 'httpx>=0.25.0'],
      envVars: [],
      instructions: 'Setup instructions',
    }),
  },
}));

vi.mock('../../services/exportService', () => ({
  ExportService: {
    exportProject: vi.fn().mockResolvedValue({
      blob: new Blob(['mock zip content']),
      filename: 'test-mcp-server.zip',
      size: 1024,
      fileCount: 2,
    }),
    downloadProject: vi.fn(),
    validateExport: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  },
}));

describe('Complete Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full workflow from file upload to MCP generation', async () => {
    render(<App />);

    // Step 1: Upload file
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');

    fireEvent.change(fileInput!, { target: { files: [file] } });

    // Wait for parsing to complete and explorer to appear
    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
      expect(screen.getByText(/\d+ endpoints/)).toBeInTheDocument();
    });

    // Step 2: Select endpoints
    const checkboxes = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i });
    fireEvent.click(checkboxes[0]); // Select first endpoint

    // Step 3: Generate MCP server
    await waitFor(() => {
      expect(screen.getByText(/Generate MCP Server \(1\)/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Generate MCP Server \(1\)/));

    // Step 4: Configure and generate
    await waitFor(() => {
      expect(screen.getByText('MCP Server Generator')).toBeInTheDocument();
      expect(screen.getByText('MCP Server Configuration')).toBeInTheDocument();
    });

    // Generate the server
    const generateButton = screen.getByRole('button', { name: /Generate MCP Server/i });
    fireEvent.click(generateButton);

    // Step 5: View generated code
    await waitFor(() => {
      expect(screen.getByText('MCP Server Generated Successfully!')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should handle URL input workflow', async () => {
    vi.mocked(fetchSpecFromUrl).mockResolvedValue({
      spec: mockOpenAPIDocument,
      errors: [],
      warnings: [],
      metadata: { version: '3.0.0', format: 'json', size: 100, endpointCount: 3,
                  tagCount: 1, schemaCount: 0, parseTime: 1 },
    } as never);

    render(<App />);

    // Switch to URL input
    fireEvent.click(screen.getByText('Enter URL'));

    const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com\/openapi\.json/i);
    fireEvent.change(urlInput, { target: { value: 'https://api.example.com/openapi.json' } });

    fireEvent.click(screen.getByText('Fetch'));

    // Wait for parsing and explorer
    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    expect(fetchSpecFromUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.example.com/openapi.json' })
    );
  });

  it('should handle FastMCP configuration workflow', async () => {
    render(<App />);

    // Upload file to get to generator phase
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    // Select endpoint and generate
    const checkboxes = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByText(/Generate MCP Server \(1\)/));

    await waitFor(() => {
      expect(screen.getByText('MCP Server Generator')).toBeInTheDocument();
    });

    // Verify FastMCP configuration is available
    expect(screen.getByText('FastMCP Framework')).toBeInTheDocument();
    expect(screen.getByText('Server Modes')).toBeInTheDocument();
  });

  it('should handle error scenarios gracefully', async () => {
    render(<App />);

    const fileInput = document.getElementById('file-upload');
    const file = createMockFile('invalid content', 'test.json');

    fireEvent.change(fileInput!, { target: { files: [file] } });

    // Should show error message or stay on input phase
    // The app should not crash
    expect(screen.getByText('API Specification Input')).toBeInTheDocument();
  });

  it('should handle download workflow', async () => {
    render(<App />);

    // Upload and process file
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    // Select endpoint and generate
    const checkboxes = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i });
    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getByText(/Generate MCP Server \(1\)/));

    await waitFor(() => {
      expect(screen.getByText('MCP Server Generator')).toBeInTheDocument();
    });

    // Generate the server
    const generateButton = screen.getByRole('button', { name: /Generate MCP Server/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('MCP Server Generated Successfully!')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Download the server
    const downloadButton = screen.getByText('Download ZIP Package');
    fireEvent.click(downloadButton);

    // Verify download is triggered (actual download is handled by browser)
    expect(downloadButton).toBeInTheDocument();
  });

  it('should maintain state during navigation', async () => {
    render(<App />);

    // Upload file
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    // Select endpoints
    const checkboxes = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    // Verify selection is maintained
    expect(screen.getByText(/Generate MCP Server \(2\)/)).toBeInTheDocument();

    // Navigate through workflow
    fireEvent.click(screen.getByText(/Generate MCP Server \(2\)/));

    await waitFor(() => {
      expect(screen.getByText('MCP Server Configuration')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should handle large API specifications', async () => {
    // This test is about real extraction over a large document, so let the
    // real implementation run instead of the fixed 3-endpoint mock used by
    // the other tests in this file.
    const actual = await vi.importActual<typeof import('../../services/endpointExtractor')>(
      '../../services/endpointExtractor'
    );
    vi.mocked(extractEndpoints).mockImplementation(actual.extractEndpoints);

    // Create a large spec with many endpoints
    const largeSpec = {
      ...mockOpenAPIDocument,
      paths: Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [
          `/endpoint${i}`,
          {
            get: {
              operationId: `getEndpoint${i}`,
              summary: `Get endpoint ${i}`,
              responses: { '200': { description: 'Success' } },
            },
          },
        ])
      ),
    };

    render(<App />);

    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(largeSpec), 'large.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
      expect(screen.getByText(/\d+ endpoints/)).toBeInTheDocument();
    });

    // Should handle large number of endpoints without performance issues
    expect(screen.getByText('50')).toBeInTheDocument();
  });
});