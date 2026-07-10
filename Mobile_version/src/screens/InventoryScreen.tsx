import React, { useCallback, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { useAuth } from '../context/AuthContext';
import {
  generateDebugInventoryProfile,
  getOpenAiInventoryDebugStatus
} from '../debug/openaiInventoryProfile';
import { assertSupabaseConfiguredForStoreType, getSupabaseForStoreType } from '../lib/supabase';
import { syncInventoryForStore } from '../utils/inventoryCache';
import { getInventorySchemaConfig } from '../utils/inventoryTables';
import { StoresStackParamList } from '../navigation/AppNavigator';

type DressImage = {
  id: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
};

type Dress = {
  id: string;
  name: string | null;
  price: number | null;
  created_at: string;
  dress_images: DressImage[];
};

type Props = NativeStackScreenProps<StoresStackParamList, 'Inventory'>;

type PickerAsset = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
  name?: string | null;
  fileName?: string | null;
};

type MaybeImagePickerModule = {
  MediaTypeOptions?: {
    Images?: string;
  };
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchImageLibraryAsync: (options: {
    mediaTypes: string | string[];
    allowsMultipleSelection: boolean;
    selectionLimit?: number;
    orderedSelection?: boolean;
    legacy?: boolean;
    quality: number;
    base64?: boolean;
  }) => Promise<{ canceled: boolean; assets: PickerAsset[] }>;
};

type MaybeDocumentPickerModule = {
  getDocumentAsync: (options: {
    type: string;
    multiple: boolean;
    copyToCacheDirectory?: boolean;
  }) => Promise<{ canceled: boolean; assets: PickerAsset[] }>;
};

type DebugNotification = {
  tone: 'info' | 'success' | 'error';
  message: string;
};

const emptyPhotoField: string[] = [];
const inventoryUploadQuality = 0.72;
const inventoryStorageBucket = 'inventory-images';
const debugGeneratedPhotoCountMarker = -1;
const stableLocalPhotoCountMarker = -2;
const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const allowedImageUriSchemes = ['http://', 'https://', 'file://', 'content://', 'data:image/'];

function getTagStorageKey(itemId: string) {
  return `dress-tags:${itemId}`;
}

function isSupportedImageUri(value: string) {
  const normalized = value.trim().toLowerCase();
  return allowedImageUriSchemes.some((scheme) => normalized.startsWith(scheme));
}

function getNormalizedImageMimeType(mimeType?: string | null) {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('image/')) {
    return mimeType.toLowerCase();
  }

  return 'image/jpeg';
}

function getPendingUploadRootDir() {
  if (!FileSystem.documentDirectory) {
    throw new Error('Expo file storage is unavailable in this runtime.');
  }

  return `${FileSystem.documentDirectory}inventory-pending-uploads`;
}

function getStableLocalPhotoPath(extension: string) {
  const safeExtension = /^[a-z0-9]{2,6}$/i.test(extension) ? extension.toLowerCase() : 'jpg';
  return `${getPendingUploadRootDir()}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExtension}`;
}

async function ensurePendingUploadDir() {
  await FileSystem.makeDirectoryAsync(getPendingUploadRootDir(), { intermediates: true });
}

async function writeBase64ToStableLocalPhoto(base64Value: string, mimeType?: string | null) {
  await ensurePendingUploadDir();
  const targetUri = getStableLocalPhotoPath(getFileExtensionFromMimeType(getNormalizedImageMimeType(mimeType)));
  await FileSystem.writeAsStringAsync(targetUri, base64Value, {
    encoding: FileSystem.EncodingType.Base64
  });
  return targetUri;
}

async function copyAssetToStableLocalPhoto(asset: PickerAsset) {
  await ensurePendingUploadDir();
  const targetUri = getStableLocalPhotoPath(getFileExtensionFromMimeType(getNormalizedImageMimeType(asset.mimeType)));
  await FileSystem.copyAsync({ from: asset.uri, to: targetUri });
  return targetUri;
}

async function getStableStorageUri(asset: PickerAsset) {
  if (asset.base64 && asset.base64.trim().length > 0) {
    return writeBase64ToStableLocalPhoto(asset.base64, asset.mimeType);
  }

  if (isLocalImageUri(asset.uri)) {
    return copyAssetToStableLocalPhoto(asset);
  }

  return asset.uri.trim();
}

function getImageStorageSavingsMessage(optimizedCount: number, totalCount: number) {
  if (optimizedCount === debugGeneratedPhotoCountMarker) {
    return 'Debug-generated images will be uploaded to inventory storage when saved.';
  }

  if (optimizedCount === stableLocalPhotoCountMarker) {
    return 'Selected photos were copied into app storage and will upload to Supabase when saved.';
  }

  if (optimizedCount === totalCount) {
    return 'All selected photos were copied into the form and will upload from stable image data.';
  }

  if (optimizedCount > 0) {
    return `${optimizedCount} of ${totalCount} selected photo(s) were copied into stable image data.`;
  }

  return 'Selected photos will be saved as-is because this picker could not provide compressible image data.';
}

