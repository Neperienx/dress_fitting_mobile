import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { assertSupabaseConfigured, supabase } from '../lib/supabase';

const englishTagCatalog = require('../data/dress-tags.en.json') as {
  categories?: Array<{ name: string; tags: string[] }>;
};

type SessionPreviewDress = {
  id: string;
  name: string | null;
  price: number | null;
  created_at: string;
  dress_images: { id: string; image_url: string; sort_order: number }[];
};

type SessionDress = SessionPreviewDress & {
  tags: string[];
};

type SwipeDecision = 'like' | 'dislike' | 'superlike';
type SessionStage = 'landing' | 'swiping' | 'results';
type ResultsTab = 'analytics' | 'ranking';

type TagSummary = {
  likes: number;
  dislikes: number;
  score: number;
};

function getTagStorageKey(dressId: string) {
  return `dress-tags:${dressId}`;
}

function getPreviewImage(dress: SessionPreviewDress | SessionDress) {
  return [...(dress.dress_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url ?? null;
}

function chooseDressesByTagCoverage(dresses: SessionDress[], count: number) {
  const remaining = [...dresses];
  const picked: SessionDress[] = [];
  const coveredTags = new Set<string>();

  while (picked.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestNewCoverage = -1;
    let bestTagCount = -1;

    remaining.forEach((dress, index) => {
      const uniqueTags = [...new Set(dress.tags)];
      const newCoverage = uniqueTags.filter((tag) => !coveredTags.has(tag)).length;

      if (newCoverage > bestNewCoverage || (newCoverage === bestNewCoverage && uniqueTags.length > bestTagCount)) {
        bestIndex = index;
        bestNewCoverage = newCoverage;
        bestTagCount = uniqueTags.length;
      }
    });

    const [chosen] = remaining.splice(bestIndex, 1);
    picked.push(chosen);
    chosen.tags.forEach((tag) => coveredTags.add(tag));
  }

  return picked;
}

function applyDecision(tagSummary: Record<string, TagSummary>, tags: string[], decision: SwipeDecision) {
  const weight = decision === 'superlike' ? 2 : decision === 'like' ? 1 : -1;
  const isPositive = weight > 0;

  tags.forEach((tag) => {
    const previous = tagSummary[tag] ?? { likes: 0, dislikes: 0, score: 0 };
    tagSummary[tag] = {
      likes: previous.likes + (isPositive ? weight : 0),
      dislikes: previous.dislikes + (isPositive ? 0 : Math.abs(weight)),
      score: previous.score + weight
    };
  });
}

export default function SessionScreen() {
  const { session } = useAuth();
  const { selectedStore } = useStore();

  const [allStoreDresses, setAllStoreDresses] = useState<SessionDress[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [brideName, setBrideName] = useState('');
  const [photoCount, setPhotoCount] = useState('10');
  const [sessionStage, setSessionStage] = useState<SessionStage>('landing');
  const [sessionQueue, setSessionQueue] = useState<SessionDress[]>([]);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ResultsTab>('analytics');
  const [tagScores, setTagScores] = useState<Record<string, TagSummary>>({});
  const [dressDecisions, setDressDecisions] = useState<Record<string, SwipeDecision>>({});

  const swipePosition = useRef(new Animated.ValueXY()).current;

  const loadInventoryDresses = useCallback(async () => {
    if (!selectedStore?.id || !session?.user.id) {
      setAllStoreDresses([]);
      setLoadingPreview(false);
      return;
    }

    setLoadingPreview(true);
    try {
      assertSupabaseConfigured();
      const { data, error } = await supabase
        .from('dresses')
        .select('id, name, price, created_at, dress_images(id, image_url, sort_order)')
        .eq('studio_id', selectedStore.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const dresses = (data ?? []) as SessionPreviewDress[];
      const keys = dresses.map((dress) => getTagStorageKey(dress.id));
      const storedTags = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
      const tagsByKey = new Map(storedTags);

      const hydratedDresses = dresses.map((dress) => {
        const rawTags = tagsByKey.get(getTagStorageKey(dress.id));
        let tags: string[] = [];

        if (rawTags) {
          try {
            const parsed = JSON.parse(rawTags);
            if (Array.isArray(parsed)) {
              tags = parsed.filter((entry): entry is string => typeof entry === 'string');
            }
          } catch {
            tags = [];
          }
        }

        return {
          ...dress,
          tags
        };
      });

      setAllStoreDresses(hydratedDresses);
    } catch (error) {
      console.warn('Could not load session dresses', error);
      setAllStoreDresses([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedStore?.id, session?.user.id]);

  useEffect(() => {
    void loadInventoryDresses();
  }, [loadInventoryDresses]);

  const previewImages = useMemo(
    () => allStoreDresses.map(getPreviewImage).filter((image): image is string => Boolean(image)).slice(0, 3),
    [allStoreDresses]
  );

  const swipedCount = swipeIndex;
  const currentDress = sessionQueue[swipeIndex] ?? null;

  const animatedCardStyle = {
    transform: [
      ...swipePosition.getTranslateTransform(),
      {
        rotate: swipePosition.x.interpolate({
          inputRange: [-180, 0, 180],
          outputRange: ['-14deg', '0deg', '14deg'],
          extrapolate: 'clamp'
        })
      }
    ]
  };

  const resetSwipePosition = useCallback(() => {
    Animated.spring(swipePosition, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true
    }).start();
  }, [swipePosition]);

  const progressSession = useCallback(
    (decision: SwipeDecision) => {
      const dress = sessionQueue[swipeIndex];
      if (!dress) {
        return;
      }

      setTagScores((previous) => {
        const next = { ...previous };
        applyDecision(next, dress.tags, decision);
        return next;
      });

      setDressDecisions((previous) => ({ ...previous, [dress.id]: decision }));

      const nextIndex = swipeIndex + 1;
      if (nextIndex >= sessionQueue.length) {
        setSessionStage('results');
      }
      setSwipeIndex(nextIndex);
      swipePosition.setValue({ x: 0, y: 0 });
    },
    [sessionQueue, swipeIndex, swipePosition]
  );

  const animateSwipeOut = useCallback(
    (decision: SwipeDecision) => {
      const toValue =
        decision === 'like' ? { x: 440, y: 12 } : decision === 'dislike' ? { x: -440, y: 12 } : { x: 0, y: -420 };

      Animated.timing(swipePosition, {
        toValue,
        duration: 210,
        useNativeDriver: true
      }).start(() => {
        progressSession(decision);
      });
    },
    [progressSession, swipePosition]
  );

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
        onPanResponderMove: (_, gesture) => {
          swipePosition.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -130 && Math.abs(gesture.dx) < 130) {
            animateSwipeOut('superlike');
            return;
          }

          if (gesture.dx > 130) {
            animateSwipeOut('like');
            return;
          }

          if (gesture.dx < -130) {
            animateSwipeOut('dislike');
            return;
          }

          resetSwipePosition();
        }
      }),
    [animateSwipeOut, resetSwipePosition, swipePosition]
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

    if (allStoreDresses.length === 0) {
      Alert.alert('No dresses available', 'Add dresses with photos and tags before starting a session.');
      return;
    }

    const queue = chooseDressesByTagCoverage(allStoreDresses, parsedCount);
    setSessionQueue(queue);
    setSwipeIndex(0);
    setTagScores({});
    setDressDecisions({});
    setActiveTab('analytics');
    setShowSessionForm(false);
    setSessionStage('swiping');
  };

  const rankedDresses = useMemo(() => {
    return [...allStoreDresses]
      .map((dress) => ({
        dress,
        score: dress.tags.reduce((total, tag) => total + (tagScores[tag]?.score ?? 0), 0)
      }))
      .sort((a, b) => b.score - a.score);
  }, [allStoreDresses, tagScores]);

  const rankedTags = useMemo(
    () =>
      Object.entries(tagScores)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([tag, stats]) => ({ tag, ...stats })),
    [tagScores]
  );

  const tagsByCategory = useMemo(() => {
    const categoryByTag = new Map<string, string>();
    (englishTagCatalog.categories ?? []).forEach((category) => {
      category.tags.forEach((tag) => {
        categoryByTag.set(tag, category.name);
      });
    });

    const grouped = new Map<string, Array<(typeof rankedTags)[number]>>();
    rankedTags.forEach((tagRow) => {
      const category = categoryByTag.get(tagRow.tag) ?? 'Other';
      const rows = grouped.get(category) ?? [];
      rows.push(tagRow);
      grouped.set(category, rows);
    });

    return Array.from(grouped.entries()).map(([category, tags]) => ({ category, tags }));
  }, [rankedTags]);

  const renderLanding = () => (
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
  );

  const renderSwiping = () => {
    if (!currentDress) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No cards to swipe</Text>
        </View>
      );
    }

    const image = getPreviewImage(currentDress);

    return (
      <View style={styles.swipeStage}>
        <Text style={styles.sessionName}>{brideName.trim() || 'Session'}</Text>
        <Text style={styles.sessionCounter}>
          {swipedCount + 1} of {sessionQueue.length}
        </Text>

        <View style={styles.deckArea}>
          <Animated.View style={[styles.swipeCard, animatedCardStyle]} {...swipeResponder.panHandlers}>
            {image ? (
              <Image source={{ uri: image }} style={styles.swipeImage} resizeMode="cover" />
            ) : (
              <View style={[styles.swipeImage, styles.placeholderCard]}>
                <Text style={styles.placeholderText}>No photo</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{currentDress.name || 'Untitled dress'}</Text>
            </View>
          </Animated.View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable style={[styles.controlButton, styles.rejectButton]} onPress={() => animateSwipeOut('dislike')}>
            <Text style={styles.controlText}>✕</Text>
          </Pressable>
          <Pressable style={[styles.controlButton, styles.superButton]} onPress={() => animateSwipeOut('superlike')}>
            <Text style={styles.controlText}>★</Text>
          </Pressable>
          <Pressable style={[styles.controlButton, styles.likeButton]} onPress={() => animateSwipeOut('like')}>
            <Text style={styles.controlText}>♥</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderAnalyticsTab = () => (
    <ScrollView contentContainerStyle={styles.resultsContent}>
      <Text style={styles.resultsTitle}>{brideName.trim() || 'Session'} analytics</Text>
      <Text style={styles.resultsSubtitle}>
        {Object.keys(dressDecisions).length} swiped / {sessionQueue.length} chosen dresses
      </Text>

      {tagsByCategory.length === 0 ? (
        <Text style={styles.placeholderHint}>No tag analytics available. Add tags to dresses in inventory.</Text>
      ) : (
        tagsByCategory.map((group) => (
          <View key={group.category} style={styles.analyticsCategorySection}>
            <Text style={styles.analyticsCategoryTitle}>{group.category}</Text>
            {group.tags.map((tagRow) => {
              const total = Math.max(tagRow.likes + tagRow.dislikes, 1);
              const likeWidth = `${(tagRow.likes / total) * 100}%`;
              const dislikeWidth = `${(tagRow.dislikes / total) * 100}%`;

              return (
                <View key={tagRow.tag} style={styles.analyticsRow}>
                  <View style={styles.analyticsHeader}>
                    <Text style={styles.analyticsTag}>{tagRow.tag}</Text>
                    <Text style={styles.analyticsScore}>Score {tagRow.score}</Text>
                  </View>
                  <View style={styles.analyticsBarTrack}>
                    <View style={[styles.analyticsBarLike, { width: likeWidth }]} />
                    <View style={[styles.analyticsBarDislike, { width: dislikeWidth }]} />
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderRankingTab = () => (
    <ScrollView contentContainerStyle={styles.resultsContent}>
      <Text style={styles.resultsTitle}>Store ranking</Text>
      {rankedDresses.map((entry, index) => {
        const image = getPreviewImage(entry.dress);
        const decision = dressDecisions[entry.dress.id];

        return (
          <View key={entry.dress.id} style={styles.rankingCard}>
            {image ? <Image source={{ uri: image }} style={styles.rankingImage} /> : <View style={styles.rankingImage} />}
            <View style={styles.rankingBody}>
              <Text style={styles.rankingName}>
                #{index + 1} {entry.dress.name || 'Untitled dress'}
              </Text>
              <Text style={styles.rankingScore}>Score: {entry.score}</Text>
              {decision ? <Text style={styles.decisionPill}>Session action: {decision}</Text> : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {sessionStage === 'landing' && renderLanding()}
      {sessionStage === 'swiping' && renderSwiping()}
      {sessionStage === 'results' && (
        <View style={styles.resultsStage}>
          <View style={styles.tabsRow}>
            <Pressable style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]} onPress={() => setActiveTab('analytics')}>
              <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>Analytics</Text>
            </Pressable>
            <Pressable style={[styles.tabButton, activeTab === 'ranking' && styles.tabButtonActive]} onPress={() => setActiveTab('ranking')}>
              <Text style={[styles.tabText, activeTab === 'ranking' && styles.tabTextActive]}>Dress Fit</Text>
            </Pressable>
          </View>
          {activeTab === 'analytics' ? renderAnalyticsTab() : renderRankingTab()}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setSessionStage('landing');
              setSwipeIndex(0);
              setSessionQueue([]);
            }}
          >
            <Text style={styles.secondaryButtonText}>Start New Session</Text>
          </Pressable>
        </View>
      )}

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
    </SafeAreaView>
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
  secondaryButton: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#d1cbe4',
    borderRadius: 20,
    paddingVertical: 11,
    alignItems: 'center'
  },
  secondaryButtonText: { color: '#5b536f', fontWeight: '700' },
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
  },
  swipeStage: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  sessionName: { textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#37304a' },
  sessionCounter: { textAlign: 'center', color: '#7a728f', marginTop: 4 },
  deckArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  swipeCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd8ec',
    overflow: 'hidden'
  },
  swipeImage: { width: '100%', aspectRatio: 0.72, backgroundColor: '#e6e2f3' },
  cardBody: { padding: 14, gap: 6 },
  cardName: { fontSize: 18, fontWeight: '700', color: '#37304a' },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  controlButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectButton: { backgroundColor: '#ffe8ec' },
  superButton: { backgroundColor: '#e5ecff' },
  likeButton: { backgroundColor: '#e5f6ee' },
  controlText: { fontSize: 26, color: '#4a415f', fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#39324d' },
  resultsStage: { flex: 1 },
  tabsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, backgroundColor: '#e9e5f2', borderRadius: 14, padding: 3 },
  tabButton: { flex: 1, borderRadius: 11, paddingVertical: 8, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#fff' },
  tabText: { color: '#645d79', fontWeight: '600' },
  tabTextActive: { color: '#332c47' },
  resultsContent: { paddingHorizontal: 20, paddingVertical: 14, gap: 12, paddingBottom: 30 },
  resultsTitle: { fontSize: 21, fontWeight: '700', color: '#342d49' },
  resultsSubtitle: { color: '#7c748f' },
  analyticsCategorySection: { gap: 8 },
  analyticsCategoryTitle: { color: '#3d3652', fontWeight: '700' },
  analyticsRow: { gap: 6 },
  analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  analyticsTag: { color: '#443d5c', fontWeight: '600' },
  analyticsScore: { color: '#6c6482', fontWeight: '600' },
  analyticsBarTrack: { flexDirection: 'row', height: 10, width: '100%', borderRadius: 5, overflow: 'hidden', backgroundColor: '#ebe7f5' },
  analyticsBarLike: { backgroundColor: '#92c9b8', height: '100%' },
  analyticsBarDislike: { backgroundColor: '#e8a0a4', height: '100%' },
  rankingCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e0daee',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 10
  },
  rankingImage: { width: 72, height: 96, borderRadius: 8, backgroundColor: '#e5e1f1' },
  rankingBody: { flex: 1, gap: 4 },
  rankingName: { color: '#322b46', fontWeight: '700' },
  rankingScore: { color: '#554d6a', fontWeight: '600' },
  decisionPill: { color: '#4c4463', fontSize: 12, fontWeight: '600' }
});
