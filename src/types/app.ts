import { ParsedSpec, Endpoint, JsonValue } from './openapi';
import { MCPConfig, GeneratedProject } from './mcp';

// Application State Types
export type AppPhase = 'input' | 'explorer' | 'generator' | 'export';

export interface AppState {
  // Input phase
  inputSpec: ParsedSpec | null;
  inputMetadata: InputMetadata | null;
  
  // Explorer phase
  endpoints: Endpoint[];
  selectedEndpoints: Set<string>;
  explorerConfig: ExplorerState;
  
  // Generator phase
  mcpConfig: MCPConfig;
  generatedProject: GeneratedProject | null;
  
  // UI state
  currentPhase: AppPhase;
  loading: boolean;
  error: AppError | null;
  
  // Actions
  setInputSpec: (spec: ParsedSpec, metadata: InputMetadata) => void;
  setEndpoints: (endpoints: Endpoint[]) => void;
  toggleEndpointSelection: (endpointId: string) => void;
  setExplorerConfig: (config: Partial<ExplorerState>) => void;
  setMCPConfig: (config: Partial<MCPConfig>) => void;
  setGeneratedProject: (project: GeneratedProject) => void;
  setPhase: (phase: AppPhase) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: AppError | null) => void;
  reset: () => void;
}

export interface InputMetadata {
  source: 'file' | 'url' | 'paste';
  filename?: string;
  url?: string;
  authHeaders?: Record<string, string>;
  timestamp: number;
  size?: number;
}

export interface ExplorerState {
  groupBy: 'tags' | 'paths' | 'methods';
  searchQuery: string;
  expandedGroups: Set<string>;
  viewMode: 'tree' | 'table' | 'cards';
  selectedEndpoint: string | null;
  filters: ExplorerFilters;
}

export interface ExplorerFilters {
  methods: Set<string>;
  tags: Set<string>;
  hasAuth: boolean | null;
  deprecated: boolean | null;
}

// Error Types
export type ErrorType = 'input' | 'parsing' | 'validation' | 'network' | 'generation' | 'export';

export interface AppError {
  type: ErrorType;
  message: string;
  details?: JsonValue;
  timestamp: number;
  recoverable: boolean;
}

export interface InputError extends AppError {
  type: 'input';
  source?: 'file' | 'url';
}

export interface ParsingError extends AppError {
  type: 'parsing';
  line?: number;
  column?: number;
  path?: string;
}

export interface ValidationError extends AppError {
  type: 'validation';
  field?: string;
  value?: JsonValue;
  constraint?: string;
}

export interface NetworkError extends AppError {
  type: 'network';
  status?: number;
  url?: string;
}

export interface GenerationError extends AppError {
  type: 'generation';
  step?: string;
  template?: string;
}

export interface ExportError extends AppError {
  type: 'export';
  format?: string;
  size?: number;
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface InputHandlerProps extends BaseComponentProps {
  onSpecLoaded: (spec: ParsedSpec, metadata: InputMetadata) => void;
  onError: (error: InputError) => void;
  loading?: boolean;
}

export interface ExplorerProps extends BaseComponentProps {
  endpoints: Endpoint[];
  selectedEndpoints: Set<string>;
  config: ExplorerState;
  onEndpointSelect: (endpointId: string) => void;
  onEndpointToggle: (endpointId: string) => void;
  onConfigChange: (config: Partial<ExplorerState>) => void;
  onMCPGenerate: () => void;
}

export interface GeneratorProps extends BaseComponentProps {
  endpoints: Endpoint[];
  selectedEndpoints: Set<string>;
  config: MCPConfig;
  onConfigChange: (config: Partial<MCPConfig>) => void;
  onGenerate: () => void;
  onBack: () => void;
}

export interface ExportProps extends BaseComponentProps {
  project: GeneratedProject;
  onExport: (format: ExportFormat) => void;
  onBack: () => void;
  onStartOver: () => void;
}

export type ExportFormat = 'zip' | 'tar' | 'individual';

// Utility Types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ProgressState {
  current: number;
  total: number;
  message: string;
  percentage: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary';
}

// Search and Filter Types
export interface SearchResult {
  endpoint: Endpoint;
  matches: SearchMatch[];
  score: number;
}

export interface SearchMatch {
  field: string;
  value: string;
  indices: [number, number][];
}

export interface FilterOptions {
  methods: { value: string; label: string; count: number }[];
  tags: { value: string; label: string; count: number }[];
  hasAuth: { value: boolean; label: string; count: number }[];
  deprecated: { value: boolean; label: string; count: number }[];
}