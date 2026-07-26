import React, { useState, useCallback, useRef } from 'react';
import { CloudArrowUpIcon, DocumentIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { FileUpload as FileUploadType } from '../types';

interface FileUploadProps {
  onFileUpload: (fileUpload: FileUploadType) => void;
  loading?: boolean;
  className?: string;
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  loading = false,
  className = '',
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = ['.json', '.yaml', '.yml'],
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`;
    }

    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(extension)) {
      return `File type "${extension}" is not supported. Accepted types: ${acceptedTypes.join(', ')}`;
    }

    return null;
  }, [maxSize, acceptedTypes]);

  const detectFileType = useCallback((filename: string, content: string): 'json' | 'yaml' => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (extension === 'json') return 'json';
    if (extension === 'yaml' || extension === 'yml') return 'yaml';
    
    // Try to detect by content
    try {
      JSON.parse(content);
      return 'json';
    } catch {
      return 'yaml';
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setValidationError(validationError);
      return;
    }

    setValidationError(null);
    setSelectedFile(file);

    try {
      const content = await file.text();
      const type = detectFileType(file.name, content);

      const fileUpload: FileUploadType = {
        file,
        content,
        type,
        size: file.size,
        lastModified: file.lastModified,
      };

      onFileUpload(fileUpload);
    } catch (error) {
      setValidationError('Failed to read file content');
    }
  }, [validateFile, detectFileType, onFileUpload]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (loading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [loading, processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (loading) return;

    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [loading, processFile]);

  const handleClick = useCallback(() => {
    if (loading) return;
    fileInputRef.current?.click();
  }, [loading]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className={className}>
      {/* File drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : validationError
            ? 'border-red-300 bg-red-50'
            : selectedFile
            ? 'border-green-300 bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          disabled={loading}
        />

        <div className="text-center">
          {loading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600">Processing file...</p>
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col items-center">
              <DocumentIcon className="h-12 w-12 text-green-600 mb-4" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Choose different file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                {dragActive ? 'Drop your file here' : 'Upload API specification'}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Drag and drop or click to browse
              </p>
              <p className="text-xs text-gray-400">
                {acceptedTypes.join(', ')} up to {(maxSize / 1024 / 1024).toFixed(0)}MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="mt-3 flex items-start space-x-2 text-sm text-red-600">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{validationError}</p>
        </div>
      )}

      {/* File info */}
      {selectedFile && !validationError && (
        <div className="mt-3 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>File type: {detectFileType(selectedFile.name, '')}</span>
            <span>Last modified: {new Date(selectedFile.lastModified).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};