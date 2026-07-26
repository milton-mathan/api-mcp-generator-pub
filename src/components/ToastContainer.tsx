import React from 'react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  XCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { useToasts, useUIActions } from '../store';
import type { ToastMessage } from '../types';

const ToastIcon: React.FC<{ type: ToastMessage['type'] }> = ({ type }) => {
  const iconClass = "h-5 w-5";
  
  switch (type) {
    case 'success':
      return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
    case 'error':
      return <XCircleIcon className={`${iconClass} text-red-500`} />;
    case 'warning':
      return <ExclamationTriangleIcon className={`${iconClass} text-yellow-500`} />;
    case 'info':
      return <InformationCircleIcon className={`${iconClass} text-blue-500`} />;
    default:
      return <InformationCircleIcon className={`${iconClass} text-gray-500`} />;
  }
};

const Toast: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const { removeToast } = useUIActions();

  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  }[toast.type];

  const textColor = {
    success: 'text-green-800',
    error: 'text-red-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800',
  }[toast.type];

  return (
    <div className={`max-w-sm w-full ${bgColor} border rounded-lg shadow-lg pointer-events-auto`}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <ToastIcon type={toast.type} />
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className={`text-sm font-medium ${textColor}`}>
              {toast.title}
            </p>
            {toast.message && (
              <p className={`mt-1 text-sm ${textColor} opacity-90`}>
                {toast.message}
              </p>
            )}
            {toast.actions && toast.actions.length > 0 && (
              <div className="mt-3 flex space-x-2">
                {toast.actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      action.action();
                      removeToast(toast.id);
                    }}
                    className={`text-sm font-medium ${
                      action.style === 'primary' 
                        ? `${textColor} hover:opacity-75` 
                        : `${textColor} opacity-75 hover:opacity-100`
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => removeToast(toast.id)}
              className={`rounded-md inline-flex ${textColor} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600`}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
};