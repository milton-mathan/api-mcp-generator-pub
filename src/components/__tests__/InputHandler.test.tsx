import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/utils';
import { InputHandler } from '../InputHandler';
import { mockOpenAPIDocument } from '../../test/mocks/openapi';
import { createMockFile } from '../../test/utils';
import { fetchSpecFromUrl } from '../../services/urlFetcher';

// InputHandler delegates to the urlFetcher service, so the service is mocked
// rather than global.fetch. Stubbing fetch would leave the service's retry
// loop running and let a failing test reach the network.
vi.mock('../../services/urlFetcher', () => ({
  fetchSpecFromUrl: vi.fn(),
}));

const mockFetchSpec = vi.mocked(fetchSpecFromUrl);

const okResult = {
  spec: mockOpenAPIDocument,
  errors: [],
  warnings: [],
  metadata: { version: '3.0.0', format: 'json' as const, size: 100,
              endpointCount: 3, tagCount: 1, schemaCount: 0, parseTime: 1 },
};

/** The parser normalizes input, so assert on shape rather than identity. */
const normalizedSpec = expect.objectContaining({
  info: expect.objectContaining({ title: 'Test API' }),
  paths: expect.any(Object),
});

describe('InputHandler', () => {
  const defaultProps = {
    onSpecLoaded: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSpec.mockReset();
    mockFetchSpec.mockResolvedValue(okResult as never);
  });

  it('should render input options', () => {
    render(<InputHandler {...defaultProps} />);

    expect(screen.getByText('Upload File')).toBeInTheDocument();
    expect(screen.getByText('Enter URL')).toBeInTheDocument();
    expect(screen.getByText('Paste Content')).toBeInTheDocument();
  });

  it('should handle file upload', async () => {
    render(<InputHandler {...defaultProps} />);

    const fileInput = screen.getByLabelText(/drop your openapi file here/i);
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(defaultProps.onSpecLoaded).toHaveBeenCalledWith(
        normalizedSpec,
        expect.objectContaining({ source: 'file', filename: 'test.json' }),
        expect.any(Array),
      );
    });
  });

  it('should handle URL input', async () => {
    render(<InputHandler {...defaultProps} />);

    // Switch to URL tab
    fireEvent.click(screen.getByText('Enter URL'));

    const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com\/openapi\.json/i);
    const fetchButton = screen.getByText('Fetch');

    fireEvent.change(urlInput, { target: { value: 'https://api.example.com/openapi.json' } });
    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(mockFetchSpec).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.example.com/openapi.json' })
      );
      expect(defaultProps.onSpecLoaded).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          source: 'url',
          url: 'https://api.example.com/openapi.json',
        }),
        expect.any(Array),
      );
    });
  });

  it('should handle URL input with fetch errors', async () => {
    // The fetcher reports failure through the result, not by throwing.
    mockFetchSpec.mockResolvedValue({
      spec: null,
      errors: [{ type: 'network', message: 'HTTP 404: Not Found',
                 timestamp: Date.now(), recoverable: false }],
      warnings: [],
      metadata: { version: 'unknown', format: 'json', size: 0, endpointCount: 0,
                  tagCount: 0, schemaCount: 0, parseTime: 1 },
    } as never);

    render(<InputHandler {...defaultProps} />);

    // Switch to URL tab
    fireEvent.click(screen.getByText('Enter URL'));

    const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com\/openapi\.json/i);
    const fetchButton = screen.getByText('Fetch');

    fireEvent.change(urlInput, { target: { value: 'https://api.example.com/openapi.json' } });
    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'network',
          message: 'HTTP 404: Not Found',
        })
      );
    });
  });

  it('should handle paste content', async () => {
    render(<InputHandler {...defaultProps} />);

    // Switch to paste tab
    fireEvent.click(screen.getByText('Paste Content'));

    const textarea = screen.getByPlaceholderText(/paste your openapi specification json here/i);
    const parseButton = screen.getByText('Parse Specification');

    fireEvent.change(textarea, { target: { value: JSON.stringify(mockOpenAPIDocument) } });
    fireEvent.click(parseButton);

    await waitFor(() => {
      expect(defaultProps.onSpecLoaded).toHaveBeenCalledWith(
        normalizedSpec,
        expect.objectContaining({ source: 'paste' }),
        expect.any(Array),
      );
    });
  });

  it('should handle parsing errors', async () => {
    render(<InputHandler {...defaultProps} />);

    const fileInput = screen.getByLabelText(/drop your openapi file here/i);
    const file = createMockFile('invalid json', 'test.json');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parsing',
          message: expect.stringContaining('JSON'),
        })
      );
    });
  });

  it('should handle network errors for URL input', async () => {
    mockFetchSpec.mockRejectedValue(new Error('Failed to fetch'));

    render(<InputHandler {...defaultProps} />);

    fireEvent.click(screen.getByText('Enter URL'));

    const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com\/openapi\.json/i);
    const fetchButton = screen.getByText('Fetch');

    fireEvent.change(urlInput, { target: { value: 'https://invalid-url.com/spec.json' } });
    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'network',
          message: 'Failed to fetch',
        })
      );
    });
  });

  it('should show loading state during processing', async () => {
    // Create a promise that we can control
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockFetchSpec.mockReturnValue(promise as never);

    render(<InputHandler {...defaultProps} />);

    // Switch to URL tab
    fireEvent.click(screen.getByText('Enter URL'));

    const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com\/openapi\.json/i);
    const fetchButton = screen.getByText('Fetch');

    fireEvent.change(urlInput, { target: { value: 'https://api.example.com/spec.json' } });
    fireEvent.click(fetchButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    // Resolve the promise
    resolvePromise!(okResult);

    // Loading should disappear
    await waitFor(() => {
      expect(screen.queryByText(/processing/i)).not.toBeInTheDocument();
    });
  });

  it('should validate URL format', () => {
    render(<InputHandler {...defaultProps} />);

    fireEvent.click(screen.getByText('Enter URL'));

    const urlInput = screen.getByPlaceholderText(/https:\/\/api\.example\.com\/openapi\.json/i);
    const fetchButton = screen.getByText('Fetch');

    // Empty URL
    fireEvent.change(urlInput, { target: { value: '' } });
    expect(fetchButton).toBeDisabled();

    // Valid URL
    fireEvent.change(urlInput, { target: { value: 'https://api.example.com/spec.json' } });
    expect(fetchButton).not.toBeDisabled();
  });

  it('should handle drag and drop', async () => {
    render(<InputHandler {...defaultProps} />);

    const dropZone = screen.getByText(/drop your openapi file here/i).closest('div');
    const file = createMockFile(JSON.stringify(mockOpenAPIDocument), 'test.json');

    // Simulate drag and drop
    fireEvent.dragOver(dropZone!);
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(defaultProps.onSpecLoaded).toHaveBeenCalledWith(
        normalizedSpec,
        expect.objectContaining({
          source: 'file',
          filename: 'test.json',
        }),
        expect.any(Array),
      );
    });
  });
});