import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

import { assertSupabaseConfigured, supabase } from '../lib/supabase';

export type InventoryDressImage = {
  id: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type InventoryDress = {
  id: string;
  name: string | null;
  price: number | null;
  created_at: string;
  updated_at?: string;
  dress_images: InventoryDressImage[];
};

type CachedInventorySnapshot = {
  dresses: InventoryDress[];
  lastSyncedAt: string;
};

type SyncInventoryOptions = {
  storeId: string;
  maxCacheAgeMs?: number;
};

type RemoteDressRow = {
  id: string;
  name: string | null;
  price: number | null;
  created_at: string;
  updated_at?: string;
};

type RemoteImageRow = {
  id: string;
  dress_id: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

type DressIndexRow = {
  id: string;
  updated_at?: string;
  created_at: string;
};

type ImageIndexRow = {
  id: string;
  dress_id: string;
  updated_at?: string;
  created_at?: string;
};

function getInventoryCacheKey(storeId: string) {
  return `inventory-cache:${storeId}`;
}

function normalizeDresses(dresses: InventoryDress[]) {
  return dresses
    .map((dress) => ({
      ...dress,
      dress_images: [...(dress.dress_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function getDressVersionToken(dress: { updated_at?: string; created_at: string }) {
  return dress.updated_at ?? dress.created_at;
}

function getImageVersionToken(image: { updated_at?: string; created_at?: string }) {
  return image.updated_at ?? image.created_at ?? '';
}

async function readCachedInventory(storeId: string) {
  const raw = await AsyncStorage.getItem(getInventoryCacheKey(storeId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedInventorySnapshot;
    if (!Array.isArray(parsed?.dresses) || typeof parsed?.lastSyncedAt !== 'string') {
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
  const payload: CachedInventorySnapshot = {
    dresses: normalizeDresses(dresses),
    lastSyncedAt: new Date().toISOString()
  };

  await AsyncStorage.setItem(getInventoryCacheKey(storeId), JSON.stringify(payload));
}

async function fetchFullInventory(storeId: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('dresses')
    .select('id, name, price, created_at, updated_at, dress_images(id, image_url, sort_order, created_at, updated_at)')
    .eq('studio_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return normalizeDresses((data ?? []) as InventoryDress[]);
}

async function fetchInventoryIndex(storeId: string) {
  assertSupabaseConfigured();

  const { data: dresses, error: dressesError } = await supabase
    .from('dresses')
    .select('id, created_at, updated_at')
    .eq('studio_id', storeId)
    .order('created_at', { ascending: false });

  if (dressesError) {
    throw dressesError;
  }

  const { data: images, error: imagesError } = await supabase
    .from('dress_images')
    .select('id, dress_id, created_at, updated_at, dresses!inner(studio_id)')
    .eq('dresses.studio_id', storeId);

  if (imagesError) {
    throw imagesError;
  }

  return {
    dresses: (dresses ?? []) as DressIndexRow[],
    images: (images ?? []) as ImageIndexRow[]
  };
}

async function fetchDressesByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('dresses')
    .select('id, name, price, created_at, updated_at')
    .in('id', ids);

  if (error) {
    throw error;
  }

  return (data ?? []) as RemoteDressRow[];
}

async function fetchImagesByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('dress_images')
    .select('id, dress_id, image_url, sort_order, created_at, updated_at')
    .in('id', ids);

  if (error) {
    throw error;
  }

  return (data ?? []) as RemoteImageRow[];
}

function prefetchInventoryImages(dresses: InventoryDress[]) {
  const urls = dresses
    .flatMap((dress) => dress.dress_images.map((image) => image.image_url))
    .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url));

  urls.forEach((url) => {
    void Image.prefetch(url);
  });
}

function toDressMap(dresses: InventoryDress[]) {
  const map = new Map<string, InventoryDress>();
  dresses.forEach((dress) => {
    map.set(dress.id, {
      ...dress,
      dress_images: [...dress.dress_images]
    });
  });
  return map;
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

    const remoteIndex = await fetchInventoryIndex(storeId);

    const cachedDressMap = toDressMap(cached.dresses);
    const cachedDressIds = new Set(cached.dresses.map((dress) => dress.id));
    const remoteDressIds = new Set(remoteIndex.dresses.map((dress) => dress.id));

    const removedDressIds = [...cachedDressIds].filter((id) => !remoteDressIds.has(id));
    const changedDressIds = remoteIndex.dresses
      .filter((remoteDress) => {
        const cachedDress = cachedDressMap.get(remoteDress.id);
        if (!cachedDress) {
          return true;
        }

        return getDressVersionToken(remoteDress) !== getDressVersionToken(cachedDress);
      })
      .map((dress) => dress.id);

    const cachedImageRows = cached.dresses.flatMap((dress) =>
      dress.dress_images.map((image) => ({
        id: image.id,
        dress_id: dress.id,
        updated_at: image.updated_at,
        created_at: image.created_at
      }))
    );

    const cachedImageMap = new Map(cachedImageRows.map((image) => [image.id, image]));
    const cachedImageIds = new Set(cachedImageRows.map((image) => image.id));
    const remoteImageIds = new Set(remoteIndex.images.map((image) => image.id));

    const removedImageIds = [...cachedImageIds].filter((id) => !remoteImageIds.has(id));
    const changedImageIds = remoteIndex.images
      .filter((remoteImage) => {
        const cachedImage = cachedImageMap.get(remoteImage.id);
        if (!cachedImage) {
          return true;
        }

        return getImageVersionToken(remoteImage) !== getImageVersionToken(cachedImage);
      })
      .map((image) => image.id);

    if (removedDressIds.length === 0 && changedDressIds.length === 0 && removedImageIds.length === 0 && changedImageIds.length === 0) {
      await writeCachedInventory(storeId, cached.dresses);
      return cached.dresses;
    }

    const [changedDresses, changedImages] = await Promise.all([
      fetchDressesByIds(changedDressIds),
      fetchImagesByIds(changedImageIds)
    ]);

    removedDressIds.forEach((dressId) => cachedDressMap.delete(dressId));

    changedDresses.forEach((dressRow) => {
      const existing = cachedDressMap.get(dressRow.id);
      cachedDressMap.set(dressRow.id, {
        id: dressRow.id,
        name: dressRow.name,
        price: dressRow.price,
        created_at: dressRow.created_at,
        updated_at: dressRow.updated_at,
        dress_images: existing?.dress_images ?? []
      });
    });

    if (removedImageIds.length > 0) {
      cachedDressMap.forEach((dress) => {
        dress.dress_images = dress.dress_images.filter((image) => !removedImageIds.includes(image.id));
      });
    }

    if (changedImages.length > 0) {
      const imagesByDress = new Map<string, InventoryDressImage[]>();
      cachedDressMap.forEach((dress, dressId) => {
        imagesByDress.set(dressId, [...dress.dress_images]);
      });

      changedImages.forEach((imageRow) => {
        const hostDress = cachedDressMap.get(imageRow.dress_id);
        if (!hostDress) {
          return;
        }

        const current = imagesByDress.get(imageRow.dress_id) ?? [];
        const filtered = current.filter((image) => image.id !== imageRow.id);
        filtered.push({
          id: imageRow.id,
          image_url: imageRow.image_url,
          sort_order: imageRow.sort_order,
          created_at: imageRow.created_at,
          updated_at: imageRow.updated_at
        });
        imagesByDress.set(imageRow.dress_id, filtered);
      });

      imagesByDress.forEach((images, dressId) => {
        const dress = cachedDressMap.get(dressId);
        if (dress) {
          dress.dress_images = images;
        }
      });
    }

    const nextDresses = normalizeDresses(Array.from(cachedDressMap.values()));
    await writeCachedInventory(storeId, nextDresses);
    prefetchInventoryImages(nextDresses);
    return nextDresses;
  } catch (error) {
    if (cached) {
      return cached.dresses;
    }

    throw error;
  }
}
