import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthContext';
import { assertSupabaseConfigured, supabase } from '../lib/supabase';
import { defaultStoreType, StoreType } from '../types/store';

const SELECTED_STORE_KEY_PREFIX = 'selected-store-id';

export type Store = {
  id: string;
  name: string;
  city: string | null;
  type: StoreType;
};

type StoreContextValue = {
  stores: Store[];
  selectedStore: Store | null;
  loadingStores: boolean;
  refreshStores: () => Promise<void>;
  selectStore: (storeId: string) => Promise<void>;
};

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function getStorageKey(userId: string) {
  return `${SELECTED_STORE_KEY_PREFIX}:${userId}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);

  const applySelection = useCallback(async (nextStores: Store[], userId: string) => {
    const storageKey = getStorageKey(userId);
    const persistedStoreId = await AsyncStorage.getItem(storageKey);
    const persistedStoreExists = persistedStoreId ? nextStores.some((store) => store.id === persistedStoreId) : false;

    const nextSelectedStoreId = persistedStoreExists ? persistedStoreId : nextStores[0]?.id ?? null;
    setSelectedStoreId(nextSelectedStoreId);

    if (nextSelectedStoreId) {
      await AsyncStorage.setItem(storageKey, nextSelectedStoreId);
      return;
    }

    await AsyncStorage.removeItem(storageKey);
  }, []);

  const refreshStores = useCallback(async () => {
    if (!session?.user.id) {
      setStores([]);
      setSelectedStoreId(null);
      setLoadingStores(false);
      return;
    }

    setLoadingStores(true);

    try {
      assertSupabaseConfigured();
      const { data, error } = await supabase
        .from('studios')
        .select('id, name, city, type')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const nextStores = ((data ?? []) as Array<{ id: string; name: string; city: string | null; type: string | null }>).map((store) => ({
        ...store,
        type: store.type === 'engagement_rings' ? 'engagement_rings' : defaultStoreType
      }));
      setStores(nextStores);
      await applySelection(nextStores, session.user.id);
    } catch (error) {
      console.warn('Could not load stores', error);
      setStores([]);
      setSelectedStoreId(null);
    } finally {
      setLoadingStores(false);
    }
  }, [applySelection, session?.user.id]);

  const selectStore = useCallback(
    async (storeId: string) => {
      if (!session?.user.id) {
        return;
      }

      const exists = stores.some((store) => store.id === storeId);
      if (!exists) {
        return;
      }

      setSelectedStoreId(storeId);
      await AsyncStorage.setItem(getStorageKey(session.user.id), storeId);
    },
    [session?.user.id, stores]
  );

  useEffect(() => {
    if (!session?.user.id) {
      setStores([]);
      setSelectedStoreId(null);
      setLoadingStores(false);
      return;
    }

    void refreshStores();
  }, [refreshStores, session?.user.id]);

  const selectedStore = useMemo(() => stores.find((store) => store.id === selectedStoreId) ?? null, [selectedStoreId, stores]);

  const value = useMemo(
    () => ({
      stores,
      selectedStore,
      loadingStores,
      refreshStores,
      selectStore
    }),
    [loadingStores, refreshStores, selectStore, selectedStore, stores]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}
