import React, { useState } from 'react';
import {
  ArrowLeftIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { FastMCPConfig } from './FastMCPConfig';
import { MCPResults } from './MCPResults';
import type { MCPConfig } from '../types/mcp';
import type { GeneratedProject } from '../services/mcpCodeGenerator';
import { MCPCodeGenerator } from '../services/mcpCodeGenerator';
import { resolveBaseUrl, type BaseUrlSource } from '../services/baseUrlResolver';
import type { ExtractedEndpoint } from '../services/endpointExtractor';
import { generateTestClient } from '../services/testClientGenerator';

/** The subset of a parsed spec this component reads. */
interface MCPGeneratorSpec extends BaseUrlSource {
  info?: { title?: string; version?: string; description?: string };
}

interface MCPGeneratorProps {
  spec: MCPGeneratorSpec;
  /** Fully extracted endpoints selected in the explorer. */
  endpoints: ExtractedEndpoint[];
  onBack: () => void;
}

export const MCPGenerator: React.FC<MCPGeneratorProps> = ({
  spec,
  endpoints,
  onBack,
}) => {
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(true);
  const [mcpConfig, setMcpConfig] = useState<MCPConfig>({
    endpoints: endpoints.map(e => e.id),
    serverName: spec.info?.title?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'api_server',
    baseUrl: resolveBaseUrl(spec),
    authentication: undefined,
    toolNaming: 'operationId',
    includeExamples: true,
    errorHandling: 'detailed',
    customToolNames: {},
    // FastMCP options
    useFastMCP: true,
    serverModes: ['stdio'],
    httpPort: 8000,
    logLevel: 'INFO',
    includeRunScripts: true,
    pythonVersion: '3.11',
  });

  const handleConfigChange = (updates: Partial<MCPConfig>) => {
    setMcpConfig(prev => ({ ...prev, ...updates }));
  };

  const generateMCPServer = async () => {
    setIsGenerating(true);
    setShowConfig(false);
    setGenerationError(null);
    
    try {
      // Endpoints arrive fully extracted from the explorer - real paths,
      // parameters, request bodies and responses. They are passed straight
      // through; nothing is reconstructed here.
      const project = await MCPCodeGenerator.generateProject({
        serverName: mcpConfig.serverName,
        baseUrl: mcpConfig.baseUrl,
        endpoints,
        authConfigs: {},
        toolNaming: mcpConfig.toolNaming,
        includeExamples: mcpConfig.includeExamples,
        errorHandling: mcpConfig.errorHandling,
        pythonVersion: mcpConfig.pythonVersion,
        useFastMCP: mcpConfig.useFastMCP,
        serverModes: mcpConfig.serverModes,
        httpPort: mcpConfig.httpPort,
        logLevel: mcpConfig.logLevel,
        includeRunScripts: mcpConfig.includeRunScripts,
      });

      setGeneratedProject(project);
      setIsGenerated(true);
    } catch (error) {
      // No fallback project here.
      //
      // This used to substitute a hand-written stub - a server.py that
      // implemented no MCP protocol, printed to stdout (which is the JSON-RPC
      // transport), and carried uninterpolated `{mcpConfig.serverName}` into
      // the Python as an f-string over an undefined name, so it raised
      // NameError on startup. It then called setIsGenerated(true), so the user
      // saw a success screen and downloaded a server that had never been
      // generated. A visible failure is strictly better than a file that
      // cannot work.
      console.error('Error generating MCP server:', error);
      setGenerationError(
        error instanceof Error ? error.message : 'Unknown error while generating the server'
      );
      setGeneratedProject(null);
      setIsGenerated(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAllFiles = async () => {
    if (!generatedProject) return;
    setDownloadError(null);

    try {
      // Imported dynamically: exportService pulls in JSZip, ~97 KB that has no
      // business in the initial page load. Nothing may import it statically.
      const { ExportService } = await import('../services/exportService');

      // A project missing server.py or carrying empty files should fail here,
      // visibly, rather than download as a plausible-looking archive.
      const validation = ExportService.validateExport(generatedProject);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      const result = await ExportService.exportProject(
        generatedProject,
        mcpConfig.serverName,
        {
          // The name FEATURES.md documents. ExportService's own default is
          // date-stamped, which would silently rename every download.
          filename: `${mcpConfig.serverName}_mcp_server.zip`,
          // Test client, from the shared generator - see testClientGenerator.ts
          extraFiles: [
            {
              path: 'test_client.py',
              content: generateTestClient(mcpConfig.serverName),
              description: 'Standalone client that launches the server and calls every tool',
            },
          ],
        }
      );

      ExportService.downloadProject(result);
    } catch (error) {
      // This used to silently download a single .txt of every file
      // concatenated - not a project, not extractable, and indistinguishable
      // from success unless you noticed the extension. The reason went only to
      // the console. Say what happened instead.
      console.error('Error creating ZIP file:', error);
      setDownloadError(
        error instanceof Error ? error.message : 'Unknown error while building the ZIP'
      );
    }
  };

  /** Every file concatenated into one text file. Explicit escape hatch. */
  const downloadAsText = () => {
    if (!generatedProject) return;

    const allContent = generatedProject.files
      .map(file => `=== ${file.path} ===\n${file.content}\n\n`)
      .join('');

    const blob = new Blob([allContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mcpConfig.serverName}_mcp_server.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">MCP Server Generator</h2>
            <p className="text-gray-600">
              Generate Python MCP server for {endpoints.length} endpoints
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Step */}
      {showConfig && !isGenerated && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              MCP Server Configuration
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">API:</span>
                  <span className="ml-2 font-medium">{spec.info?.title || 'Unknown API'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Selected Endpoints:</span>
                  <span className="ml-2 font-medium">{endpoints.length}</span>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Selected Endpoints:</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {endpoints.map(endpoint => {
                    const { method, path } = endpoint;
                    return (
                      <div key={endpoint.id} className="flex items-center space-x-2 text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          method === 'GET' ? 'bg-green-100 text-green-800' :
                          method === 'POST' ? 'bg-blue-100 text-blue-800' :
                          method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                          method === 'DELETE' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {method}
                        </span>
                        <code className="font-mono text-gray-900">{path}</code>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* FastMCP Configuration */}
          <FastMCPConfig
            config={mcpConfig}
            onChange={handleConfigChange}
          />

          {/* Generate Button */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <button
              onClick={generateMCPServer}
              disabled={isGenerating}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <CogIcon className="h-5 w-5 mr-2" />
              Generate MCP Server
            </button>
          </div>
        </div>
      )}

      {/* Generation Status */}
      {!showConfig && !isGenerated && isGenerating && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-600">
              <svg fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Generating MCP Server...</h3>
              <p className="text-gray-600">
                {mcpConfig.useFastMCP ? 'Creating FastMCP server with enhanced features' : 'Creating basic MCP server'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Generation failed. Shown instead of a result, never alongside one -
          a stub project used to be substituted here and reported as success. */}
      {!isGenerating && generationError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6"
        >
          <h3 className="text-lg font-medium text-red-900">
            Could not generate the MCP server
          </h3>
          <p className="mt-2 text-sm text-red-800">{generationError}</p>
          <p className="mt-3 text-sm text-red-700">
            Nothing was generated, so there is no download. Go back and adjust
            the selection or configuration, then try again.
          </p>
          <button
            onClick={() => {
              setGenerationError(null);
              setShowConfig(true);
            }}
            className="mt-4 px-4 py-2 text-sm font-medium text-red-800 bg-red-100 rounded-md hover:bg-red-200"
          >
            Back to configuration
          </button>
        </div>
      )}

      {/* ZIP build failed. The .txt is offered here as a deliberate choice,
          never substituted silently for the ZIP the user asked for. */}
      {downloadError && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6"
        >
          <h4 className="text-sm font-medium text-amber-900">
            Could not build the ZIP
          </h4>
          <p className="mt-1 text-sm text-amber-800">{downloadError}</p>
          <p className="mt-2 text-sm text-amber-700">
            The individual file downloads below still work. You can also take
            everything as one text file, which you would need to split by hand.
          </p>
          <button
            onClick={downloadAsText}
            className="mt-3 px-3 py-2 text-sm font-medium text-amber-900 bg-amber-100 rounded-md hover:bg-amber-200"
          >
            Download as single .txt instead
          </button>
        </div>
      )}

      {/* Generated Results */}
      {isGenerated && generatedProject && (
        <MCPResults
          project={generatedProject}
          serverName={mcpConfig.serverName}
          onDownloadAll={downloadAllFiles}
        />
      )}
    </div>
  );
};