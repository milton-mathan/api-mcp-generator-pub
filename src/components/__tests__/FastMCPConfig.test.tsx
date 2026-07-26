import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FastMCPConfig } from '../FastMCPConfig';
import type { MCPConfig } from '../../types/mcp';

describe('FastMCPConfig', () => {
  const mockConfig: MCPConfig = {
    endpoints: ['test-endpoint'],
    serverName: 'test-server',
    baseUrl: 'https://api.example.com',
    authentication: undefined,
    toolNaming: 'operationId',
    includeExamples: true,
    errorHandling: 'detailed',
    customToolNames: {},
    useFastMCP: true,
    serverModes: ['stdio', 'http'],
    httpPort: 8000,
    logLevel: 'INFO',
    includeRunScripts: true,
    pythonVersion: '3.11'
  };

  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should render FastMCP configuration options', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('FastMCP Framework')).toBeInTheDocument();
    expect(screen.getByText('Use FastMCP for enhanced performance and developer experience')).toBeInTheDocument();
  });

  it('should show FastMCP benefits when enabled', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('FastMCP Benefits:')).toBeInTheDocument();
    expect(screen.getByText('Enhanced logging and error handling')).toBeInTheDocument();
    expect(screen.getByText('Concise decorator-based tool definitions')).toBeInTheDocument();
  });

  it('should hide FastMCP options when disabled', () => {
    const disabledConfig = { ...mockConfig, useFastMCP: false };
    render(<FastMCPConfig config={disabledConfig} onChange={mockOnChange} />);

    expect(screen.queryByText('Server Modes')).not.toBeInTheDocument();
    expect(screen.queryByText('HTTP Configuration')).not.toBeInTheDocument();
    expect(screen.queryByText('Development Options')).not.toBeInTheDocument();
  });

  it('should toggle FastMCP framework', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    const toggle = screen.getByRole('checkbox', { name: /fastmcp framework/i });
    fireEvent.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith({ useFastMCP: false });
  });

  it('should show server mode options when FastMCP is enabled', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('Server Modes')).toBeInTheDocument();
    expect(screen.getByText('Stdio Mode')).toBeInTheDocument();
    expect(screen.getByText('HTTP Mode')).toBeInTheDocument();
    expect(screen.getByText('For MCP clients like Claude Desktop, Cline, etc.')).toBeInTheDocument();
    // mockConfig has useFastMCP: true, so HTTP mode shows the FastMCP-specific notice
    expect(screen.getByText(/Generated servers do not\s+expose an HTTP interface/)).toBeInTheDocument();
    expect(screen.getByText('Not implemented')).toBeInTheDocument();
  });

  it('should handle server mode changes', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    const stdioCheckbox = screen.getByRole('checkbox', { name: /stdio mode/i });
    fireEvent.click(stdioCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith({ serverModes: ['http'] });
  });

  it('should prevent disabling all server modes', () => {
    const singleModeConfig = { ...mockConfig, serverModes: ['stdio'] as ('stdio' | 'http')[] };
    render(<FastMCPConfig config={singleModeConfig} onChange={mockOnChange} />);

    const stdioCheckbox = screen.getByRole('checkbox', { name: /stdio mode/i });
    fireEvent.click(stdioCheckbox);

    // Should not call onChange when trying to disable the last mode
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should show HTTP configuration when HTTP mode is enabled', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('HTTP Configuration')).toBeInTheDocument();
    expect(screen.getByText('HTTP Port')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8000')).toBeInTheDocument();
  });

  it('should hide HTTP configuration when HTTP mode is disabled', () => {
    const stdioOnlyConfig = { ...mockConfig, serverModes: ['stdio'] as ('stdio' | 'http')[] };
    render(<FastMCPConfig config={stdioOnlyConfig} onChange={mockOnChange} />);

    expect(screen.queryByText('HTTP Configuration')).not.toBeInTheDocument();
  });

  it('should handle HTTP port changes', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    const portInput = screen.getByDisplayValue('8000');
    fireEvent.change(portInput, { target: { value: '9000' } });

    expect(mockOnChange).toHaveBeenCalledWith({ httpPort: 9000 });
  });

  it('should show development options', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('Development Options')).toBeInTheDocument();
    expect(screen.getByText('Log Level')).toBeInTheDocument();
    expect(screen.getByText('Python Version')).toBeInTheDocument();
    expect(screen.getByText('Include Helper Scripts')).toBeInTheDocument();
  });

  it('should handle log level changes', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    const logLevelSelect = screen.getByDisplayValue('INFO');
    fireEvent.change(logLevelSelect, { target: { value: 'DEBUG' } });

    expect(mockOnChange).toHaveBeenCalledWith({ logLevel: 'DEBUG' });
  });

  it('should handle Python version changes', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    const pythonVersionSelect = screen.getByDisplayValue('Python 3.11');
    fireEvent.change(pythonVersionSelect, { target: { value: '3.12' } });

    expect(mockOnChange).toHaveBeenCalledWith({ pythonVersion: '3.12' });
  });

  it('should handle helper scripts toggle', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    const helperScriptsCheckbox = screen.getByRole('checkbox', { name: /include helper scripts/i });
    fireEvent.click(helperScriptsCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith({ includeRunScripts: false });
  });

  it('should have proper accessibility attributes', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    // Check that form controls have proper labels
    expect(screen.getByLabelText(/fastmcp framework/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/stdio mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/http mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/include helper scripts/i)).toBeInTheDocument();
  });

  it('should display helpful descriptions for each option', () => {
    render(<FastMCPConfig config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('Port for HTTP server (default: 8000)')).toBeInTheDocument();
    expect(screen.getByText('Logging verbosity level')).toBeInTheDocument();
    expect(screen.getByText('Target Python version for generated code')).toBeInTheDocument();
    expect(screen.getByText('Generate setup.py, run-stdio.py, and docker-compose.yml')).toBeInTheDocument();
  });
});