import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { StoresStackParamList } from '../navigation/AppNavigator';

const englishTagCatalog = require('../data/dress-tags.en.json') as {
  language: string;
  tags: string[];
};

type Props = NativeStackScreenProps<StoresStackParamList, 'DressProfile'>;

function getTagStorageKey(dressId: string) {
  return `dress-tags:${dressId}`;
}

export default function DressProfileScreen({ route }: Props) {
  const { dress } = route.params;
  const photos = dress.dress_images;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);

  React.useEffect(() => {
    let isMounted = true;

    const loadTags = async () => {
      const saved = await AsyncStorage.getItem(getTagStorageKey(dress.id));
      if (!saved || !isMounted) {
        return;
      }

      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSelectedTags(parsed.filter((entry): entry is string => typeof entry === 'string'));
        }
      } catch {
        // no-op for malformed local data
      }
    };

    void loadTags();

    return () => {
      isMounted = false;
    };
  }, [dress.id]);

  const saveTags = useCallback(async (nextTags: string[]) => {
    setSelectedTags(nextTags);
    await AsyncStorage.setItem(getTagStorageKey(dress.id), JSON.stringify(nextTags));
  }, [dress.id]);

  const goPrevious = useCallback(() => {
    setPhotoIndex((previous) => (previous === 0 ? photos.length - 1 : previous - 1));
  }, [photos.length]);

  const goNext = useCallback(() => {
    setPhotoIndex((previous) => (previous === photos.length - 1 ? 0 : previous + 1));
  }, [photos.length]);

  const activePhoto = photos[photoIndex]?.image_url;

  const photoDots = useMemo(
    () =>
      photos.map((photo, index) => (
        <View key={photo.id} style={[styles.dot, index === photoIndex && styles.activeDot]} />
      )),
    [photoIndex, photos]
  );

  const toggleTag = useCallback(
    async (tag: string) => {
      const alreadySelected = selectedTags.includes(tag);
      const nextTags = alreadySelected ? selectedTags.filter((entry) => entry !== tag) : [...selectedTags, tag];
      await saveTags(nextTags);
    },
    [saveTags, selectedTags]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{dress.name || 'Dress profile'}</Text>

        <View style={styles.card}>
          {activePhoto ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: activePhoto }} style={styles.image} resizeMode="cover" />
              <View style={styles.overlayRow}>
                <Pressable style={styles.navZone} onPress={goPrevious} />
                <Pressable style={styles.navZone} onPress={goNext} />
              </View>
              <View style={styles.counterPill}>
                <Text style={styles.counterText}>
                  {photoIndex + 1} of {photos.length}
                </Text>
              </View>
              <View style={styles.dotsRow}>{photoDots}</View>
            </View>
          ) : (
            <View style={[styles.imageWrap, styles.placeholder]}>
              <Text style={styles.placeholderText}>No photos available</Text>
            </View>
          )}
        </View>

        {selectedTags.length > 0 ? (
          <View style={styles.selectedTagsWrap}>
            {selectedTags.map((tag) => (
              <View key={tag} style={styles.selectedTagPill}>
                <Text style={styles.selectedTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable style={styles.manageButton} onPress={() => setShowTagManager(true)}>
          <Text style={styles.manageButtonText}>Manage Tags</Text>
        </Pressable>
      </View>

      <Modal transparent visible={showTagManager} animationType="slide" onRequestClose={() => setShowTagManager(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.dismissArea} onPress={() => setShowTagManager(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Manage tags ({englishTagCatalog.language})</Text>
            <View style={styles.previewRow}>
              {activePhoto ? <Image source={{ uri: activePhoto }} style={styles.miniPreview} /> : <View style={styles.miniPreview} />}
              <Text style={styles.previewName}>{dress.name || 'Untitled dress'}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.tagsGrid}>
              {englishTagCatalog.tags.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <Pressable key={tag} style={[styles.tagChip, isActive && styles.tagChipActive]} onPress={() => void toggleTag(tag)}>
                    <Text style={[styles.tagChipText, isActive && styles.tagChipTextActive]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f6fb' },
  content: { flex: 1, padding: 20, gap: 16 },
  title: { textAlign: 'center', fontSize: 28, fontWeight: '600', color: '#625d73' },
  card: {
    borderRadius: 18,
    padding: 10,
    backgroundColor: '#ebe8f5',
    borderWidth: 1,
    borderColor: '#d8d4e7'
  },
  imageWrap: { width: '100%', aspectRatio: 0.7, borderRadius: 14, overflow: 'hidden', backgroundColor: '#ddd8ec' },
  image: { width: '100%', height: '100%' },
  overlayRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  navZone: { flex: 1 },
  counterPill: {
    position: 'absolute',
    alignSelf: 'center',
    top: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(84, 79, 101, 0.66)'
  },
  counterText: { color: '#fff', fontWeight: '600' },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  activeDot: { backgroundColor: '#fff' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#78708f' },
  selectedTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedTagPill: { backgroundColor: '#e5e2f4', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  selectedTagText: { color: '#433e59', fontWeight: '600' },
  manageButton: {
    marginTop: 'auto',
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: '#efedf7',
    borderWidth: 1,
    borderColor: '#d8d4e7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  manageButtonText: { fontSize: 22, color: '#5e5871', fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: {
    maxHeight: '72%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 12
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#302a45' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniPreview: { width: 56, height: 72, borderRadius: 8, backgroundColor: '#ddd8ec' },
  previewName: { color: '#4d4761', fontSize: 15, fontWeight: '600' },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 20 },
  tagChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cfc8e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f6f4fc'
  },
  tagChipActive: { backgroundColor: '#6d63b8', borderColor: '#6d63b8' },
  tagChipText: { color: '#5b5476', fontWeight: '600' },
  tagChipTextActive: { color: '#fff' }
});
