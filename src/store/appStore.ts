import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  AppState,
  AppPhase,
  AppError,
  ParsedSpec,
  Endpoint,
  InputMetadata,
  ExplorerState,
  MCPConfig,
  GeneratedProject,
} from '../types';

/**
 * Draft type for this store's immer `set` callbacks.
 *
 * The precise type is `WritableDraft<AppState>`, but TypeScript cannot
 * instantiate it here: `AppState` reaches `ParsedSpec` -> `Schema`, which is
 * self-referential (properties/items/allOf are all `Schema`), and mapping that
 * through immer's recursive `Draft<T>` exceeds the instantiation depth limit
 * (TS2589). The store's own `create<AppState>()` call remains fully typed, so
 * the state shape is still checked at the boundary; only the draft parameter
 * inside these callbacks is widened.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppDraft = any;

// Initial state values
const initialExplorerState: ExplorerState = {
  groupBy: 'tags',
  searchQuery: '',
  expandedGroups: new Set(),
  viewMode: 'table',
  selectedEndpoint: null,
  filters: {
    methods: new Set(),
    tags: new Set(),
    hasAuth: null,
    deprecated: null,
  },
};

const initialMCPConfig: MCPConfig = {
  endpoints: [],
  serverName: 'generated-mcp-server',
  baseUrl: '',
  authentication: undefined,
  toolNaming: 'operationId',
  includeExamples: true,
  errorHandling: 'detailed',
  customToolNames: {},
  // FastMCP-specific options
  useFastMCP: true, // Default to FastMCP for better experience
  // stdio only. Neither template implements HTTP, and the UI checkbox for it
  // is disabled - defaulting to ['stdio', 'http'] left a mode enabled that
  // nothing downstream could honour.
  serverModes: ['stdio'],
  httpPort: 8000,
  logLevel: 'INFO',
  includeRunScripts: true,
  pythonVersion: '3.11',
};

// Create the main app store
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      immer((set, _get) => ({
        // State
        inputSpec: null,
        inputMetadata: null,
        endpoints: [],
        selectedEndpoints: new Set(),
        explorerConfig: initialExplorerState,
        mcpConfig: initialMCPConfig,
        generatedProject: null,
        currentPhase: 'input' as AppPhase,
        loading: false,
        error: null,

        // Actions
        setInputSpec: (spec: ParsedSpec, metadata: InputMetadata) => {
          set((state: AppDraft) => {
            state.inputSpec = spec;
            state.inputMetadata = metadata;
            state.currentPhase = 'explorer';
            state.error = null;
            
            // Update MCP config with base URL from spec
            if (spec.servers && spec.servers.length > 0) {
              state.mcpConfig.baseUrl = spec.servers[0].url;
            }
            
            // Set server name from spec info
            if (spec.info?.title) {
              state.mcpConfig.serverName = spec.info.title
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            }
          });
        },

        setEndpoints: (endpoints: Endpoint[]) => {
          set((state: AppDraft) => {
            state.endpoints = endpoints;
            // Clear previous selections when new endpoints are loaded
            state.selectedEndpoints.clear();
          });
        },

        toggleEndpointSelection: (endpointId: string) => {
          set((state: AppDraft) => {
            if (state.selectedEndpoints.has(endpointId)) {
              state.selectedEndpoints.delete(endpointId);
            } else {
              state.selectedEndpoints.add(endpointId);
            }
            
            // Update MCP config endpoints
            state.mcpConfig.endpoints = Array.from(state.selectedEndpoints);
          });
        },

        setExplorerConfig: (config: Partial<ExplorerState>) => {
          set((state: AppDraft) => {
            Object.assign(state.explorerConfig, config);
          });
        },

        setMCPConfig: (config: Partial<MCPConfig>) => {
          set((state: AppDraft) => {
            Object.assign(state.mcpConfig, config);
          });
        },

        setGeneratedProject: (project: GeneratedProject) => {
          set((state: AppDraft) => {
            state.generatedProject = project;
            state.currentPhase = 'export';
          });
        },

        setPhase: (phase: AppPhase) => {
          set((state: AppDraft) => {
            state.currentPhase = phase;
          });
        },

        setLoading: (loading: boolean) => {
          set((state: AppDraft) => {
            state.loading = loading;
          });
        },

        setError: (error: AppError | null) => {
          set((state: AppDraft) => {
            state.error = error;
            if (error) {
              state.loading = false;
            }
          });
        },

        reset: () => {
          set((state: AppDraft) => {
            state.inputSpec = null;
            state.inputMetadata = null;
            state.endpoints = [];
            state.selectedEndpoints.clear();
            state.explorerConfig = { ...initialExplorerState };
            state.mcpConfig = { ...initialMCPConfig };
            state.generatedProject = null;
            state.currentPhase = 'input';
            state.loading = false;
            state.error = null;
          });
        },
      })),
      {
        name: 'api-spec-explorer-store',
        partialize: (state) => ({
          // Only persist user preferences, not the actual data
          explorerConfig: {
            groupBy: state.explorerConfig.groupBy,
            viewMode: state.explorerConfig.viewMode,
          },
          mcpConfig: {
            toolNaming: state.mcpConfig.toolNaming,
            includeExamples: state.mcpConfig.includeExamples,
            errorHandling: state.mcpConfig.errorHandling,
          },
        }),
      }
    ),
    {
      name: 'api-spec-explorer',
    }
  )
);

// Selector hooks for better performance
export const useInputSpec = () => useAppStore((state) => state.inputSpec);
export const useEndpoints = () => useAppStore((state) => state.endpoints);
export const useSelectedEndpoints = () => useAppStore((state) => state.selectedEndpoints);
export const useExplorerConfig = () => useAppStore((state) => state.explorerConfig);
export const useMCPConfig = () => useAppStore((state) => state.mcpConfig);
export const useGeneratedProject = () => useAppStore((state) => state.generatedProject);
export const useCurrentPhase = () => useAppStore((state) => state.currentPhase);
export const useLoading = () => useAppStore((state) => state.loading);
export const useError = () => useAppStore((state) => state.error);

// Action hooks
export const useAppActions = () => useAppStore((state) => ({
  setInputSpec: state.setInputSpec,
  setEndpoints: state.setEndpoints,
  toggleEndpointSelection: state.toggleEndpointSelection,
  setExplorerConfig: state.setExplorerConfig,
  setMCPConfig: state.setMCPConfig,
  setGeneratedProject: state.setGeneratedProject,
  setPhase: state.setPhase,
  setLoading: state.setLoading,
  setError: state.setError,
  reset: state.reset,
}));