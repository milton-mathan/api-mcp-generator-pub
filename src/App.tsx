import React, { useState } from 'react';
import { InputHandler } from './components/InputHandler';
import { ApiExplorer } from './components/ApiExplorer';
import { MCPGenerator } from './components/MCPGenerator';
import type { InputMetadata, ParsedSpec } from './types';
import type { ExtractedEndpoint } from './services/endpointExtractor';

type AppPhase = 'input' | 'explorer' | 'generator';

interface ErrorInfo {
  message: string;
  details?: unknown;
}

export const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>('input');
  const [spec, setSpec] = useState<ParsedSpec | null>(null);
  const [metadata, setMetadata] = useState<InputMetadata | null>(null);
  const [selectedEndpoints, setSelectedEndpoints] = useState<ExtractedEndpoint[]>([]);
  const [specWarnings, setSpecWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSpecLoaded = (
    loadedSpec: ParsedSpec,
    loadedMetadata: InputMetadata,
    warnings: string[] = [],
  ) => {
    setSpec(loadedSpec);
    setMetadata(loadedMetadata);
    setSpecWarnings(warnings);
    setError(null);
    setPhase('explorer');
  };

  const handleError = (errorInfo: ErrorInfo) => {
    setError(errorInfo.message || 'An error occurred');
  };

  const handleGenerateMCP = (endpoints: ExtractedEndpoint[]) => {
    setSelectedEndpoints(endpoints);
    setPhase('generator');
  };

  const handleBackToInput = () => {
    setPhase('input');
    setSpec(null);
    setMetadata(null);
    setSelectedEndpoints([]);
    setSpecWarnings([]);
    setError(null);
  };

  const handleBackToExplorer = () => {
    setPhase('explorer');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                API MCP Generator
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              {phase === 'input' && 'Step 1: Input Specification'}
              {phase === 'explorer' && 'Step 2: Explore & Select'}
              {phase === 'generator' && 'Step 3: Generate MCP Server'}
            </div>
          </div>
        </div>
      </header>

      {/* id is the skip link's target - see index.html */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase Content */}
        {phase === 'input' && (
          <InputHandler
            onSpecLoaded={handleSpecLoaded}
            onError={handleError}
          />
        )}

        {phase === 'explorer' && spec && (
          <ApiExplorer
            spec={spec}
            metadata={metadata}
            warnings={specWarnings}
            onBack={handleBackToInput}
            onGenerateMCP={handleGenerateMCP}
          />
        )}

        {phase === 'generator' && spec && (
          <MCPGenerator
            spec={spec}
            endpoints={selectedEndpoints}
            onBack={handleBackToExplorer}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>
              Transform OpenAPI specifications into interactive exploration tools and generate Python MCP servers.
            </p>
            <p className="mt-2">
              Built with React, TypeScript, and Tailwind CSS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};