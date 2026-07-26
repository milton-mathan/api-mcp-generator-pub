import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import { ApiExplorer } from '../ApiExplorer';


describe('ApiExplorer', () => {
  const mockSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
      description: 'Test API description'
    },
    paths: {
      '/users': {
        get: {
          operationId: 'getUsers',
          summary: 'Get all users',
          description: 'Retrieve a list of users'
        }
      },
      '/users/{id}': {
        get: {
          operationId: 'getUserById',
          summary: 'Get user by ID',
          description: 'Retrieve a specific user'
        }
      }
    }
  };

  const mockMetadata = {
    source: 'file'
  };

  const defaultProps = {
    spec: mockSpec,
    metadata: mockMetadata,
    onBack: vi.fn(),
    onGenerateMCP: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render API explorer with endpoints', () => {
    render(<ApiExplorer {...defaultProps} />);

    expect(screen.getByText('API Explorer')).toBeInTheDocument();
    expect(screen.getByText('Test API - 2 endpoints')).toBeInTheDocument();
    expect(screen.getByText('Test API')).toBeInTheDocument();
    expect(screen.getByText('Test API description')).toBeInTheDocument();
  });

  it('should show endpoints from spec', () => {
    render(<ApiExplorer {...defaultProps} />);
    
    expect(screen.getAllByText('GET')).toHaveLength(2);
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('Get all users')).toBeInTheDocument();
    expect(screen.getByText('/users/{id}')).toBeInTheDocument();
    expect(screen.getByText('Get user by ID')).toBeInTheDocument();
  });

  it('should handle undefined spec gracefully', () => {
    const propsWithUndefinedSpec = {
      ...defaultProps,
      spec: undefined,
      metadata: undefined
    };
    
    render(<ApiExplorer {...propsWithUndefinedSpec} />);
    
    expect(screen.getByText('API Explorer')).toBeInTheDocument();
    expect(screen.getByText('API Specification - 0 endpoints')).toBeInTheDocument();
    expect(screen.getByText('No endpoints found in this specification.')).toBeInTheDocument();
  });

  it('should not show MCP generation button when no endpoints selected', () => {
    render(<ApiExplorer {...defaultProps} />);

    expect(screen.queryByText(/Generate MCP Server/)).not.toBeInTheDocument();
  });


  describe('select all', () => {
    // Selecting endpoints one at a time is unworkable on a real spec - the
    // Petstore alone has 20.
    const selectAll = () => screen.getByRole('checkbox', { name: /select all|deselect all/i });

    it('selects every endpoint in one click', () => {
      render(<ApiExplorer {...defaultProps} />);

      fireEvent.click(selectAll());

      expect(screen.getByText('Generate MCP Server (2)')).toBeInTheDocument();
      for (const box of screen.getAllByRole('checkbox')) {
        expect(box).toBeChecked();
      }
    });

    it('clears the selection when clicked again', () => {
      render(<ApiExplorer {...defaultProps} />);

      fireEvent.click(selectAll());
      fireEvent.click(selectAll());

      expect(screen.queryByText(/Generate MCP Server/)).not.toBeInTheDocument();
      for (const box of screen.getAllByRole('checkbox')) {
        expect(box).not.toBeChecked();
      }
    });

    it('shows how many of how many are selected', () => {
      render(<ApiExplorer {...defaultProps} />);

      expect(screen.getByText('(0/2)')).toBeInTheDocument();
      fireEvent.click(selectAll());
      expect(screen.getByText('(2/2)')).toBeInTheDocument();
    });

    it('goes indeterminate when only some are selected', () => {
      render(<ApiExplorer {...defaultProps} />);

      const boxes = screen.getAllByRole('checkbox');
      // The first checkbox is select-all; the next is the first endpoint.
      fireEvent.click(boxes[1]);

      const master = selectAll() as HTMLInputElement;
      expect(master.checked).toBe(false);
      expect(master.indeterminate).toBe(true);
      expect(screen.getByText('(1/2)')).toBeInTheDocument();
    });

    it('is not offered when the spec has no endpoints', () => {
      render(<ApiExplorer {...defaultProps} spec={undefined} metadata={undefined} />);

      expect(screen.queryByRole('checkbox', { name: /select all/i })).not.toBeInTheDocument();
    });
  });

});
