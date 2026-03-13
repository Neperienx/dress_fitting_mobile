import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { assertSupabaseConfigured, supabase } from '../lib/supabase';

type SessionPreviewDress = {
  id: string;
  name: string | null;
  dress_images: { id: string; image_url: string; sort_order: number }[];
};

function getPreviewImage(dress: SessionPreviewDress) {
  return [...(dress.dress_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url ?? null;
}

export default function SessionScreen() {
  const { session } = useAuth();
  const { selectedStore } = useStore();

  const [previewDresses, setPreviewDresses] = useState<SessionPreviewDress[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [brideName, setBrideName] = useState('');
  const [photoCount, setPhotoCount] = useState('10');

  const loadPreviewDresses = useCallback(async () => {
    if (!selectedStore?.id || !session?.user.id) {
      setPreviewDresses([]);
      setLoadingPreview(false);
      return;
    }

    setLoadingPreview(true);
    try {
      assertSupabaseConfigured();
      const { data, error } = await supabase
        .from('dresses')
        .select('id, name, dress_images(id, image_url, sort_order)')
        .eq('studio_id', selectedStore.id)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) {
        throw error;
      }

      setPreviewDresses(data ?? []);
    } catch (error) {
      console.warn('Could not load session preview dresses', error);
      setPreviewDresses([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedStore?.id, session?.user.id]);

  useEffect(() => {
    void loadPreviewDresses();
  }, [loadPreviewDresses]);

  const previewImages = useMemo(
    () => previewDresses.map(getPreviewImage).filter((image): image is string => Boolean(image)).slice(0, 3),
    [previewDresses]
  );

  const submitStartSession = () => {
    if (!brideName.trim()) {
      Alert.alert('Bride name required', 'Please enter the bride name before starting the session.');
      return;
    }

    const parsedCount = Number.parseInt(photoCount, 10);
    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      Alert.alert('Invalid photo count', 'Please enter a valid number of photos for this session.');
      return;
    }

    Alert.alert('Session started', `${brideName.trim()} session is ready with ${parsedCount} photos.`);
    setShowSessionForm(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Start Session</Text>
        <Text style={styles.subtitle}>Swipe to Discover Dresses</Text>

        <View style={styles.previewStackWrap}>
          {loadingPreview ? (
            <View style={[styles.previewCard, styles.placeholderCard]}>
              <ActivityIndicator color="#5b526f" />
            </View>
          ) : previewImages.length > 0 ? (
            previewImages.map((image, index) => {
              const layers = previewImages.length;
              const reverseIndex = layers - index - 1;
              return (
                <View
                  key={`${image}-${index}`}
                  style={[
                    styles.layer,
                    {
                      transform: [{ translateX: reverseIndex * 14 }, { translateY: reverseIndex * 6 }],
                      zIndex: 5 - reverseIndex
                    }
                  ]}
                >
                  <Image source={{ uri: image }} style={styles.previewCard} resizeMode="cover" />
                </View>
              );
            })
          ) : (
            <View style={[styles.previewCard, styles.placeholderCard]}>
              <Text style={styles.placeholderText}>No inventory photos yet</Text>
              <Text style={styles.placeholderHint}>Add dress photos in Inventory to power session previews.</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.primaryButton} onPress={() => setShowSessionForm(true)}>
          <Text style={styles.primaryButtonText}>Start Session</Text>
        </Pressable>
      </ScrollView>

      <Modal transparent visible={showSessionForm} animationType="slide" onRequestClose={() => setShowSessionForm(false)}>
        <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.modalBackdrop}>
          <Pressable style={styles.dismissArea} onPress={() => setShowSessionForm(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Session details</Text>
            <Text style={styles.modalSubtitle}>Tell us who this session is for before we begin.</Text>

            <Text style={styles.fieldLabel}>Bride name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter bride name"
              value={brideName}
              onChangeText={setBrideName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Number of photos</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10"
              value={photoCount}
              onChangeText={setPhotoCount}
              keyboardType="number-pad"
            />

            <Pressable style={styles.primaryButton} onPress={submitStartSession}>
              <Text style={styles.primaryButtonText}>Start Session</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f1f8' },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 14
  },
  title: { fontSize: 29, fontWeight: '700', color: '#302b41' },
  subtitle: { color: '#6d6880', fontSize: 15 },
  previewStackWrap: {
    width: 230,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center'
  },
  layer: {
    position: 'absolute',
    borderRadius: 16,
    overflow: 'hidden'
  },
  previewCard: {
    width: 170,
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ded8ec',
    backgroundColor: '#ebe7f5'
  },
  placeholderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 8
  },
  placeholderText: {
    color: '#4f4865',
    fontWeight: '600',
    textAlign: 'center'
  },
  placeholderHint: {
    color: '#7a7490',
    textAlign: 'center',
    fontSize: 12
  },
  primaryButton: {
    marginTop: 8,
    width: '100%',
    maxWidth: 260,
    backgroundColor: '#a3a1ab',
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 17, 38, 0.4)',
    justifyContent: 'flex-end'
  },
  dismissArea: { flex: 1 },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 10
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#2e2940' },
  modalSubtitle: { color: '#716b86', marginBottom: 6 },
  fieldLabel: { color: '#4f4a63', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#d8d4e5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#2f2a41'
  }
});
