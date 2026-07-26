import React, { useState } from 'react';
import {
  DocumentTextIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import type { GeneratedFile } from '../services/mcpCodeGenerator';

interface CodePreviewProps {
  files: GeneratedFile[];
  className?: string;
}

interface FileTabProps {
  file: GeneratedFile;
  isActive: boolean;
  onClick: () => void;
}

const FileTab: React.FC<FileTabProps> = ({ file, isActive, onClick }) => {
  const getFileIcon = (path: string) => {
    if (path.endsWith('.py')) return '🐍';
    if (path.endsWith('.md')) return '📝';
    if (path.endsWith('.txt')) return '📄';
    if (path.endsWith('.toml')) return '⚙️';
    if (path.endsWith('.env')) return '🔐';
    if (path === 'Dockerfile') return '🐳';
    return '📄';
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-blue-500 text-blue-600 bg-blue-50'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      <span className="mr-2">{getFileIcon(file.path)}</span>
      {file.path}
    </button>
  );
};

export const CodePreview: React.FC<CodePreviewProps> = ({ files, className = '' }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));

  const activeFile = files[activeFileIndex];

  const handleCopyCode = async (content: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(fileName);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const getLanguageFromPath = (path: string): string => {
    if (path.endsWith('.py')) return 'python';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.toml')) return 'toml';
    if (path.endsWith('.txt')) return 'text';
    if (path.includes('.env')) return 'bash';
    if (path === 'Dockerfile') return 'dockerfile';
    return 'text';
  };

  const renderCodeBlock = (content: string, language: string) => {
    // Simple syntax highlighting for key languages
    const highlightCode = (code: string, lang: string) => {
      if (lang === 'python') {
        return code
          .replace(/(def|class|import|from|if|else|elif|for|while|try|except|finally|with|as|return|yield|async|await)\b/g, '<span class="text-blue-600 font-semibold">$1</span>')
          .replace(/(True|False|None)\b/g, '<span class="text-purple-600">$1</span>')
          .replace(/(".*?"|'.*?')/g, '<span class="text-green-600">$1</span>')
          .replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
          .replace(/(\d+)/g, '<span class="text-orange-600">$1</span>');
      }
      
      if (lang === 'markdown') {
        return code
          .replace(/^(#{1,6})\s(.*)$/gm, '<span class="text-blue-600 font-bold">$1</span> <span class="text-gray-900 font-semibold">$2</span>')
          .replace(/\*\*(.*?)\*\*/g, '<span class="font-bold">$1</span>')
          .replace(/\*(.*?)\*/g, '<span class="italic">$1</span>')
          .replace(/`(.*?)`/g, '<span class="bg-gray-100 px-1 rounded font-mono text-sm">$1</span>');
      }

      if (lang === 'bash') {
        return code
          .replace(/^([A-Z_][A-Z0-9_]*)=/gm, '<span class="text-blue-600 font-semibold">$1</span>=')
          .replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>');
      }

      return code;
    };

    const highlightedCode = highlightCode(content, language);

    return (
      <div className="relative">
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => handleCopyCode(content, activeFile.path)}
            className="flex items-center px-2 py-1 text-xs bg-gray-800 text-gray-200 rounded hover:bg-gray-700 transition-colors"
            title="Copy code"
          >
            {copiedFile === activeFile.path ? (
              <>
                <CheckIcon className="h-3 w-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-3 w-3 mr-1" />
                Copy
              </>
            )}
          </button>
        </div>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
          <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        </pre>
      </div>
    );
  };

  if (!files.length) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <CodeBracketIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No code generated yet</p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Generated Code</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <EyeIcon className="h-4 w-4" />
            <span>{files.length} files</span>
          </div>
        </div>
      </div>

      {/* File Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {files.map((file, index) => (
            <FileTab
              key={file.path}
              file={file}
              isActive={index === activeFileIndex}
              onClick={() => setActiveFileIndex(index)}
            />
          ))}
        </div>
      </div>

      {/* File Content */}
      <div className="max-h-96 overflow-y-auto">
        {activeFile && (
          <div className="p-4">
            {/* File Info */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <DocumentTextIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">{activeFile.path}</h4>
                  <p className="text-sm text-blue-700 mt-1">{activeFile.description}</p>
                </div>
              </div>
            </div>

            {/* Code Content */}
            {renderCodeBlock(activeFile.content, getLanguageFromPath(activeFile.path))}
          </div>
        )}
      </div>

      {/* File Structure Overview */}
      <div className="border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => toggleSection('structure')}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          <span>Project Structure</span>
          {expandedSections.has('structure') ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </button>
        
        {expandedSections.has('structure') && (
          <div className="px-4 pb-4">
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="font-mono text-sm text-gray-700">
                {files.map((file, index) => (
                  <div key={file.path} className="flex items-center py-1">
                    <span className="text-gray-400 mr-2">
                      {index === files.length - 1 ? '└──' : '├──'}
                    </span>
                    <span className={index === activeFileIndex ? 'text-blue-600 font-medium' : ''}>
                      {file.path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};