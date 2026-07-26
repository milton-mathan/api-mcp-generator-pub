export interface AppError {
  id: string;
  type: 'network' | 'parsing' | 'validation' | 'generation' | 'export' | 'unknown';
  message: string;
  details?: unknown;
  timestamp: Date;
  context?: Record<string, unknown>;
  recoverable: boolean;
  retryable: boolean;
}

export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

export class ErrorService {
  private static errors: AppError[] = [];
  private static listeners: Array<(error: AppError) => void> = [];

  /**
   * Create and log an error
   */
  static createError(
    type: AppError['type'],
    message: string,
    details?: unknown,
    context?: Record<string, unknown>
  ): AppError {
    const error: AppError = {
      id: this.generateErrorId(),
      type,
      message,
      details,
      timestamp: new Date(),
      context,
      recoverable: this.isRecoverable(type),
      retryable: this.isRetryable(type),
    };

    this.logError(error);
    this.notifyListeners(error);

    return error;
  }

  /**
   * Handle network errors
   */
  static handleNetworkError(error: unknown, context?: Record<string, unknown>): AppError {
    let message = 'Network request failed';
    let details: unknown = error;

    const errorObj = error as Record<string, unknown>;
    if (errorObj.response) {
      // Server responded with error status
      const response = errorObj.response as Record<string, unknown>;
      message = `Server error: ${response.status}`;
      details = {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        url: (errorObj.config as Record<string, unknown>)?.url,
      };
    } else if (errorObj.request) {
      // Request was made but no response received
      message = 'No response from server';
      details = {
        url: (errorObj.config as Record<string, unknown>)?.url,
        timeout: (errorObj.config as Record<string, unknown>)?.timeout,
      };
    } else {
      // Something else happened
      message = (errorObj.message as string) || 'Network error occurred';
    }

    return this.createError('network', message, details, context);
  }

  /**
   * Handle parsing errors
   */
  static handleParsingError(error: unknown, context?: Record<string, unknown>): AppError {
    let message = 'Failed to parse API specification';
    let details: unknown = error;

    const errorObj = error as Record<string, unknown>;
    if (errorObj.message) {
      message = `Parsing error: ${errorObj.message}`;
    }

    if (errorObj.mark) {
      // YAML parsing error
      const mark = errorObj.mark as Record<string, unknown>;
      details = {
        line: mark.line,
        column: mark.column,
        snippet: mark.snippet,
        reason: errorObj.reason,
      };
      message += ` at line ${(mark.line as number) + 1}`;
    }

    return this.createError('parsing', message, details, context);
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(
    errors: string[],
    context?: Record<string, unknown>
  ): AppError {
    const message = `Validation failed: ${errors.length} error${errors.length !== 1 ? 's' : ''}`;

    return this.createError('validation', message, { errors }, context);
  }

  /**
   * Handle generation errors
   */
  static handleGenerationError(error: unknown, context?: Record<string, unknown>): AppError {
    let message = 'Code generation failed';

    const errorObj = error as Record<string, unknown>;
    if (errorObj.message) {
      message = `Generation error: ${errorObj.message}`;
    }

    return this.createError('generation', message, error, context);
  }

  /**
   * Handle export errors
   */
  static handleExportError(error: unknown, context?: Record<string, unknown>): AppError {
    let message = 'Export failed';

    const errorObj = error as Record<string, unknown>;
    if (errorObj.message) {
      message = `Export error: ${errorObj.message}`;
    }

    return this.createError('export', message, error, context);
  }

  /**
   * Get recovery actions for an error
   */
  static getRecoveryActions(error: AppError): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    switch (error.type) {
      case 'network':
        if (error.retryable) {
          actions.push({
            label: 'Retry Request',
            action: () => {
              // This would need to be implemented by the calling component
              console.log('Retry network request');
            },
            primary: true,
          });
        }
        actions.push({
          label: 'Check Connection',
          action: () => {
            window.open('https://www.google.com', '_blank');
          },
        });
        break;

      case 'parsing':
        actions.push({
          label: 'Try Different File',
          action: () => {
            // This would trigger file selection
            console.log('Select different file');
          },
          primary: true,
        });
        actions.push({
          label: 'Validate Specification',
          action: () => {
            window.open('https://editor.swagger.io/', '_blank');
          },
        });
        break;

      case 'validation':
        actions.push({
          label: 'Fix Issues',
          action: () => {
            // This would highlight validation issues
            console.log('Show validation details');
          },
          primary: true,
        });
        break;

      case 'generation':
        actions.push({
          label: 'Try Again',
          action: () => {
            // Retry generation
            console.log('Retry generation');
          },
          primary: true,
        });
        actions.push({
          label: 'Simplify Configuration',
          action: () => {
            // Reset to default settings
            console.log('Reset to defaults');
          },
        });
        break;

      case 'export':
        actions.push({
          label: 'Try Again',
          action: () => {
            // Retry export
            console.log('Retry export');
          },
          primary: true,
        });
        break;
    }

    return actions;
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: AppError): string {
    const details = (error.details ?? {}) as { status?: number };

    switch (error.type) {
      case 'network':
        if (details.status === 404) {
          return 'The API specification could not be found at the provided URL.';
        }
        if (details.status === 401 || details.status === 403) {
          return 'Authentication failed. Please check your credentials.';
        }
        if (details.status !== undefined && details.status >= 500) {
          return 'The server is experiencing issues. Please try again later.';
        }
        return 'Unable to connect to the server. Please check your internet connection.';

      case 'parsing':
        return 'The API specification format is invalid or corrupted. Please check the file and try again.';

      case 'validation':
        return 'The API specification contains validation errors that need to be fixed.';

      case 'generation':
        return 'Failed to generate the MCP server code. Please try with different settings.';

      case 'export':
        return 'Failed to create the download package. Please try again.';

      default:
        return error.message;
    }
  }

  /**
   * Subscribe to error events
   */
  static subscribe(listener: (error: AppError) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get error history
   */
  static getErrors(): AppError[] {
    return [...this.errors];
  }

  /**
   * Clear error history
   */
  static clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    recent: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const byType: Record<string, number> = {};
    let recent = 0;

    this.errors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      if (error.timestamp > oneHourAgo) {
        recent++;
      }
    });

    return {
      total: this.errors.length,
      byType,
      recent,
    };
  }

  private static generateErrorId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private static isRecoverable(type: AppError['type']): boolean {
    return ['network', 'parsing', 'validation', 'generation', 'export'].includes(type);
  }

  private static isRetryable(type: AppError['type']): boolean {
    return ['network', 'generation', 'export'].includes(type);
  }

  private static logError(error: AppError): void {
    this.errors.push(error);
    
    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('AppError:', error);
    }
  }

  private static notifyListeners(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }
}