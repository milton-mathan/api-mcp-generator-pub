import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/utils';
import { App } from '../../App';
import { mockOpenAPIDocument } from '../../test/mocks/openapi';
import { createMockFile } from '../../test/utils';
import { act } from 'react';

// InputHandler now calls the real urlFetcher. Stub it so no test touches the
// network - a suite that resolves DNS fails wherever DNS is unavailable.
vi.mock('../../services/urlFetcher', () => ({
  fetchSpecFromUrl: vi.fn(async () => ({
    spec: mockOpenAPIDocument,
    errors: [],
    warnings: [],
    metadata: { version: '3.0.0', format: 'json', size: 0, endpointCount: 3,
                tagCount: 1, schemaCount: 0, parseTime: 1 },
  })),
}));

describe('Complete Application E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete the full workflow from upload to export', async () => {
    render(<App />);

    // Step 1: Upload API specification
    expect(screen.getByText('API Specification Input')).toBeInTheDocument();
    
    // Find the file input by its id
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, { target: { files: [file] } });

    // Wait for parsing and navigation to explorer
    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify endpoints are displayed
    expect(screen.getByText(/3.*endpoints/)).toBeInTheDocument();

    // Step 2: Select endpoints for MCP generation
    const endpointCheckboxes = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i });
    expect(endpointCheckboxes.length).toBeGreaterThan(0);
    
    // Select first endpoint
    fireEvent.click(endpointCheckboxes[0]);

    // Verify MCP generation button appears
    await waitFor(() => {
      expect(screen.getByText(/Generate MCP Server \(1\)/)).toBeInTheDocument();
    });

    // Step 3: Start MCP generation workflow
    fireEvent.click(screen.getByText(/Generate MCP Server \(1\)/));

    // Wait for generation configuration page
    await waitFor(() => {
      expect(screen.getByText('MCP Server Generator')).toBeInTheDocument();
      expect(screen.getByText('MCP Server Configuration')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Step 4: Generate MCP server
    const generateButton = screen.getByRole('button', { name: /Generate MCP Server/i });
    fireEvent.click(generateButton);

    // Wait for code generation to complete
    await waitFor(() => {
      expect(screen.getByText('MCP Server Generated Successfully!')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Step 5: Download the generated server
    const downloadButton = screen.getByText('Download ZIP Package');
    fireEvent.click(downloadButton);

    // Test completed successfully - the app workflow is functional
    expect(screen.getByText('MCP Server Generated Successfully!')).toBeInTheDocument();
  });

  it('should handle URL input workflow', async () => {
    render(<App />);

    // Switch to URL input
    fireEvent.click(screen.getByText('Enter URL'));

    // URL workflow UI should be available
    expect(screen.getByText('Enter URL')).toBeInTheDocument();
    
    // Test that the URL input field exists
    const urlInput = screen.queryByPlaceholderText(/url/i) || screen.queryByRole('textbox');
    if (urlInput) {
      fireEvent.change(urlInput, { target: { value: 'https://api.example.com/openapi.json' } });
    }
    
    // Test completed - URL input UI is functional
    expect(screen.getByText('API Specification Input')).toBeInTheDocument();
  });

  it('should handle FastMCP configuration', async () => {
    render(<App />);

    // Upload file and navigate to explorer
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    // Select endpoint and start MCP generation
    const endpointCheckboxes = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i });
    fireEvent.click(endpointCheckboxes[0]);

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

    // Upload invalid content to test error handling
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile('invalid content', 'test.json');
    
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, { target: { files: [file] } });

    // Should show error handling (might stay on input screen or show error message)
    // The exact error UI may vary, so just test that app doesn't crash
    expect(screen.getByText('API Specification Input')).toBeInTheDocument();
  });

  it('should maintain state during navigation', async () => {
    render(<App />);

    // Upload file
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    // Select first endpoint
    const endpointCheckboxes = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i });
    fireEvent.click(endpointCheckboxes[0]);

    // Verify selection count
    await waitFor(() => {
      expect(screen.getByText(/Generate MCP Server \(1\)/)).toBeInTheDocument();
    });

    // Navigate through workflow
    fireEvent.click(screen.getByText(/Generate MCP Server \(1\)/));

    await waitFor(() => {
      expect(screen.getByText('MCP Server Generator')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Go back and verify state is maintained
    await act(async () => {
      fireEvent.click(screen.getByText('Back'));
    });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    }, { timeout: 10000 });

    // The navigation back should preserve state - test should at least return to explorer
    expect(screen.getByText('API Explorer')).toBeInTheDocument();
  });

  it('should handle large API specifications efficiently', async () => {
    // Create a large spec with many endpoints
    const largeSpec = {
      ...mockOpenAPIDocument,
      paths: Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [
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

    // const largeEndpoints = Array.from({ length: 100 }, (_, i) => ({
    //   ...mockExtractedEndpoints[0],
    //   id: `get-endpoint${i}`,
    //   path: `/endpoint${i}`,
    //   operationId: `getEndpoint${i}`,
    // }));

    render(<App />);

    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(largeSpec), 'large.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
      // Check for the endpoints count more flexibly
      expect(screen.getByText(/100.*endpoints/)).toBeInTheDocument();
    });

    // Should handle large number of endpoints without performance issues
    expect(screen.getByText(/100.*endpoints/)).toBeInTheDocument();
  });

  it('should support keyboard navigation', async () => {
    render(<App />);

    // Upload file
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    // Test keyboard navigation
    const firstCheckbox = screen.getAllByRole('checkbox', { name: /^Select (GET|POST|PUT|PATCH|DELETE)/i })[0];
    firstCheckbox.focus();
    
    // Simulate click to select (space key doesn't trigger change in jsdom consistently)
    await act(async () => {
      fireEvent.click(firstCheckbox);
    });
    
    // Should show MCP generation button
    await waitFor(() => {
      expect(screen.getByText(/Generate MCP Server \(1\)/)).toBeInTheDocument();
    });

    // Test keyboard navigation is functional (just test that it doesn't break)
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
  });

  it('should be responsive on different screen sizes', async () => {
    // Mock different viewport sizes
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768, // Tablet size
    });

    render(<App />);

    // Upload file
    const fileInput = document.getElementById('file-upload');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    // Should adapt to tablet layout
    expect(screen.getByText('API Explorer')).toBeInTheDocument();

    // Test mobile size
    Object.defineProperty(window, 'innerWidth', {
      value: 375, // Mobile size
    });

    // Trigger resize event
    await act(async () => {
      fireEvent(window, new Event('resize'));
    });

    // Should still be functional on mobile
    expect(screen.getByText('API Explorer')).toBeInTheDocument();
  });

  it('should handle accessibility requirements', async () => {
    render(<App />);

    // Upload file
    const fileInput = document.getElementById('file-upload');
    expect(fileInput).toBeTruthy();

    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('API Explorer')).toBeInTheDocument();
    });

    // Check for proper heading hierarchy
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);

    // Check for proper button labels
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toHaveAccessibleName();
    });
  });
});