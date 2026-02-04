import React, { useSyncExternalStore } from 'react';
import type {
  Cell,
  Post,
  Comment,
  Bookmark,
  Following,
  User,
  EVerificationStatus,
  DelegationFullStatus,
} from '@opchan/core';
import type { UserIdentity } from '@opchan/core/dist/lib/services/UserIdentityService';

type Listener = () => void;

export interface SessionSlice {
  currentUser: User | null;
  verificationStatus: EVerificationStatus;
  delegation: DelegationFullStatus | null;
}

export interface ContentSlice {
  cells: Cell[];
  posts: Post[];
  comments: Comment[];
  bookmarks: Bookmark[];
  following: Following[];
  lastSync: number | null;
  pendingIds: Set<string>;
  pendingVotes: Set<string>;
}

export interface IdentitySlice {
  // Enhanced identity cache with full UserIdentity data
  displayNameByAddress: Record<string, string>;
  identitiesByAddress: Record<string, UserIdentity>;
  lastUpdatedByAddress: Record<string, number>;
}

export interface UIStateSlice {
  // Centralized UI state to replace direct LocalDatabase access
  wizardStates: Record<string, boolean>;
  preferences: Record<string, unknown>;
  temporaryStates: Record<string, unknown>;
}

export interface NetworkSlice {
  isConnected: boolean;
  statusMessage: string;
  issues: string[];
  isHydrated: boolean;
  syncStatus: 'syncing' | 'synced' | 'unknown';
  syncDetail: { received: number; missing: number; lost: number } | null;
}

export interface OpchanState {
  session: SessionSlice;
  content: ContentSlice;
  identity: IdentitySlice;
  uiState: UIStateSlice;
  network: NetworkSlice;
}

const defaultState: OpchanState = {
  session: {
    currentUser: null,
    verificationStatus: 'wallet-unconnected' as EVerificationStatus,
    delegation: null,
  },
  content: {
    cells: [],
    posts: [],
    comments: [],
    bookmarks: [],
    following: [],
    lastSync: null,
    pendingIds: new Set<string>(),
    pendingVotes: new Set<string>(),
  },
  identity: {
    displayNameByAddress: {},
    identitiesByAddress: {},
    lastUpdatedByAddress: {},
  },
  uiState: {
    wizardStates: {},
    preferences: {},
    temporaryStates: {},
  },
  network: {
    isConnected: false,
    statusMessage: 'connecting…',
    issues: [],
    isHydrated: false,
    syncStatus: 'unknown',
    syncDetail: null,
  },
};

class OpchanStoreImpl {
  private state: OpchanState = defaultState;
  private listeners: Set<Listener> = new Set();
  private persistenceCallbacks: Set<(state: OpchanState) => Promise<void>> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): OpchanState {
    return this.state;
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  setState(mutator: (prev: OpchanState) => OpchanState): void {
    const next = mutator(this.state);
    if (next !== this.state) {
      this.state = next;
      this.notify();
      this.triggerPersistence(next);
    }
  }

  // Enhanced methods for identity and UI state management
  setIdentity(address: string, identity: UserIdentity): void {
    this.setState(prev => ({
      ...prev,
      identity: {
        ...prev.identity,
        displayNameByAddress: {
          ...prev.identity.displayNameByAddress,
          [address]: identity.displayName,
        },
        identitiesByAddress: {
          ...prev.identity.identitiesByAddress,
          [address]: identity,
        },
        lastUpdatedByAddress: {
          ...prev.identity.lastUpdatedByAddress,
          [address]: Date.now(),
        },
      },
    }));
  }

  setUIState<T>(key: string, value: T, category: 'wizardStates' | 'preferences' | 'temporaryStates' = 'preferences'): void {
    this.setState(prev => ({
      ...prev,
      uiState: {
        ...prev.uiState,
        [category]: {
          ...prev.uiState[category],
          [key]: value,
        },
      },
    }));
  }

  getUIState<T>(key: string, category: 'wizardStates' | 'preferences' | 'temporaryStates' = 'preferences'): T | undefined {
    return this.state.uiState[category][key] as T;
  }

  // Register persistence callbacks
  onPersistence(callback: (state: OpchanState) => Promise<void>): () => void {
    this.persistenceCallbacks.add(callback);
    return () => this.persistenceCallbacks.delete(callback);
  }

  private async triggerPersistence(state: OpchanState): Promise<void> {
    // Run persistence callbacks asynchronously to avoid blocking UI
    setTimeout(async () => {
      for (const callback of this.persistenceCallbacks) {
        try {
          await callback(state);
        } catch (error) {
          console.warn('Store persistence callback failed:', error);
        }
      }
    }, 0);
  }
}

export const opchanStore = new OpchanStoreImpl();

export function useOpchanStore<T>(selector: (s: OpchanState) => T, isEqual?: (a: T, b: T) => boolean): T {
  // Subscribe to the raw store snapshot to keep getSnapshot referentially stable
  const state = useSyncExternalStore(
    (cb) => opchanStore.subscribe(cb),
    () => opchanStore.getSnapshot(),
    () => opchanStore.getSnapshot(),
  );

  const compare = isEqual ?? ((a: T, b: T) => a === b);
  const selected = React.useMemo(() => selector(state), [state, selector]);

  // Cache the last selected value using the provided equality to avoid churn
  const cachedRef = React.useRef<T>(selected);
  if (!compare(cachedRef.current, selected)) {
    cachedRef.current = selected;
  }
  return cachedRef.current;
}

export function getOpchanState(): OpchanState {
  return opchanStore.getSnapshot();
}

export function setOpchanState(mutator: (prev: OpchanState) => OpchanState): void {
  opchanStore.setState(mutator);
}


