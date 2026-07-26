import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { CacheEntry, ParsedSpec, Endpoint } from '../types';

/**
 * Draft type for this store's immer `set` callbacks.
 *
 * The precise type is `WritableDraft<CacheState>`, but TypeScript cannot
 * instantiate it here: `CacheState` reaches `ParsedSpec` -> `Schema`, which is
 * self-referential, and mapping that through immer's recursive `Draft<T>`
 * exceeds the instantiation depth limit (TS2589). The `create<CacheState>()`
 * call remains fully typed, so the state shape is still checked at the
 * boundary; only the draft parameter inside these callbacks is widened.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheDraft = any;

interface CacheState {
  // Parsed specs cache
  specs: Map<string, CacheEntry<ParsedSpec>>;
  
  // Endpoints cache
  endpoints: Map<string, CacheEntry<Endpoint[]>>;
  
  // Remote fetch cache
  remoteFetches: Map<string, CacheEntry<string>>;
  
  // Generated code cache
  generatedCode: Map<string, CacheEntry<string>>;
  
  // Cache settings
  defaultTTL: number;
  maxSize: number;
  
  // Actions
  setSpec: (key: string, spec: ParsedSpec, ttl?: number) => void;
  getSpec: (key: string) => ParsedSpec | null;
  setEndpoints: (key: string, endpoints: Endpoint[], ttl?: number) => void;
  getEndpoints: (key: string) => Endpoint[] | null;
  setRemoteFetch: (url: string, content: string, ttl?: number) => void;
  getRemoteFetch: (url: string) => string | null;
  setGeneratedCode: (key: string, code: string, ttl?: number) => void;
  getGeneratedCode: (key: string) => string | null;
  clearExpired: () => void;
  clearAll: () => void;
  getStats: () => CacheStats;
}

interface CacheStats {
  specs: { count: number; size: number };
  endpoints: { count: number; size: number };
  remoteFetches: { count: number; size: number };
  generatedCode: { count: number; size: number };
  total: { count: number; size: number };
}

export const useCacheStore = create<CacheState>()(
  devtools(
    immer((set, get) => ({
      // State
      specs: new Map(),
      endpoints: new Map(),
      remoteFetches: new Map(),
      generatedCode: new Map(),
      defaultTTL: 1000 * 60 * 30, // 30 minutes
      maxSize: 100, // Maximum entries per cache

      // Actions
      setSpec: (key, spec, ttl) => {
        set((state: CacheDraft) => {
          const entry: CacheEntry<ParsedSpec> = {
            key,
            value: spec,
            timestamp: Date.now(),
            ttl: ttl || state.defaultTTL,
          };
          
          // Remove oldest entries if cache is full
          if (state.specs.size >= state.maxSize) {
            const oldestKey = Array.from(state.specs.keys())[0];
            state.specs.delete(oldestKey);
          }
          
          state.specs.set(key, entry);
        });
      },

      getSpec: (key) => {
        const state = get();
        const entry = state.specs.get(key);
        
        if (!entry) return null;
        
        // Check if entry is expired
        if (Date.now() - entry.timestamp > entry.ttl) {
          state.specs.delete(key);
          return null;
        }
        
        return entry.value;
      },

      setEndpoints: (key, endpoints, ttl) => {
        set((state: CacheDraft) => {
          const entry: CacheEntry<Endpoint[]> = {
            key,
            value: endpoints,
            timestamp: Date.now(),
            ttl: ttl || state.defaultTTL,
          };
          
          if (state.endpoints.size >= state.maxSize) {
            const oldestKey = Array.from(state.endpoints.keys())[0];
            state.endpoints.delete(oldestKey);
          }
          
          state.endpoints.set(key, entry);
        });
      },

      getEndpoints: (key) => {
        const state = get();
        const entry = state.endpoints.get(key);
        
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > entry.ttl) {
          state.endpoints.delete(key);
          return null;
        }
        
        return entry.value;
      },

      setRemoteFetch: (url, content, ttl) => {
        set((state: CacheDraft) => {
          const entry: CacheEntry<string> = {
            key: url,
            value: content,
            timestamp: Date.now(),
            ttl: ttl || state.defaultTTL,
          };
          
          if (state.remoteFetches.size >= state.maxSize) {
            const oldestKey = Array.from(state.remoteFetches.keys())[0];
            state.remoteFetches.delete(oldestKey);
          }
          
          state.remoteFetches.set(url, entry);
        });
      },

      getRemoteFetch: (url) => {
        const state = get();
        const entry = state.remoteFetches.get(url);
        
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > entry.ttl) {
          state.remoteFetches.delete(url);
          return null;
        }
        
        return entry.value;
      },

      setGeneratedCode: (key, code, ttl) => {
        set((state: CacheDraft) => {
          const entry: CacheEntry<string> = {
            key,
            value: code,
            timestamp: Date.now(),
            ttl: ttl || state.defaultTTL,
          };
          
          if (state.generatedCode.size >= state.maxSize) {
            const oldestKey = Array.from(state.generatedCode.keys())[0];
            state.generatedCode.delete(oldestKey);
          }
          
          state.generatedCode.set(key, entry);
        });
      },

      getGeneratedCode: (key) => {
        const state = get();
        const entry = state.generatedCode.get(key);
        
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > entry.ttl) {
          state.generatedCode.delete(key);
          return null;
        }
        
        return entry.value;
      },

      clearExpired: () => {
        set((state: CacheDraft) => {
          const now = Date.now();
          
          // Clear expired specs
          for (const [key, entry] of state.specs.entries()) {
            if (now - entry.timestamp > entry.ttl) {
              state.specs.delete(key);
            }
          }
          
          // Clear expired endpoints
          for (const [key, entry] of state.endpoints.entries()) {
            if (now - entry.timestamp > entry.ttl) {
              state.endpoints.delete(key);
            }
          }
          
          // Clear expired remote fetches
          for (const [key, entry] of state.remoteFetches.entries()) {
            if (now - entry.timestamp > entry.ttl) {
              state.remoteFetches.delete(key);
            }
          }
          
          // Clear expired generated code
          for (const [key, entry] of state.generatedCode.entries()) {
            if (now - entry.timestamp > entry.ttl) {
              state.generatedCode.delete(key);
            }
          }
        });
      },

      clearAll: () => {
        set((state: CacheDraft) => {
          state.specs.clear();
          state.endpoints.clear();
          state.remoteFetches.clear();
          state.generatedCode.clear();
        });
      },

      getStats: () => {
        const state = get();
        
        const calculateSize = (map: Map<string, CacheEntry<unknown>>) => {
          let size = 0;
          for (const entry of map.values()) {
            size += JSON.stringify(entry.value).length;
          }
          return size;
        };
        
        const specs = {
          count: state.specs.size,
          size: calculateSize(state.specs),
        };
        
        const endpoints = {
          count: state.endpoints.size,
          size: calculateSize(state.endpoints),
        };
        
        const remoteFetches = {
          count: state.remoteFetches.size,
          size: calculateSize(state.remoteFetches),
        };
        
        const generatedCode = {
          count: state.generatedCode.size,
          size: calculateSize(state.generatedCode),
        };
        
        return {
          specs,
          endpoints,
          remoteFetches,
          generatedCode,
          total: {
            count: specs.count + endpoints.count + remoteFetches.count + generatedCode.count,
            size: specs.size + endpoints.size + remoteFetches.size + generatedCode.size,
          },
        };
      },
    })),
    {
      name: 'cache-store',
    }
  )
);

// Selector hooks
export const useCacheStats = () => useCacheStore((state) => state.getStats());

// Action hooks
export const useCacheActions = () => useCacheStore((state) => ({
  setSpec: state.setSpec,
  getSpec: state.getSpec,
  setEndpoints: state.setEndpoints,
  getEndpoints: state.getEndpoints,
  setRemoteFetch: state.setRemoteFetch,
  getRemoteFetch: state.getRemoteFetch,
  setGeneratedCode: state.setGeneratedCode,
  getGeneratedCode: state.getGeneratedCode,
  clearExpired: state.clearExpired,
  clearAll: state.clearAll,
}));

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  useCacheStore.getState().clearExpired();
}, 5 * 60 * 1000);