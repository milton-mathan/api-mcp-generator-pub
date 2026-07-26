import React, { useState, useCallback } from 'react';
import {
  DocumentArrowUpIcon,
  LinkIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import type { InputMetadata, ParsedSpec } from '../types';

// The parser pulls in swagger-parser, js-yaml and axios - roughly 300 KB, and
// none of it is needed until the user actually supplies a specification. These
// are imported dynamically so they stay out of the initial page load. JSZip is
// handled the same way in MCPGenerator.
const loadParser = () => import('../services/specParser');
const loadUrlFetcher = () => import('../services/urlFetcher');

interface InputError {
  type?: 'parsing' | 'network' | 'validation';
  message: string;
  details?: unknown;
}

interface InputHandlerProps {
  onSpecLoaded: (spec: ParsedSpec, metadata: InputMetadata, warnings: string[]) => void;
  onError: (error: InputError) => void;
}

/** Pick the parser's format hint from a filename. */
function formatFromFilename(filename: string): 'json' | 'yaml' {
  return /\.ya?ml$/i.test(filename) ? 'yaml' : 'json';
}

/**
 * Guess the format of pasted text. YAML is a superset of JSON, so anything
 * that does not start with a JSON opener is treated as YAML.
 */
function formatFromContent(content: string): 'json' | 'yaml' {
  return content.trimStart().startsWith('{') ? 'json' : 'yaml';
}

type InputMethod = 'file' | 'url' | 'paste';

export const InputHandler: React.FC<InputHandlerProps> = ({ onSpecLoaded, onError }) => {
  const [activeMethod, setActiveMethod] = useState<InputMethod>('file');
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [dragActive, setDragActive] = useState(false);

  /**
   * Run raw text through the spec parser and hand the normalized result up.
   *
   * The parser owns format detection, OpenAPI 3.x / Swagger 2.0 normalization,
   * and structural validation. Parsing inline here is what previously broke
   * YAML support and skipped validation entirely.
   */
  const loadFromContent = useCallback(async (
    content: string,
    format: 'json' | 'yaml',
    metadata: InputMetadata,
  ) => {
    const { parseSpecFromFile } = await loadParser();

    const result = await parseSpecFromFile({
      // The parser only reads `content`, `type` and `size`.
      file: null as unknown as File,
      content,
      type: format,
      size: content.length,
      lastModified: Date.now(),
    });

    if (result.errors.length > 0) {
      // Keep the parser's own classification: a malformed document is a
      // 'parsing' failure, a structurally invalid one is 'validation'.
      const [first] = result.errors;
      onError({
        type: first.type === 'parsing' ? 'parsing' : 'validation',
        message: result.errors.map(e => e.message).join('; '),
        details: result.errors,
      });
      return;
    }

    onSpecLoaded(result.spec as unknown as ParsedSpec, metadata, result.warnings);
  }, [onSpecLoaded, onError]);

  const handleFileUpload = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const content = await file.text();
      await loadFromContent(content, formatFromFilename(file.name), {
        source: 'file',
        filename: file.name,
        timestamp: Date.now(),
        size: file.size,
      });
    } catch (error) {
      onError({
        type: 'parsing',
        message: error instanceof Error ? error.message : 'Failed to parse file',
        details: error,
      });
    } finally {
      setLoading(false);
    }
  }, [loadFromContent, onError]);

  const handleUrlFetch = useCallback(async () => {
    if (!urlInput.trim()) return;

    setLoading(true);
    try {
      const { fetchSpecFromUrl } = await loadUrlFetcher();
      const result = await fetchSpecFromUrl({ url: urlInput });

      if (result.errors.length > 0) {
        onError({
          type: 'network',
          message: result.errors.map(e => e.message).join('; '),
          details: result.errors,
        });
        return;
      }

      onSpecLoaded(result.spec as unknown as ParsedSpec, {
        source: 'url',
        url: urlInput,
        timestamp: Date.now(),
        size: result.metadata?.size,
      }, result.warnings);
    } catch (error) {
      onError({
        type: 'network',
        message: error instanceof Error ? error.message : 'Failed to fetch from URL',
        details: error,
      });
    } finally {
      setLoading(false);
    }
  }, [urlInput, onSpecLoaded, onError]);

  const handlePasteContent = useCallback(async () => {
    if (!pasteContent.trim()) return;

    setLoading(true);
    try {
      await loadFromContent(pasteContent, formatFromContent(pasteContent), {
        source: 'paste',
        timestamp: Date.now(),
        size: pasteContent.length,
      });
    } catch (error) {
      onError({
        type: 'parsing',
        message: error instanceof Error ? error.message : 'Could not parse the pasted content.',
        details: error,
      });
    } finally {
      setLoading(false);
    }
  }, [pasteContent, loadFromContent, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const renderFileUpload = () => (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="mt-2 block text-sm font-medium text-gray-900">
              Drop your OpenAPI file here, or{' '}
              <span className="text-blue-600 hover:text-blue-500">browse</span>
            </span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              accept=".json,.yaml,.yml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </label>
          <p className="mt-1 text-xs text-gray-500">
            JSON, YAML files up to 10MB
          </p>
        </div>
      </div>
    </div>
  );

  const renderUrlInput = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-2">
          OpenAPI Specification URL
        </label>
        <div className="flex space-x-2">
          <input
            id="url-input"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://api.example.com/openapi.json"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleUrlFetch}
            disabled={!urlInput.trim() || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Fetch'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPasteInput = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="paste-content" className="block text-sm font-medium text-gray-700 mb-2">
          Paste OpenAPI Specification
        </label>
        <textarea
          id="paste-content"
          value={pasteContent}
          onChange={(e) => setPasteContent(e.target.value)}
          placeholder="Paste your OpenAPI specification JSON here..."
          rows={10}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
        <button
          onClick={handlePasteContent}
          disabled={!pasteContent.trim() || loading}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Parsing...' : 'Parse Specification'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          API Specification Input
        </h2>
        <p className="text-gray-600">
          Choose how you'd like to provide your OpenAPI specification
        </p>
      </div>

      {/* Method Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveMethod('file')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeMethod === 'file'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DocumentArrowUpIcon className="h-5 w-5 inline mr-2" />
            Upload File
          </button>
          <button
            onClick={() => setActiveMethod('url')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeMethod === 'url'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <LinkIcon className="h-5 w-5 inline mr-2" />
            Enter URL
          </button>
          <button
            onClick={() => setActiveMethod('paste')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeMethod === 'paste'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardDocumentIcon className="h-5 w-5 inline mr-2" />
            Paste Content
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {activeMethod === 'file' && renderFileUpload()}
        {activeMethod === 'url' && renderUrlInput()}
        {activeMethod === 'paste' && renderPasteInput()}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100">
            <div className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-700">
              <svg fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            Processing...
          </div>
        </div>
      )}
    </div>
  );
};