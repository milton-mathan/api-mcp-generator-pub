import React, { useState, useRef, useEffect } from 'react';
import {
  DocumentTextIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { GeneratedFile } from '../services/mcpCodeGenerator';

interface MonacoCodePreviewProps {
  files: GeneratedFile[];
  className?: string;
}

// Monaco Editor types (simplified)
interface MonacoModel {
  dispose: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
}

interface MonacoUri {
  scheme: string;
  path: string;
  toString: () => string;
}

interface MonacoEditorOptions {
  value?: string;
  language?: string;
  theme?: string;
  readOnly?: boolean;
  minimap?: { enabled: boolean };
  scrollBeyondLastLine?: boolean;
  fontSize?: number;
  lineNumbers?: string;
  renderWhitespace?: string;
  automaticLayout?: boolean;
}

interface MonacoEditor {
  setValue: (value: string) => void;
  getValue: () => string;
  setModel: (model: MonacoModel | null) => void;
  getModel: () => MonacoModel | null;
  dispose: () => void;
  layout: () => void;
  focus: () => void;
  trigger: (source: string, handlerId: string, payload?: Record<string, unknown>) => void;
}

interface Monaco {
  editor: {
    create: (container: HTMLElement, options: MonacoEditorOptions) => MonacoEditor;
    createModel: (value: string, language: string, uri?: MonacoUri) => MonacoModel;
    setTheme: (theme: string) => void;
  };
  Uri: {
    parse: (uri: string) => MonacoUri;
  };
}

declare global {
  interface Window {
    monaco?: Monaco;
  }
}

export const MonacoCodePreview: React.FC<MonacoCodePreviewProps> = ({ files, className = '' }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMonacoLoaded, setIsMonacoLoaded] = useState(false);
  const [, setSearchVisible] = useState(false);
  
  const editorRef = useRef<MonacoEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const modelsRef = useRef<Map<string, MonacoModel>>(new Map());

  const activeFile = files[activeFileIndex];

  // Load Monaco Editor
  useEffect(() => {
    const loadMonaco = async () => {
      if (window.monaco) {
        setIsMonacoLoaded(true);
        return;
      }

      try {
        // Load Monaco from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';
        script.onload = () => {
          (window as unknown as { require: { config: (config: Record<string, unknown>) => void; (deps: string[], callback: () => void): void } }).require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
          });
          
          (window as unknown as { require: (deps: string[], callback: () => void) => void }).require(['vs/editor/editor.main'], () => {
            setIsMonacoLoaded(true);
          });
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load Monaco Editor:', error);
      }
    };

    loadMonaco();
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!isMonacoLoaded || !containerRef.current || !window.monaco) return;

    const monaco = window.monaco;
    
    // Create editor
    const editor = monaco.editor.create(containerRef.current, {
      value: '',
      language: 'python',
      theme: 'vs-dark',
      readOnly: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      automaticLayout: true,
    });

    editorRef.current = editor;

    // Create models for all files
    files.forEach((file) => {
      const language = getMonacoLanguage(file.path);
      const uri = monaco.Uri.parse(`file:///${file.path}`);
      const model = monaco.editor.createModel(file.content, language, uri);
      modelsRef.current.set(file.path, model);
    });

    // Set initial file
    if (files.length > 0) {
      const initialModel = modelsRef.current.get(files[0].path);
      if (initialModel) {
        editor.setModel(initialModel);
      }
    }

    return () => {
      // Cleanup
      modelsRef.current.forEach(model => model.dispose());
      modelsRef.current.clear();
      editor.dispose();
    };
  }, [isMonacoLoaded, files]);

  // Handle file switching
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;

    const model = modelsRef.current.get(activeFile.path);
    if (model) {
      editorRef.current.setModel(model);
    }
  }, [activeFileIndex, activeFile]);

  // Handle fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const getMonacoLanguage = (path: string): string => {
    if (path.endsWith('.py')) return 'python';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.toml')) return 'toml';
    if (path.endsWith('.txt')) return 'plaintext';
    if (path.includes('.env')) return 'shell';
    if (path === 'Dockerfile') return 'dockerfile';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
    return 'plaintext';
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith('.py')) return '🐍';
    if (path.endsWith('.md')) return '📝';
    if (path.endsWith('.txt')) return '📄';
    if (path.endsWith('.toml')) return '⚙️';
    if (path.includes('.env')) return '🔐';
    if (path === 'Dockerfile') return '🐳';
    return '📄';
  };

  const handleCopyCode = async () => {
    if (!editorRef.current) return;

    try {
      const content = editorRef.current.getValue();
      await navigator.clipboard.writeText(content);
      setCopiedFile(activeFile.path);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleSearch = () => {
    if (!editorRef.current) return;
    
    editorRef.current.trigger('', 'actions.find');
    setSearchVisible(true);
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Trigger layout update after fullscreen change
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    }, 100);
  };

  if (!files.length) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No code generated yet</p>
      </div>
    );
  }

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-white'
    : `bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`;

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">Generated Code</h3>
          <span className="text-sm text-gray-600">{files.length} files</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSearch}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
            title="Search in code"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleCopyCode}
            className="flex items-center px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            title="Copy current file"
          >
            {copiedFile === activeFile?.path ? (
              <>
                <CheckIcon className="h-4 w-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </button>
          
          <button
            onClick={handleFullscreen}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="h-4 w-4" />
            ) : (
              <ArrowsPointingOutIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {files.map((file, index) => (
            <button
              key={file.path}
              onClick={() => setActiveFileIndex(index)}
              className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                index === activeFileIndex
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{getFileIcon(file.path)}</span>
              {file.path}
            </button>
          ))}
        </div>
      </div>

      {/* File Description */}
      {activeFile && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-sm text-blue-700">{activeFile.description}</p>
        </div>
      )}

      {/* Editor Container */}
      <div 
        ref={containerRef}
        className={isFullscreen ? 'h-full' : 'h-96'}
        style={{ minHeight: isFullscreen ? '100vh' : '400px' }}
      >
        {!isMonacoLoaded && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading code editor...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};