function getFileExtensionFromMimeType(mimeType: string | null) {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'jpg';
  }
}

function getMimeTypeFromDataUri(value: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  return match?.[1]?.toLowerCase() ?? 'image/jpeg';
}

function isLocalImageUri(value: string) {
  return /^file:\/\//i.test(value) || /^content:\/\//i.test(value);
}

function getBase64PayloadFromDataUri(value: string) {
  const marker = ';base64,';
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Generated image is not a valid base64 data URI.');
  }

  return value.slice(markerIndex + marker.length);
}

function base64ToArrayBuffer(base64Value: string) {
  const normalizedBase64 = base64Value.replace(/\s/g, '');
  const padding = normalizedBase64.endsWith('==') ? 2 : normalizedBase64.endsWith('=') ? 1 : 0;
  const outputLength = Math.floor((normalizedBase64.length * 3) / 4) - padding;
  const buffer = new ArrayBuffer(outputLength);
  const bytes = new Uint8Array(buffer);
  let byteIndex = 0;

  for (let index = 0; index < normalizedBase64.length; index += 4) {
    const encodedA = base64Alphabet.indexOf(normalizedBase64[index]);
    const encodedB = base64Alphabet.indexOf(normalizedBase64[index + 1]);
    const encodedC = normalizedBase64[index + 2] === '=' ? 0 : base64Alphabet.indexOf(normalizedBase64[index + 2]);
    const encodedD = normalizedBase64[index + 3] === '=' ? 0 : base64Alphabet.indexOf(normalizedBase64[index + 3]);

    if (encodedA < 0 || encodedB < 0 || encodedC < 0 || encodedD < 0) {
      throw new Error('Generated image contains invalid base64 data.');
    }

    const chunk = (encodedA << 18) | (encodedB << 12) | (encodedC << 6) | encodedD;
    if (byteIndex < outputLength) {
      bytes[byteIndex] = (chunk >> 16) & 255;
      byteIndex += 1;
    }
    if (byteIndex < outputLength) {
      bytes[byteIndex] = (chunk >> 8) & 255;
      byteIndex += 1;
    }
    if (byteIndex < outputLength) {
      bytes[byteIndex] = chunk & 255;
      byteIndex += 1;
    }
  }

  return buffer;
}

async function getUploadBodyFromSourceUri(sourceUri: string) {
  if (sourceUri.startsWith('data:image/')) {
    return base64ToArrayBuffer(getBase64PayloadFromDataUri(sourceUri));
  }

  if (isLocalImageUri(sourceUri)) {
    try {
      const base64Value = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64
      });
      return base64ToArrayBuffer(base64Value);
    } catch (error) {
      throw new Error(`Could not read the selected phone image before upload. ${getErrorMessage(error)}`);
    }
  }

  const response = await fetch(sourceUri);
  if (!response.ok) {
    throw new Error(`Could not read image before upload. HTTP ${response.status}.`);
  }

  return response.blob();
}

async function assertUploadSourceReadable(sourceUri: string) {
  if (!isLocalImageUri(sourceUri)) {
    return;
  }

  const info = await FileSystem.getInfoAsync(sourceUri);
  if (!info.exists) {
    throw new Error(
      'The selected photo is no longer available on this device. Clear it, choose the photo again, and save immediately after it is copied into the form.'
    );
  }
}

async function deletePendingLocalPhoto(sourceUri: string) {
  if (!sourceUri.startsWith(getPendingUploadRootDir())) {
    return;
  }

  try {
    await FileSystem.deleteAsync(sourceUri, { idempotent: true });
  } catch {
    // Best-effort cleanup only.
  }
}

async function uploadPhotoToStorage(params: {
  scopedSupabase: ReturnType<typeof getSupabaseForStoreType>;
  storeType: string;
  storeId: string;
  itemId: string;
  sourceUri: string;
  sortOrder: number;
}) {
  const { scopedSupabase, storeType, storeId, itemId, sourceUri, sortOrder } = params;
  if (/^https?:\/\//i.test(sourceUri)) {
    return sourceUri;
  }

  const mimeType = sourceUri.startsWith('data:image/') ? getMimeTypeFromDataUri(sourceUri) : 'image/jpeg';
  const extension = getFileExtensionFromMimeType(mimeType);
  const objectPath = `${storeType}/${storeId}/${itemId}/${Date.now()}-${sortOrder}.${extension}`;

  const uploadBody = await getUploadBodyFromSourceUri(sourceUri);

  const { error: uploadError } = await scopedSupabase.storage.from(inventoryStorageBucket).upload(objectPath, uploadBody, {
    contentType: mimeType,
    upsert: true
  });
  if (uploadError) {
    throw uploadError;
  }

  const { data } = scopedSupabase.storage.from(inventoryStorageBucket).getPublicUrl(objectPath);
  if (!data.publicUrl) {
    throw new Error('Could not resolve uploaded image URL.');
  }

  return data.publicUrl;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const details = 'details' in error && typeof error.details === 'string' ? error.details : null;
    const code = 'code' in error && typeof error.code === 'string' ? error.code : null;

    return [error.message, details, code ? `code: ${code}` : null].filter(Boolean).join(' · ');
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function isMissingInventorySchemaError(error: unknown, missingTables: string[]) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';

  return code === 'PGRST205' && missingTables.some((table) => message.includes(`public.${table}`));
}

