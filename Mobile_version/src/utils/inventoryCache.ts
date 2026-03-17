import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

import { assertSupabaseConfigured, supabase } from '../lib/supabase';

export type InventoryDressImage = {
  id: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
};

export type InventoryDress = {
  id: string;
  name: string | null;
  price: number | null;
  created_at: string;
  dress_images: InventoryDressImage[];
};

type CachedInventorySnapshot = {
  dresses: InventoryDress[];
  revision: string;
  lastSyncedAt: string;
};

type SyncInventoryOptions = {
  storeId: string;
  maxCacheAgeMs?: number;
};

function getInventoryCacheKey(storeId: string) {
  return `inventory-cache:${storeId}`;
}

function normalizeDresses(dresses: InventoryDress[]) {
  return dresses.map((dress) => ({
    ...dress,
    dress_images: [...(dress.dress_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  }));
}

function buildRevisionToken(dresses: InventoryDress[]) {
  const dressToken = dresses
    .map((dress) => `${dress.id}:${dress.created_at}`)
    .sort()
    .join('|');

  const imageToken = dresses
    .flatMap((dress) => (dress.dress_images ?? []).map((image) => `${dress.id}:${image.id}:${image.created_at ?? ''}:${image.sort_order}`))
    .sort()
    .join('|');

  return `${dressToken}::${imageToken}`;
}

async function readCachedInventory(storeId: string) {
  const raw = await AsyncStorage.getItem(getInventoryCacheKey(storeId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedInventorySnapshot;
    if (!Array.isArray(parsed?.dresses) || typeof parsed?.revision !== 'string' || typeof parsed?.lastSyncedAt !== 'string') {
      return null;
    }

    return {
      ...parsed,
      dresses: normalizeDresses(parsed.dresses)
    };
  } catch {
    return null;
  }
}

async function writeCachedInventory(storeId: string, dresses: InventoryDress[]) {
  const normalized = normalizeDresses(dresses);
  const payload: CachedInventorySnapshot = {
    dresses: normalized,
    revision: buildRevisionToken(normalized),
    lastSyncedAt: new Date().toISOString()
  };

  await AsyncStorage.setItem(getInventoryCacheKey(storeId), JSON.stringify(payload));
}

async function fetchFullInventory(storeId: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('dresses')
    .select('id, name, price, created_at, dress_images(id, image_url, sort_order, created_at)')
    .eq('studio_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return normalizeDresses((data ?? []) as InventoryDress[]);
}

async function fetchInventoryRevision(storeId: string) {
  assertSupabaseConfigured();

  const { data: dresses, error: dressesError } = await supabase
    .from('dresses')
    .select('id, created_at')
    .eq('studio_id', storeId)
    .order('created_at', { ascending: false });

  if (dressesError) {
    throw dressesError;
  }

  const { data: dressImages, error: imagesError } = await supabase
    .from('dress_images')
    .select('id, sort_order, created_at, dress_id, dresses!inner(studio_id)')
    .eq('dresses.studio_id', storeId)
    .order('created_at', { ascending: false });

  if (imagesError) {
    throw imagesError;
  }

  const dressesById = new Map(
    ((dresses ?? []) as { id: string; created_at: string }[]).map((dress) => [
      dress.id,
      {
        id: dress.id,
        name: null,
        price: null,
        created_at: dress.created_at,
        dress_images: [] as InventoryDressImage[]
      }
    ])
  );

  ((dressImages ?? []) as { id: string; sort_order: number; created_at?: string; dress_id: string }[]).forEach((image) => {
    const dress = dressesById.get(image.dress_id);
    if (!dress) {
      return;
    }

    dress.dress_images.push({
      id: image.id,
      image_url: '',
      sort_order: image.sort_order,
      created_at: image.created_at
    });
  });

  return buildRevisionToken(Array.from(dressesById.values()));
}

function prefetchInventoryImages(dresses: InventoryDress[]) {
  const urls = dresses
    .flatMap((dress) => dress.dress_images.map((image) => image.image_url))
    .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url));

  urls.forEach((url) => {
    void Image.prefetch(url);
  });
}

export async function syncInventoryForStore({ storeId, maxCacheAgeMs = 1000 * 60 * 30 }: SyncInventoryOptions) {
  const cached = await readCachedInventory(storeId);

  if (cached) {
    prefetchInventoryImages(cached.dresses);
  }

  const cacheAgeMs = cached ? Date.now() - new Date(cached.lastSyncedAt).getTime() : Number.POSITIVE_INFINITY;

  if (cached && cacheAgeMs <= maxCacheAgeMs) {
    return cached.dresses;
  }

  try {
    if (!cached) {
      const dresses = await fetchFullInventory(storeId);
      await writeCachedInventory(storeId, dresses);
      prefetchInventoryImages(dresses);
      return dresses;
    }

    const remoteRevision = await fetchInventoryRevision(storeId);
    if (remoteRevision === cached.revision) {
      return cached.dresses;
    }

    const freshDresses = await fetchFullInventory(storeId);
    await writeCachedInventory(storeId, freshDresses);
    prefetchInventoryImages(freshDresses);
    return freshDresses;
  } catch (error) {
    if (cached) {
      return cached.dresses;
    }

    throw error;
  }
}
