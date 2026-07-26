// Store exports
export * from './appStore';
export * from './uiStore';
export * from './cacheStore';

// Re-export commonly used hooks
export {
  useAppStore,
  useInputSpec,
  useEndpoints,
  useSelectedEndpoints,
  useExplorerConfig,
  useMCPConfig,
  useGeneratedProject,
  useCurrentPhase,
  useLoading,
  useError,
  useAppActions,
} from './appStore';

export {
  useUIStore,
  useToasts,
  useProgress,
  useModals,
  useSidebar,
  useTheme,
  useUIActions,
} from './uiStore';

export {
  useCacheStore,
  useCacheStats,
  useCacheActions,
} from './cacheStore';

// Utility hooks for common patterns
import { useAppStore } from './appStore';
import { useUIActions, useUIStore } from './uiStore';
import { useCallback } from 'react';
import type { AppError } from '../types';

// Hook for handling errors with toast notifications
export const useErrorHandler = () => {
  const { setError } = useAppStore();
  const { addToast } = useUIActions();

  return useCallback((error: AppError) => {
    setError(error);
    addToast({
      type: 'error',
      title: 'Error',
      message: error.message,
      duration: error.recoverable ? 5000 : 0, // Persistent for non-recoverable errors
    });
  }, [setError, addToast]);
};

// Hook for handling success messages
export const useSuccessHandler = () => {
  const { addToast } = useUIActions();

  return useCallback((title: string, message?: string) => {
    addToast({
      type: 'success',
      title,
      message,
      duration: 3000,
    });
  }, [addToast]);
};

// Hook for handling loading states with progress
export const useLoadingHandler = () => {
  const { setLoading } = useAppStore();
  const { setProgress } = useUIActions();

  const startLoading = useCallback((message: string, total?: number) => {
    setLoading(true);
    if (total) {
      setProgress({
        current: 0,
        total,
        message,
        percentage: 0,
      });
    }
  }, [setLoading, setProgress]);

  const updateProgress = useCallback((current: number, message?: string) => {
    const { progress } = useUIStore.getState();
    if (progress) {
      setProgress({
        ...progress,
        current,
        message: message || progress.message,
        percentage: Math.round((current / progress.total) * 100),
      });
    }
  }, [setProgress]);

  const stopLoading = useCallback(() => {
    setLoading(false);
    setProgress(null);
  }, [setLoading, setProgress]);

  return {
    startLoading,
    updateProgress,
    stopLoading,
  };
};

// Hook for phase transitions with validation
export const usePhaseTransition = () => {
  const { currentPhase, inputSpec, endpoints, selectedEndpoints, setPhase, setError } = useAppStore();

  const canTransitionTo = useCallback((targetPhase: typeof currentPhase) => {
    switch (targetPhase) {
      case 'input':
        return true; // Can always go back to input
      case 'explorer':
        return inputSpec !== null;
      case 'generator':
        return inputSpec !== null && endpoints.length > 0;
      case 'export':
        return inputSpec !== null && endpoints.length > 0 && selectedEndpoints.size > 0;
      default:
        return false;
    }
  }, [currentPhase, inputSpec, endpoints, selectedEndpoints]);

  const transitionTo = useCallback((targetPhase: typeof currentPhase) => {
    if (canTransitionTo(targetPhase)) {
      setPhase(targetPhase);
      setError(null); // Clear any existing errors on successful transition
    } else {
      setError({
        type: 'validation',
        message: `Cannot transition to ${targetPhase} phase. Missing required data.`,
        timestamp: Date.now(),
        recoverable: true,
      });
    }
  }, [canTransitionTo, setPhase, setError]);

  return {
    currentPhase,
    canTransitionTo,
    transitionTo,
  };
};

// Hook for managing endpoint selection with validation
export const useEndpointSelection = () => {
  const { endpoints, selectedEndpoints, toggleEndpointSelection } = useAppStore();
  const { addToast } = useUIActions();

  const selectEndpoint = useCallback((endpointId: string) => {
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (!endpoint) {
      addToast({
        type: 'error',
        title: 'Endpoint not found',
        message: `Endpoint with ID ${endpointId} does not exist.`,
      });
      return;
    }

    toggleEndpointSelection(endpointId);
  }, [endpoints, toggleEndpointSelection, addToast]);

  const selectAll = useCallback(() => {
    endpoints.forEach(endpoint => {
      if (!selectedEndpoints.has(endpoint.id)) {
        toggleEndpointSelection(endpoint.id);
      }
    });
  }, [endpoints, selectedEndpoints, toggleEndpointSelection]);

  const selectNone = useCallback(() => {
    Array.from(selectedEndpoints).forEach(endpointId => {
      toggleEndpointSelection(endpointId);
    });
  }, [selectedEndpoints, toggleEndpointSelection]);

  const getSelectedEndpoints = useCallback(() => {
    return endpoints.filter(endpoint => selectedEndpoints.has(endpoint.id));
  }, [endpoints, selectedEndpoints]);

  return {
    selectedEndpoints,
    selectEndpoint,
    selectAll,
    selectNone,
    getSelectedEndpoints,
    selectedCount: selectedEndpoints.size,
    totalCount: endpoints.length,
  };
};

// Hook for managing session recovery
export const useSessionRecovery = () => {
  const { inputSpec, currentPhase, reset } = useAppStore();
  const { addToast } = useUIActions();

  const hasSession = inputSpec !== null;

  const recoverSession = useCallback(() => {
    if (hasSession) {
      addToast({
        type: 'info',
        title: 'Session Recovered',
        message: 'Your previous session has been restored.',
      });
    }
  }, [hasSession, addToast]);

  const clearSession = useCallback(() => {
    reset();
    addToast({
      type: 'info',
      title: 'Session Cleared',
      message: 'All data has been cleared. Starting fresh.',
    });
  }, [reset, addToast]);

  return {
    hasSession,
    currentPhase,
    recoverSession,
    clearSession,
  };
};