function isInventoryRlsError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';

  return code === '42501' && message.includes('row-level security policy');
}

function getInventorySchemaMissingMessage(itemLabelPlural: string) {
  return `Inventory tables for ${itemLabelPlural} are missing in your Supabase project. Run \`npx supabase db push\` (or \`npx supabase db reset\` for local dev) from \`Mobile_version/\`, then reload the app.`;
}

function loadImagePickerModule(): MaybeImagePickerModule | null {
  try {
    return require('expo-image-picker') as MaybeImagePickerModule;
  } catch {
    return null;
  }
}

function loadDocumentPickerModule(): MaybeDocumentPickerModule | null {
  try {
    return require('expo-document-picker') as MaybeDocumentPickerModule;
  } catch {
    return null;
  }
}

export default function InventoryScreen({ route, navigation }: Props) {
  const { session } = useAuth();
  const { storeId, storeName, storeType, storeRole } = route.params;
  const canManageInventory = storeRole === 'owner';

  const [dresses, setDresses] = useState<Dress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDressModal, setShowCreateDressModal] = useState(false);
  const [dressName, setDressName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>(emptyPhotoField);
  const [optimizedPhotoCount, setOptimizedPhotoCount] = useState(0);
  const [showDebugGenerator, setShowDebugGenerator] = useState(false);
  const [debugPrompt, setDebugPrompt] = useState('');
  const [debugImageCount, setDebugImageCount] = useState<2 | 3>(3);
  const [generatingDebugProfile, setGeneratingDebugProfile] = useState(false);
  const [generatedTagSuggestions, setGeneratedTagSuggestions] = useState<string[]>([]);
  const [debugNotification, setDebugNotification] = useState<DebugNotification | null>(null);
  const [savingDress, setSavingDress] = useState(false);
  const [deletingDressId, setDeletingDressId] = useState<string | null>(null);
  const [tagCountByDressId, setTagCountByDressId] = useState<Record<string, number>>({});

  const inventorySchema = useMemo(() => getInventorySchemaConfig(storeType), [storeType]);
  const openAiDebugStatus = getOpenAiInventoryDebugStatus();
  const canShowOpenAiDebugGenerator = canManageInventory && openAiDebugStatus.available;

  const loadDresses = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      const data = await syncInventoryForStore({ storeId, storeType, forceRefresh });
      setDresses(data as Dress[]);
    } catch (error) {
      if (isMissingInventorySchemaError(error, [inventorySchema.itemTable, inventorySchema.imageTable])) {
        Alert.alert('Could not load inventory', getInventorySchemaMissingMessage(inventorySchema.titlePlural));
        return;
      }

      Alert.alert('Could not load inventory', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [inventorySchema.imageTable, inventorySchema.itemTable, inventorySchema.titlePlural, storeId, storeType]);

  React.useEffect(() => {
    void loadDresses();
  }, [loadDresses]);

  React.useEffect(() => {
    let isMounted = true;

    const loadTagCounts = async () => {
      if (dresses.length === 0) {
        if (isMounted) {
          setTagCountByDressId({});
        }
        return;
      }

      const keys = dresses.map((dress) => getTagStorageKey(dress.id));
      const entries = await AsyncStorage.multiGet(keys);
      if (!isMounted) {
        return;
      }

      const nextTagCountByDressId: Record<string, number> = {};
      entries.forEach(([key, value]) => {
        const dressId = key.replace('dress-tags:', '');
        if (!value) {
          nextTagCountByDressId[dressId] = 0;
          return;
        }

        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            nextTagCountByDressId[dressId] = parsed.filter((entry): entry is string => typeof entry === 'string').length;
            return;
          }
        } catch {
          // Ignore malformed local tag payloads for this row.
        }

        nextTagCountByDressId[dressId] = 0;
      });

      setTagCountByDressId(nextTagCountByDressId);
    };

    void loadTagCounts();

    return () => {
      isMounted = false;
    };
  }, [dresses]);

  const resetForm = useCallback(() => {
    setDressName('');
    setPriceText('');
    setPhotoUrls(emptyPhotoField);
    setOptimizedPhotoCount(0);
    setShowDebugGenerator(false);
    setDebugPrompt('');
    setDebugImageCount(3);
    setGeneratingDebugProfile(false);
    setGeneratedTagSuggestions([]);
    setDebugNotification(null);
  }, []);

  const openCreateModal = useCallback(() => {
    if (!canManageInventory) {
      Alert.alert('Owner access required', `Only store owners can add ${inventorySchema.titlePlural}.`);
      return;
    }

    resetForm();
    setShowCreateDressModal(true);
  }, [canManageInventory, inventorySchema.titlePlural, resetForm]);

  const closeCreateModal = useCallback(() => {
    if (savingDress || generatingDebugProfile) {
      return;
    }

    setShowCreateDressModal(false);
  }, [generatingDebugProfile, savingDress]);

  const appendPhotoAssets = useCallback(async (assets: PickerAsset[]) => {
    if (assets.length === 0) {
      return;
    }

    try {
      const optimizedUris = (await Promise.all(assets.map(getStableStorageUri))).filter(Boolean);

      if (optimizedUris.length === 0) {
        return;
      }

      setPhotoUrls((previous) => [...previous, ...optimizedUris]);
      setOptimizedPhotoCount(stableLocalPhotoCountMarker);
    } catch (error) {
      Alert.alert(
        'Could not prepare photo',
        `The selected image could not be copied into the inventory form. ${getErrorMessage(error)}`
      );
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    const imagePicker = loadImagePickerModule();
    if (!imagePicker) {
      Alert.alert('Gallery unavailable', 'expo-image-picker is not installed in this build.');
      return;
    }

    const permissionResponse = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResponse.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library to add images.');
      return;
    }

    const mediaTypes = imagePicker.MediaTypeOptions?.Images ?? 'images';
    const result = await imagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      orderedSelection: true,
      legacy: false,
      quality: inventoryUploadQuality,
      base64: true
    });

    if (result.canceled) {
      return;
    }

    await appendPhotoAssets(result.assets);
  }, [appendPhotoAssets]);

  const pickFromFiles = useCallback(async () => {
    const documentPicker = loadDocumentPickerModule();
    if (!documentPicker) {
      Alert.alert('Files unavailable', 'expo-document-picker is not installed in this build.');
      return;
    }

    const result = await documentPicker.getDocumentAsync({
      type: 'image/*',
      multiple: true,
      copyToCacheDirectory: true
    });

    if (result.canceled) {
      return;
    }

    await appendPhotoAssets(result.assets);
  }, [appendPhotoAssets]);

  const clearPhotos = useCallback(() => {
    setPhotoUrls([]);
    setOptimizedPhotoCount(0);
    setGeneratedTagSuggestions([]);
    setDebugNotification(null);
  }, []);

  const saveInventoryItem = useCallback(async (params: {
    name: string;
    price: string;
    imageUris: string[];
    tags: string[];
  }) => {
    const trimmedName = params.name.trim();
    const trimmedPrice = params.price.trim();
    const sanitizedPhotoUrls = params.imageUris.map((photo) => photo.trim()).filter(Boolean);

    if (!canManageInventory) {
      throw new Error(`Only store owners can add ${inventorySchema.titlePlural}.`);
    }

    if (!session?.user.id) {
      throw new Error(`Please sign in again before creating a ${inventorySchema.titleSingular}.`);
    }

    if (sanitizedPhotoUrls.length === 0) {
      throw new Error('At least one generated or selected photo is required before saving.');
    }

    if (sanitizedPhotoUrls.some((photoUri) => !isSupportedImageUri(photoUri))) {
      throw new Error('Use an image URI that starts with http://, https://, file://, content://, or data:image/.');
    }

    let parsedPrice: number | null = null;
    if (trimmedPrice) {
      parsedPrice = Number(trimmedPrice);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        throw new Error('Price must be a positive number.');
      }
    }

    assertSupabaseConfiguredForStoreType(storeType);
    const scopedSupabase = getSupabaseForStoreType(storeType);
    setSavingDress(true);
    let insertedItemId: string | null = null;

    try {
      for (const photoUrl of sanitizedPhotoUrls) {
        await assertUploadSourceReadable(photoUrl);
      }

      const { data: insertedDress, error: dressError } = await scopedSupabase
        .from(inventorySchema.itemTable)
        .insert({
          studio_id: storeId,
          created_by: session.user.id,
          name: trimmedName || null,
          price: parsedPrice
        })
        .select('id')
        .single();

      if (dressError) {
        throw dressError;
      }
      insertedItemId = insertedDress.id;

      const uploadedPhotoUrls: string[] = [];
      for (const [index, photoUrl] of sanitizedPhotoUrls.entries()) {
        const uploadedPhotoUrl = await uploadPhotoToStorage({
          scopedSupabase,
          storeType,
          storeId,
          itemId: insertedDress.id,
          sourceUri: photoUrl,
          sortOrder: index
        });
        uploadedPhotoUrls.push(uploadedPhotoUrl);
      }

      const imageRows = uploadedPhotoUrls.map((url, index) => ({
        [inventorySchema.itemForeignKey]: insertedDress.id,
        image_url: url,
        sort_order: index
      }));

      const { error: imagesError } = await scopedSupabase.from(inventorySchema.imageTable).insert(imageRows);
      if (imagesError) {
        throw imagesError;
      }

      if (params.tags.length > 0) {
        await AsyncStorage.setItem(getTagStorageKey(insertedDress.id), JSON.stringify(params.tags));
      }

      await Promise.all(sanitizedPhotoUrls.map(deletePendingLocalPhoto));
      await loadDresses(true);

      return {
        itemId: insertedDress.id as string,
        uploadedPhotoUrls
      };
    } catch (error) {
      if (insertedItemId) {
        try {
          await scopedSupabase.from(inventorySchema.itemTable).delete().eq('id', insertedItemId);
        } catch {
          // Preserve the original upload/save failure for the user-facing alert.
        }
      }
      throw error;
    } finally {
      setSavingDress(false);
    }
  }, [canManageInventory, inventorySchema.imageTable, inventorySchema.itemForeignKey, inventorySchema.itemTable, inventorySchema.titlePlural, inventorySchema.titleSingular, loadDresses, session?.user.id, storeId, storeType]);

  const generateDebugProfile = useCallback(async () => {
    const status = getOpenAiInventoryDebugStatus();
    if (!status.available) {
      Alert.alert('Debug generator unavailable', 'OpenAI inventory debug generation is only available in development builds.');
      return;
    }

    if (!status.enabled) {
      Alert.alert(
        'Debug generator disabled',
        'Set EXPO_PUBLIC_ENABLE_OPENAI_INVENTORY_DEBUG=true in Mobile_version/.env.local, then restart Expo.'
      );
      return;
    }

    if (!status.hasApiKey) {
      Alert.alert(
        'Debug API key missing',
        'Add EXPO_PUBLIC_DEBUG_OPENAI_API_KEY to Mobile_version/.env.local, then restart Expo.'
      );
      return;
    }

    try {
      setGeneratingDebugProfile(true);
      setDebugNotification({ tone: 'info', message: 'Generating debug images with OpenAI...' });
      const profile = await generateDebugInventoryProfile({
        prompt: debugPrompt,
        storeType,
        imageCount: debugImageCount
      });

      if (profile.imageUris.length !== debugImageCount || profile.imageUris.some((imageUri) => !isSupportedImageUri(imageUri))) {
        throw new Error(`OpenAI returned ${profile.imageUris.length} usable image(s), expected ${debugImageCount}.`);
      }

      setDressName((current) => current.trim() || profile.name);
      setPhotoUrls(profile.imageUris);
      setOptimizedPhotoCount(debugGeneratedPhotoCountMarker);
      setGeneratedTagSuggestions(profile.suggestedTags);
      setDebugNotification({ tone: 'info', message: 'Images generated. Uploading and saving this profile to inventory...' });

      const savedItem = await saveInventoryItem({
        name: dressName.trim() || profile.name,
        price: priceText,
        imageUris: profile.imageUris,
        tags: profile.suggestedTags
      });

      setDebugNotification({
        tone: 'success',
        message: `Saved generated profile to inventory with ${savedItem.uploadedPhotoUrls.length} image(s). You can close this panel and see it in the grid.`
      });
    } catch (error) {
      setDebugNotification({
        tone: 'error',
        message: `Debug generation/save failed: ${getErrorMessage(error)}`
      });
      console.error('[InventoryScreen] Debug inventory generation failed', {
        storeId,
        storeType,
        requestedImageCount: debugImageCount,
        error
      });
      Alert.alert('Could not generate debug profile', getErrorMessage(error));
    } finally {
      setGeneratingDebugProfile(false);
    }
  }, [debugImageCount, debugPrompt, dressName, priceText, saveInventoryItem, storeId, storeType]);

  const createDress = useCallback(async () => {
    try {
      await saveInventoryItem({
        name: dressName,
        price: priceText,
        imageUris: photoUrls,
        tags: generatedTagSuggestions
      });
      setShowCreateDressModal(false);
      resetForm();
    } catch (error) {
      if (isMissingInventorySchemaError(error, [inventorySchema.itemTable, inventorySchema.imageTable])) {
        Alert.alert(`Could not save ${inventorySchema.titleSingular}`, getInventorySchemaMissingMessage(inventorySchema.titlePlural));
        return;
      }

      if (isInventoryRlsError(error)) {
        Alert.alert(
          `Could not save ${inventorySchema.titleSingular}`,
          `Your account is missing permission to add ${inventorySchema.titlePlural} in this studio. Please sign out and sign in again. If the issue persists, apply the latest Supabase migrations from \`Mobile_version/\` with \`npx supabase db push\`.`
        );
        return;
      }

      const debugMessage = getErrorMessage(error);
      console.error('[InventoryScreen] Failed to save dress', {
        storeId,
        userId: session?.user.id,
        photoCount: photoUrls.length,
        error
      });
      Alert.alert(`Could not save ${inventorySchema.titleSingular}`, `Unable to save this ${inventorySchema.titleSingular} right now. ${debugMessage}`);
    }
  }, [dressName, generatedTagSuggestions, inventorySchema.imageTable, inventorySchema.itemTable, inventorySchema.titlePlural, inventorySchema.titleSingular, photoUrls, priceText, resetForm, saveInventoryItem, session?.user.id, storeId]);

  const deleteDress = useCallback(
    async (dress: Dress) => {
      if (deletingDressId) {
        return;
      }

      if (!canManageInventory) {
        Alert.alert('Owner access required', `Only store owners can delete ${inventorySchema.titlePlural}.`);
        return;
      }

      try {
        assertSupabaseConfiguredForStoreType(storeType);
        const scopedSupabase = getSupabaseForStoreType(storeType);
        setDeletingDressId(dress.id);

        const { error } = await scopedSupabase.from(inventorySchema.itemTable).delete().eq('id', dress.id);
        if (error) {
          throw error;
        }

        await loadDresses(true);
      } catch (error) {
        if (isInventoryRlsError(error)) {
          Alert.alert(
            `Could not delete ${inventorySchema.titleSingular}`,
            `Your account is missing permission to delete ${inventorySchema.titlePlural} in this studio.`
          );
          return;
        }

        Alert.alert(`Could not delete ${inventorySchema.titleSingular}`, getErrorMessage(error));
      } finally {
        setDeletingDressId(null);
      }
    },
    [canManageInventory, deletingDressId, inventorySchema.itemTable, inventorySchema.titlePlural, inventorySchema.titleSingular, loadDresses, storeType]
  );

  const confirmDeleteDress = useCallback(
    (dress: Dress) => {
      const displayName = dress.name?.trim() || `this ${inventorySchema.titleSingular}`;
      Alert.alert(
        `Delete ${inventorySchema.titleSingular}?`,
        `Are you sure you want to delete ${displayName}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void deleteDress(dress);
            }
          }
        ]
      );
    },
    [deleteDress, inventorySchema.titleSingular]
  );

  const dressTiles = useMemo(
    () =>
      dresses.map((dress) => {
        const leadImage = dress.dress_images[0]?.image_url;
        const tagCount = tagCountByDressId[dress.id] ?? 0;
        const isDeleting = deletingDressId === dress.id;

        return (
          <View key={dress.id} style={styles.dressTile}>
            <Pressable
              style={[styles.deleteButton, !canManageInventory && styles.hiddenOwnerControl]}
              onPress={() => confirmDeleteDress(dress)}
              disabled={isDeleting || !canManageInventory}
              hitSlop={6}
            >
              <Text style={styles.deleteButtonText}>{isDeleting ? '…' : '✕'}</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('DressProfile', { storeId, storeName, storeType, storeRole, dress })}
              style={styles.dressTileContent}
            >
              {leadImage ? (
                <View style={styles.imageWrap}>
                  <Image source={{ uri: leadImage }} style={styles.dressImage} resizeMode="cover" />
                  <View style={styles.inventoryOverlayRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{dress.dress_images.length} photo(s)</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{tagCount} tag(s)</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.imageWrap}>
                  <View style={[styles.dressImage, styles.imagePlaceholder]}>
                    <Text style={styles.imagePlaceholderText}>No image</Text>
                  </View>
                  <View style={styles.inventoryOverlayRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{dress.dress_images.length} photo(s)</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{tagCount} tag(s)</Text>
                    </View>
                  </View>
                </View>
              )}
              <Text numberOfLines={2} style={styles.dressName}>
                {dress.name || `Untitled ${inventorySchema.titleSingular}`}
              </Text>
              <Text style={styles.dressMeta}>{dress.price ? `$${dress.price.toFixed(2)}` : 'No price'}</Text>
            </Pressable>
          </View>
        );
      }),
    [canManageInventory, confirmDeleteDress, deletingDressId, dresses, inventorySchema.titleSingular, navigation, storeId, storeName, storeRole, storeType, tagCountByDressId]
  );

  const debugNoticeToneStyle =
    debugNotification?.tone === 'success'
      ? styles.debugNoticeSuccess
      : debugNotification?.tone === 'error'
        ? styles.debugNoticeError
        : styles.debugNoticeInfo;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{storeName} Inventory</Text>
        {!canManageInventory ? (
          <View style={styles.memberNotice}>
            <Text style={styles.memberNoticeText}>View-only access. Ask a store owner to add, edit, or delete inventory profiles.</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>{`Loading ${inventorySchema.titlePlural}...`}</Text>
          </View>
        ) : (
          <View style={styles.tilesGrid}>
            <Pressable
              style={[styles.dressTile, styles.addTile, !canManageInventory && styles.hiddenOwnerControl]}
              onPress={openCreateModal}
              disabled={!canManageInventory}
            >
              <Text style={styles.addIcon}>＋</Text>
              <Text style={styles.addLabel}>{`Add ${inventorySchema.titleSingular.charAt(0).toUpperCase()}${inventorySchema.titleSingular.slice(1)}`}</Text>
            </Pressable>
            {dressTiles}
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={showCreateDressModal} onRequestClose={closeCreateModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalTitle}>{`Create ${inventorySchema.titleSingular} profile`}</Text>
              <TextInput
                style={styles.input}
                placeholder={`${inventorySchema.titleSingular.charAt(0).toUpperCase()}${inventorySchema.titleSingular.slice(1)} name (optional)`}
                value={dressName}
                onChangeText={setDressName}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.input}
                placeholder="Price (optional)"
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="decimal-pad"
              />

              <Text style={styles.photoSectionLabel}>Photos (at least one required)</Text>
              <Text style={styles.photoSectionHint}>
                Choose images from your gallery or files. You can select multiple photos in one pick. Gallery picks are compressed to keep storage usage lower while preserving good quality.
              </Text>
              <View style={styles.photoButtonRow}>
                <Pressable style={[styles.photoPickerButton, styles.filesButton]} onPress={() => void pickFromFiles()}>
                  <Text style={styles.photoPickerButtonText}>Files</Text>
                </Pressable>
                <Pressable
                  style={[styles.photoPickerButton, styles.galleryButton]}
                  onPress={() => void pickFromGallery()}
                >
                  <Text style={styles.photoPickerButtonText}>Gallery</Text>
                </Pressable>
              </View>

              {canShowOpenAiDebugGenerator ? (
                <View style={styles.debugPanel}>
                  <Text style={styles.debugBadge}>DEBUG ONLY - DEVELOPMENT BUILDS ONLY</Text>
                  <Pressable
                    style={styles.debugGeneratorToggle}
                    onPress={() => setShowDebugGenerator((previous) => !previous)}
                    disabled={savingDress || generatingDebugProfile}
                  >
                    <Text style={styles.debugGeneratorToggleText}>
                      {`Generate new ${inventorySchema.titleSingular} profile from prompt`}
                    </Text>
                  </Pressable>
                  {showDebugGenerator ? (
                    <View style={styles.debugGeneratorForm}>
                      <TextInput
                        style={[styles.input, styles.debugPromptInput]}
                        placeholder={`Describe the ${inventorySchema.titleSingular} to generate`}
                        value={debugPrompt}
                        onChangeText={setDebugPrompt}
                        multiline
                      />
                      <View style={styles.debugCountRow}>
                        {[2, 3].map((count) => {
                          const typedCount = count as 2 | 3;
                          const selected = debugImageCount === typedCount;
                          return (
                            <Pressable
                              key={count}
                              style={[styles.debugCountButton, selected && styles.debugCountButtonActive]}
                              onPress={() => setDebugImageCount(typedCount)}
                              disabled={generatingDebugProfile}
                            >
                              <Text style={[styles.debugCountButtonText, selected && styles.debugCountButtonTextActive]}>
                                {count} images
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Pressable
                        style={[styles.debugGenerateButton, (generatingDebugProfile || savingDress) && styles.disabledButton]}
                        onPress={() => void generateDebugProfile()}
                        disabled={generatingDebugProfile || savingDress}
                      >
                        {generatingDebugProfile || savingDress ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                        <Text style={styles.debugGenerateButtonText}>
                          {generatingDebugProfile ? 'Generating debug images...' : savingDress ? 'Saving generated profile...' : 'Generate and save debug profile'}
                        </Text>
                      </Pressable>
                      {debugNotification ? (
                        <View style={[styles.debugNotice, debugNoticeToneStyle]}>
                          <Text style={styles.debugNoticeText}>{debugNotification.message}</Text>
                        </View>
                      ) : null}
                      {photoUrls.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.generatedPreviewRow}>
                          {photoUrls.map((photoUrl, index) => (
                            <Image key={`${photoUrl.slice(0, 32)}-${index}`} source={{ uri: photoUrl }} style={styles.generatedPreviewImage} />
                          ))}
                        </ScrollView>
                      ) : null}
                      {generatedTagSuggestions.length > 0 ? (
                        <Text style={styles.debugTagHint}>
                          {`Auto tags queued: ${generatedTagSuggestions.join(', ')}`}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {photoUrls.length > 0 ? (
                <View style={styles.previewContainer}>
                  <View style={styles.previewStack}>
                    {photoUrls.length > 1 ? <View style={[styles.previewPhoto, styles.previewPhotoBack]} /> : null}
                    <Image source={{ uri: photoUrls[0] }} style={[styles.previewPhoto, styles.previewPhotoFront]} />
                  </View>
                  <View style={styles.previewMeta}>
                    <Text style={styles.previewCount}>{photoUrls.length} photo(s) selected</Text>
                    <Text style={styles.previewHint}>{getImageStorageSavingsMessage(optimizedPhotoCount, photoUrls.length)}</Text>
                    <Pressable style={styles.clearPhotosButton} onPress={clearPhotos}>
                      <Text style={styles.clearPhotosButtonText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={closeCreateModal}>
                  <Text style={styles.cancelButtonText}>{debugNotification?.tone === 'success' ? 'Done' : 'Cancel'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.saveButton, (savingDress || debugNotification?.tone === 'success') && styles.disabledButton]}
                  onPress={() => void createDress()}
                  disabled={savingDress || generatingDebugProfile || debugNotification?.tone === 'success'}
                >
                  <Text style={styles.saveButtonText}>
                    {savingDress ? 'Saving...' : debugNotification?.tone === 'success' ? 'Saved' : `Save ${inventorySchema.titleSingular}`}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5F7' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#2E2A2B' },
  memberNotice: {
    borderWidth: 1,
    borderColor: '#E9E4E6',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 12
  },
  memberNoticeText: { color: '#6B6467', lineHeight: 19 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { color: '#6B6467' },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dressTile: {
    width: '47%',
    minHeight: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E4E6',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 6,
    position: 'relative'
  },
  dressTileContent: { gap: 6 },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 29, 54, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2
  },
  deleteButtonText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  hiddenOwnerControl: { display: 'none' },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  addIcon: { fontSize: 38, color: '#9d99ac' },
  addLabel: { color: '#6B6467', fontWeight: '600' },
  imageWrap: { position: 'relative' },
  dressImage: { width: '100%', height: 88, borderRadius: 8, backgroundColor: '#e9e6f3' },
  inventoryOverlayRow: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6
  },
  metaPill: {
    backgroundColor: 'rgba(41, 36, 56, 0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  metaPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#7e7892' },
  dressName: { fontSize: 15, fontWeight: '600', color: '#2E2A2B' },
  dressMeta: { color: '#746f86', fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '88%'
  },
  modalScrollContent: { gap: 10, paddingBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#231f32' },
  input: {
    borderWidth: 1,
    borderColor: '#d4d0e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#faf9ff'
  },
  photoSectionLabel: { color: '#6B6467', fontWeight: '600', marginTop: 2 },
  photoSectionHint: { color: '#7b7690', fontSize: 12, marginTop: -2, marginBottom: 2 },
  photoButtonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  photoPickerButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filesButton: { backgroundColor: '#5f61cd' },
  galleryButton: { backgroundColor: '#8f46c8' },
  photoPickerButtonText: { color: '#FFFFFF', fontWeight: '700' },
  debugPanel: {
    borderWidth: 1,
    borderColor: '#f0c36d',
    backgroundColor: '#fff8e8',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 2
  },
  debugBadge: { color: '#8b5e00', fontSize: 11, fontWeight: '800' },
  debugGeneratorToggle: {
    minHeight: 42,
    borderRadius: 9,
    backgroundColor: '#2f4050',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  debugGeneratorToggleText: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center' },
  debugGeneratorForm: { gap: 8 },
  debugPromptInput: { minHeight: 82, textAlignVertical: 'top' },
  debugCountRow: { flexDirection: 'row', gap: 8 },
  debugCountButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#cfc7ad',
    backgroundColor: '#fffdf6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  debugCountButtonActive: { borderColor: '#2f4050', backgroundColor: '#dfe8ee' },
  debugCountButtonText: { color: '#6b5b33', fontWeight: '700' },
  debugCountButtonTextActive: { color: '#263744' },
  debugGenerateButton: {
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: '#506b7f',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  debugGenerateButtonText: { color: '#FFFFFF', fontWeight: '800' },
  debugNotice: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  debugNoticeInfo: { backgroundColor: '#eef5f8', borderColor: '#b5ccd7' },
  debugNoticeSuccess: { backgroundColor: '#edf7ed', borderColor: '#a9d5aa' },
  debugNoticeError: { backgroundColor: '#fff0ed', borderColor: '#eba99d' },
  debugNoticeText: { color: '#3c3a32', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  generatedPreviewRow: { gap: 8, paddingVertical: 2 },
  generatedPreviewImage: {
    width: 78,
    height: 104,
    borderRadius: 8,
    backgroundColor: '#efe9d9',
    borderWidth: 1,
    borderColor: '#d8ceb0'
  },
  debugTagHint: { color: '#755d25', fontSize: 12, lineHeight: 16 },
  previewContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  previewStack: { width: 54, height: 58, justifyContent: 'center', alignItems: 'center' },
  previewPhoto: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#ddd7f2',
    borderWidth: 1,
    borderColor: '#d2cce8'
  },
  previewPhotoBack: { position: 'absolute', top: 8, left: 8, backgroundColor: '#ece9f8' },
  previewPhotoFront: { position: 'absolute', top: 3, left: 3 },
  previewMeta: { gap: 2, flex: 1 },
  previewCount: { color: '#4a4561', fontWeight: '600' },
  previewHint: { color: '#7b7690', fontSize: 12, lineHeight: 16 },
  clearPhotosButton: { alignSelf: 'flex-start', paddingVertical: 2 },
  clearPhotosButtonText: { color: '#70688f', fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  actionButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelButton: { backgroundColor: '#eceaf4' },
  cancelButtonText: { color: '#3f3b52', fontWeight: '600' },
  saveButton: { backgroundColor: '#787194' },
  disabledButton: { opacity: 0.65 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700' }
});
