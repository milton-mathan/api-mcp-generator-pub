import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ToastMessage, ProgressState } from '../types';

interface UIState {
  // Toast notifications
  toasts: ToastMessage[];
  
  // Progress tracking
  progress: ProgressState | null;
  
  // Modal states
  modals: {
    authConfig: boolean;
    endpointDetails: boolean;
    exportOptions: boolean;
    errorDetails: boolean;
  };
  
  // Sidebar and layout
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
  
  // Actions
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  setProgress: (progress: ProgressState | null) => void;
  openModal: (modal: keyof UIState['modals']) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    immer((set, get) => ({
      // State
      toasts: [],
      progress: null,
      modals: {
        authConfig: false,
        endpointDetails: false,
        exportOptions: false,
        errorDetails: false,
      },
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'system',

      // Actions
      addToast: (toast) => {
        set((state) => {
          const id = Math.random().toString(36).substr(2, 9);
          const newToast: ToastMessage = {
            id,
            duration: 5000,
            ...toast,
          };
          state.toasts.push(newToast);
          
          // Auto-remove toast after duration
          if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
              get().removeToast(id);
            }, newToast.duration);
          }
        });
      },

      removeToast: (id) => {
        set((state) => {
          const index = state.toasts.findIndex((toast) => toast.id === id);
          if (index > -1) {
            state.toasts.splice(index, 1);
          }
        });
      },

      clearToasts: () => {
        set((state) => {
          state.toasts = [];
        });
      },

      setProgress: (progress) => {
        set((state) => {
          state.progress = progress;
        });
      },

      openModal: (modal) => {
        set((state) => {
          state.modals[modal] = true;
        });
      },

      closeModal: (modal) => {
        set((state) => {
          state.modals[modal] = false;
        });
      },

      toggleSidebar: () => {
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen;
        });
      },

      setSidebarCollapsed: (collapsed) => {
        set((state) => {
          state.sidebarCollapsed = collapsed;
        });
      },

      setTheme: (theme) => {
        set((state) => {
          state.theme = theme;
        });
      },
    })),
    {
      name: 'ui-store',
    }
  )
);

// Selector hooks
export const useToasts = () => useUIStore((state) => state.toasts);
export const useProgress = () => useUIStore((state) => state.progress);
export const useModals = () => useUIStore((state) => state.modals);
export const useSidebar = () => useUIStore((state) => ({
  open: state.sidebarOpen,
  collapsed: state.sidebarCollapsed,
}));
export const useTheme = () => useUIStore((state) => state.theme);

// Action hooks
export const useUIActions = () => useUIStore((state) => ({
  addToast: state.addToast,
  removeToast: state.removeToast,
  clearToasts: state.clearToasts,
  setProgress: state.setProgress,
  openModal: state.openModal,
  closeModal: state.closeModal,
  toggleSidebar: state.toggleSidebar,
  setSidebarCollapsed: state.setSidebarCollapsed,
  setTheme: state.setTheme,
}));