import React from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export type ValidationStatus = 'valid' | 'invalid' | 'warning' | 'info';

interface ValidationFeedbackProps {
  status: ValidationStatus;
  message: string;
  details?: string[];
  className?: string;
  inline?: boolean;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  status,
  message,
  details,
  className = '',
  inline = false,
}) => {
  const getIcon = () => {
    switch (status) {
      case 'valid':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <InformationCircleIcon className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStyles = () => {
    const baseStyles = inline 
      ? 'flex items-center space-x-2 text-sm'
      : 'p-3 rounded-lg border';

    switch (status) {
      case 'valid':
        return `${baseStyles} ${inline ? 'text-green-700' : 'bg-green-50 border-green-200 text-green-800'}`;
      case 'invalid':
        return `${baseStyles} ${inline ? 'text-red-700' : 'bg-red-50 border-red-200 text-red-800'}`;
      case 'warning':
        return `${baseStyles} ${inline ? 'text-yellow-700' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`;
      case 'info':
        return `${baseStyles} ${inline ? 'text-blue-700' : 'bg-blue-50 border-blue-200 text-blue-800'}`;
    }
  };

  if (inline) {
    return (
      <div className={`${getStyles()} ${className}`}>
        {getIcon()}
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className={`${getStyles()} ${className}`}>
      <div className="flex items-start space-x-2">
        {getIcon()}
        <div className="flex-1">
          <p className="font-medium">{message}</p>
          {details && details.length > 0 && (
            <ul className="mt-2 text-sm list-disc list-inside space-y-1">
              {details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

interface InlineValidationProps {
  field: string;
  value: unknown;
  validators: Array<{
    test: (value: unknown) => boolean;
    message: string;
    type?: 'error' | 'warning';
  }>;
  className?: string;
}

export const InlineValidation: React.FC<InlineValidationProps> = ({
  field: _field,
  value,
  validators,
  className = '',
}) => {
  const validationResults = validators.map(validator => ({
    ...validator,
    isValid: validator.test(value),
  }));

  const errors = validationResults.filter(r => !r.isValid && r.type !== 'warning');
  const warnings = validationResults.filter(r => !r.isValid && r.type === 'warning');

  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={`mt-1 space-y-1 ${className}`}>
      {errors.map((error, index) => (
        <ValidationFeedback
          key={`error-${index}`}
          status="invalid"
          message={error.message}
          inline
        />
      ))}
      {warnings.map((warning, index) => (
        <ValidationFeedback
          key={`warning-${index}`}
          status="warning"
          message={warning.message}
          inline
        />
      ))}
    </div>
  );
};

interface FormValidationSummaryProps {
  errors: Record<string, string[]>;
  warnings?: Record<string, string[]>;
  className?: string;
}

export const FormValidationSummary: React.FC<FormValidationSummaryProps> = ({
  errors,
  warnings = {},
  className = '',
}) => {
  const errorCount = Object.values(errors).flat().length;
  const warningCount = Object.values(warnings).flat().length;

  if (errorCount === 0 && warningCount === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {errorCount > 0 && (
        <ValidationFeedback
          status="invalid"
          message={`${errorCount} error${errorCount !== 1 ? 's' : ''} found`}
          details={Object.entries(errors).flatMap(([field, fieldErrors]) =>
            fieldErrors.map(error => `${field}: ${error}`)
          )}
        />
      )}
      
      {warningCount > 0 && (
        <ValidationFeedback
          status="warning"
          message={`${warningCount} warning${warningCount !== 1 ? 's' : ''} found`}
          details={Object.entries(warnings).flatMap(([field, fieldWarnings]) =>
            fieldWarnings.map(warning => `${field}: ${warning}`)
          )}
        />
      )}
    </div>
  );
};