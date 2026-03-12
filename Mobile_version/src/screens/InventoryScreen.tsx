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

import { useAuth } from '../context/AuthContext';
import { assertSupabaseConfigured, supabase } from '../lib/supabase';
import { StoresStackParamList } from '../navigation/AppNavigator';

type DressImage = {
  id: string;
  image_url: string;
  sort_order: number;
};

type Dress = {
  id: string;
  name: string | null;
  price: number | null;
  created_at: string;
  dress_images: DressImage[];
};

type Props = NativeStackScreenProps<StoresStackParamList, 'Inventory'>;

type MaybeImagePickerModule = {
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchImageLibraryAsync: (options: {
    mediaTypes: string[];
    allowsMultipleSelection: boolean;
    quality: number;
  }) => Promise<{ canceled: boolean; assets: { uri: string }[] }>;
};

type MaybeDocumentPickerModule = {
  getDocumentAsync: (options: {
    type: string;
    multiple: boolean;
  }) => Promise<{ canceled: boolean; assets: { uri: string }[] }>;
};

const emptyPhotoField: string[] = [];

const allowedImageUriSchemes = ['http://', 'https://', 'file://', 'content://', 'data:image/'];

function isSupportedImageUri(value: string) {
  const normalized = value.trim().toLowerCase();
  return allowedImageUriSchemes.some((scheme) => normalized.startsWith(scheme));
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

export default function InventoryScreen({ route }: Props) {
  const { session } = useAuth();
  const { storeId, storeName } = route.params;

  const [dresses, setDresses] = useState<Dress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDressModal, setShowCreateDressModal] = useState(false);
  const [dressName, setDressName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>(emptyPhotoField);
  const [savingDress, setSavingDress] = useState(false);

  const loadDresses = useCallback(async () => {
    try {
      assertSupabaseConfigured();
      setLoading(true);
      const { data, error } = await supabase
        .from('dresses')
        .select('id, name, price, created_at, dress_images(id, image_url, sort_order)')
        .eq('studio_id', storeId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formatted = (data ?? []).map((dress) => ({
        ...dress,
        dress_images: [...(dress.dress_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      }));
      setDresses(formatted as Dress[]);
    } catch (error) {
      Alert.alert('Could not load inventory', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  React.useEffect(() => {
    void loadDresses();
  }, [loadDresses]);

  const resetForm = useCallback(() => {
    setDressName('');
    setPriceText('');
    setPhotoUrls(emptyPhotoField);
  }, []);

  const openCreateModal = useCallback(() => {
    resetForm();
    setShowCreateDressModal(true);
  }, [resetForm]);

  const closeCreateModal = useCallback(() => {
    if (savingDress) {
      return;
    }

    setShowCreateDressModal(false);
  }, [savingDress]);

  const appendPhotoUris = useCallback((uris: string[]) => {
    if (uris.length === 0) {
      return;
    }

    setPhotoUrls((previous) => [...previous, ...uris]);
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

    const result = await imagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1
    });

    if (result.canceled) {
      return;
    }

    appendPhotoUris(result.assets.map((asset) => asset.uri));
  }, [appendPhotoUris]);

  const pickFromFiles = useCallback(async () => {
    const documentPicker = loadDocumentPickerModule();
    if (!documentPicker) {
      Alert.alert('Files unavailable', 'expo-document-picker is not installed in this build.');
      return;
    }

    const result = await documentPicker.getDocumentAsync({
      type: 'image/*',
      multiple: true
    });

    if (result.canceled) {
      return;
    }

    appendPhotoUris(result.assets.map((asset) => asset.uri));
  }, [appendPhotoUris]);

  const clearPhotos = useCallback(() => {
    setPhotoUrls([]);
  }, []);

  const createDress = useCallback(async () => {
    const trimmedName = dressName.trim();
    const trimmedPrice = priceText.trim();
    const sanitizedPhotoUrls = photoUrls.map((photo) => photo.trim()).filter(Boolean);

    if (!session?.user.id) {
      Alert.alert('Not signed in', 'Please sign in again before creating a dress.');
      return;
    }

    if (sanitizedPhotoUrls.length === 0) {
      Alert.alert('At least one photo required', 'Please add at least one photo URI before saving.');
      return;
    }

    if (sanitizedPhotoUrls.some((photoUri) => !isSupportedImageUri(photoUri))) {
      Alert.alert(
        'Invalid photo URI',
        'Use an image URI that starts with http://, https://, file://, content://, or data:image/.'
      );
      return;
    }

    let parsedPrice: number | null = null;
    if (trimmedPrice) {
      parsedPrice = Number(trimmedPrice);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        Alert.alert('Invalid price', 'Price must be a positive number.');
        return;
      }
    }

    try {
      assertSupabaseConfigured();
      setSavingDress(true);

      const { data: insertedDress, error: dressError } = await supabase
        .from('dresses')
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

      const imageRows = sanitizedPhotoUrls.map((url, index) => ({
        dress_id: insertedDress.id,
        image_url: url,
        sort_order: index
      }));

      const { error: imagesError } = await supabase.from('dress_images').insert(imageRows);
      if (imagesError) {
        throw imagesError;
      }

      setShowCreateDressModal(false);
      resetForm();
      await loadDresses();
    } catch (error) {
      Alert.alert('Could not save dress', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSavingDress(false);
    }
  }, [dressName, loadDresses, photoUrls, priceText, resetForm, session?.user.id, storeId]);

  const dressTiles = useMemo(
    () =>
      dresses.map((dress) => {
        const leadImage = dress.dress_images[0]?.image_url;

        return (
          <View key={dress.id} style={styles.dressTile}>
            {leadImage ? (
              <Image source={{ uri: leadImage }} style={styles.dressImage} resizeMode="cover" />
            ) : (
              <View style={[styles.dressImage, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>No image</Text>
              </View>
            )}
            <Text numberOfLines={2} style={styles.dressName}>
              {dress.name || 'Untitled dress'}
            </Text>
            <Text style={styles.dressMeta}>{dress.price ? `$${dress.price.toFixed(2)}` : 'No price'}</Text>
            <Text style={styles.dressMeta}>{dress.dress_images.length} photo(s)</Text>
          </View>
        );
      }),
    [dresses]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{storeName} Inventory</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Loading dresses...</Text>
          </View>
        ) : (
          <View style={styles.tilesGrid}>
            <Pressable style={[styles.dressTile, styles.addTile]} onPress={openCreateModal}>
              <Text style={styles.addIcon}>＋</Text>
              <Text style={styles.addLabel}>Add Dress</Text>
            </Pressable>
            {dressTiles}
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={showCreateDressModal} onRequestClose={closeCreateModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create dress profile</Text>
            <TextInput
              style={styles.input}
              placeholder="Dress name (optional)"
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
              Choose images from your gallery or files. You can keep adding more photos anytime.
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

            {photoUrls.length > 0 ? (
              <View style={styles.previewContainer}>
                <View style={styles.previewStack}>
                  {photoUrls.length > 1 ? <View style={[styles.previewPhoto, styles.previewPhotoBack]} /> : null}
                  <Image source={{ uri: photoUrls[0] }} style={[styles.previewPhoto, styles.previewPhotoFront]} />
                </View>
                <View style={styles.previewMeta}>
                  <Text style={styles.previewCount}>{photoUrls.length} photo(s) selected</Text>
                  <Pressable style={styles.clearPhotosButton} onPress={clearPhotos}>
                    <Text style={styles.clearPhotosButtonText}>Clear</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={closeCreateModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.saveButton, savingDress && styles.disabledButton]}
                onPress={() => void createDress()}
                disabled={savingDress}
              >
                <Text style={styles.saveButtonText}>{savingDress ? 'Saving...' : 'Save dress'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f6fb' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#211f35' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { color: '#6f6a80' },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dressTile: {
    width: '47%',
    minHeight: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfdcea',
    backgroundColor: '#fff',
    padding: 10,
    gap: 6
  },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  addIcon: { fontSize: 38, color: '#9d99ac' },
  addLabel: { color: '#4f4a63', fontWeight: '600' },
  dressImage: { width: '100%', height: 88, borderRadius: 8, backgroundColor: '#e9e6f3' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#7e7892' },
  dressName: { fontSize: 15, fontWeight: '600', color: '#2a2739' },
  dressMeta: { color: '#746f86', fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 10,
    maxHeight: '88%'
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#231f32' },
  input: {
    borderWidth: 1,
    borderColor: '#d4d0e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#faf9ff'
  },
  photoSectionLabel: { color: '#4f4a63', fontWeight: '600', marginTop: 2 },
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
  photoPickerButtonText: { color: '#fff', fontWeight: '700' },
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
  previewMeta: { gap: 2 },
  previewCount: { color: '#4a4561', fontWeight: '600' },
  clearPhotosButton: { alignSelf: 'flex-start', paddingVertical: 2 },
  clearPhotosButtonText: { color: '#70688f', fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  actionButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelButton: { backgroundColor: '#eceaf4' },
  cancelButtonText: { color: '#3f3b52', fontWeight: '600' },
  saveButton: { backgroundColor: '#787194' },
  disabledButton: { opacity: 0.65 },
  saveButtonText: { color: '#fff', fontWeight: '700' }
});
