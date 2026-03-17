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
import { useNavigation, useRoute } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { 
  SavedSession,
  SessionDress,
  SessionPreviewDress,
  SwipeDecision,
  TagSummary,
  loadSessionHistory,
  prependSessionHistory
} from '../utils/sessionHistory';
import { syncInventoryForStore } from '../utils/inventoryCache';

const englishTagCatalog = require('../data/dress-tags.en.json') as {
  categories?: Array<{ name: string; tags: string[] }>;
};

type SessionStage = 'landing' | 'swiping' | 'results';
type ResultsTab = 'analytics' | 'ranking';
type LandingTab = 'start' | 'recent';
type AppTabsParamList = {
  Home: undefined;
  Session: {
    open?: 'recent';
    sessionId?: string;
    resetToStart?: boolean;
  } | undefined;
  Stores: undefined;
  Alerts: undefined;
};

function getTagStorageKey(dressId: string) {
  return `dress-tags:${dressId}`;
}

function getDressImages(dress: SessionPreviewDress | SessionDress) {
  return [...(dress.dress_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

function getPreviewImage(dress: SessionPreviewDress | SessionDress) {
  return getDressImages(dress)[0]?.image_url ?? null;
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

function formatSessionDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function SessionScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabsParamList>>();
  const route = useRoute<{ params?: { open?: 'recent'; sessionId?: string; resetToStart?: boolean } }>();
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
  const [landingTab, setLandingTab] = useState<LandingTab>('start');
  const [recentSessions, setRecentSessions] = useState<SavedSession[]>([]);
  const [selectedHistorySession, setSelectedHistorySession] = useState<SavedSession | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [activeDressPhotoIndices, setActiveDressPhotoIndices] = useState<Record<string, number>>({});
  const [selectedResultDressId, setSelectedResultDressId] = useState<string | null>(null);
  const [shortlistDressIds, setShortlistDressIds] = useState<string[]>([]);
  const [showShortlistOnly, setShowShortlistOnly] = useState(false);

  const swipePosition = useRef(new Animated.ValueXY()).current;

  const loadInventoryDresses = useCallback(async () => {
    if (!selectedStore?.id || !session?.user.id) {
      setAllStoreDresses([]);
      setLoadingPreview(false);
      return;
    }

    setLoadingPreview(true);
    try {
      const dresses = (await syncInventoryForStore({ storeId: selectedStore.id })) as SessionPreviewDress[];
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

  const loadRecentSessions = useCallback(async () => {
    if (!selectedStore?.id) {
      setRecentSessions([]);
      return;
    }

    const sessions = await loadSessionHistory(selectedStore.id);
    setRecentSessions(sessions);
  }, [selectedStore?.id]);

  useEffect(() => {
    void loadRecentSessions();
  }, [loadRecentSessions]);

  useEffect(() => {
    const params = route.params;

    if (params?.resetToStart) {
      setSessionStage('landing');
      setLandingTab('start');
      setSelectedHistorySession(null);
      setActiveTab('analytics');
      navigation.setParams({ resetToStart: undefined });
      return;
    }

    if (!params?.open || params.open !== 'recent') {
      return;
    }

    setLandingTab('recent');
    if (params.sessionId) {
      const hit = recentSessions.find((entry) => entry.id === params.sessionId);
      if (hit) {
        setSelectedHistorySession(hit);
        setShortlistDressIds(hit.shortlistDressIds ?? []);
        setShowShortlistOnly(false);
        setSessionStage('results');
        setActiveTab('analytics');
      }
    }

    navigation.setParams({ open: undefined, sessionId: undefined });
  }, [navigation, recentSessions, route]);

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
    setSelectedHistorySession(null);
    setSessionSaved(false);
    setActiveDressPhotoIndices({});
    setSelectedResultDressId(null);
    setShortlistDressIds([]);
    setShowShortlistOnly(false);
    setLandingTab('start');
    setActiveTab('analytics');
    setShowSessionForm(false);
    setSessionStage('swiping');
  };

  useEffect(() => {
    if (sessionStage !== 'results' || sessionSaved || !selectedStore?.id || selectedHistorySession) {
      return;
    }

    const record: SavedSession = {
      id: `${Date.now()}`,
      storeId: selectedStore.id,
      brideName: brideName.trim() || 'Session',
      endedAt: new Date().toISOString(),
      sessionQueue,
      allStoreDresses,
      tagScores,
      dressDecisions,
      shortlistDressIds
    };

    void (async () => {
      await prependSessionHistory(selectedStore.id, record);
      setSessionSaved(true);
      await loadRecentSessions();
    })();
  }, [
    allStoreDresses,
    brideName,
    dressDecisions,
    loadRecentSessions,
    selectedHistorySession,
    selectedStore?.id,
    sessionQueue,
    sessionSaved,
    sessionStage,
    shortlistDressIds,
    tagScores
  ]);

  const activeSessionData = selectedHistorySession
    ? {
        brideName: selectedHistorySession.brideName,
        sessionQueue: selectedHistorySession.sessionQueue,
        allStoreDresses: selectedHistorySession.allStoreDresses,
        tagScores: selectedHistorySession.tagScores,
        dressDecisions: selectedHistorySession.dressDecisions,
        shortlistDressIds
      }
    : {
        brideName,
        sessionQueue,
        allStoreDresses,
        tagScores,
        dressDecisions,
        shortlistDressIds
      };

  const rankedDresses = useMemo(() => {
    return [...activeSessionData.allStoreDresses]
      .map((dress) => ({
        dress,
        score: dress.tags.reduce((total, tag) => total + (activeSessionData.tagScores[tag]?.score ?? 0), 0)
      }))
      .sort((a, b) => b.score - a.score);
  }, [activeSessionData.allStoreDresses, activeSessionData.tagScores]);

  const rankedTags = useMemo(
    () =>
      Object.entries(activeSessionData.tagScores)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([tag, stats]) => ({ tag, ...stats })),
    [activeSessionData.tagScores]
  );

  const resultDressById = useMemo(() => {
    return new Map(activeSessionData.allStoreDresses.map((dress) => [dress.id, dress]));
  }, [activeSessionData.allStoreDresses]);

  const selectedResultDress = selectedResultDressId ? resultDressById.get(selectedResultDressId) ?? null : null;

  const setDressPhotoIndex = useCallback((dressId: string, index: number) => {
    setActiveDressPhotoIndices((previous) => ({ ...previous, [dressId]: index }));
  }, []);

  const changeDressPhoto = useCallback(
    (dressId: string, direction: 1 | -1, dressList?: SessionDress[]) => {
      const sourceList = dressList ?? activeSessionData.allStoreDresses;
      const dress = sourceList.find((entry) => entry.id === dressId);
      if (!dress) {
        return;
      }

      const images = getDressImages(dress);
      if (images.length <= 1) {
        return;
      }

      const currentIndex = activeDressPhotoIndices[dressId] ?? 0;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= images.length) {
        return;
      }

      setDressPhotoIndex(dressId, nextIndex);
    },
    [activeSessionData.allStoreDresses, activeDressPhotoIndices, setDressPhotoIndex]
  );

  const toggleShortlist = useCallback((dressId: string) => {
    setShortlistDressIds((previous) =>
      previous.includes(dressId) ? previous.filter((id) => id !== dressId) : [...previous, dressId]
    );
  }, []);

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
      <View style={styles.landingTabs}>
        <Pressable style={[styles.landingTabButton, landingTab === 'start' && styles.landingTabButtonActive]} onPress={() => setLandingTab('start')}>
          <Text style={[styles.landingTabText, landingTab === 'start' && styles.landingTabTextActive]}>Start Session</Text>
        </Pressable>
        <Pressable style={[styles.landingTabButton, landingTab === 'recent' && styles.landingTabButtonActive]} onPress={() => setLandingTab('recent')}>
          <Text style={[styles.landingTabText, landingTab === 'recent' && styles.landingTabTextActive]}>Recent Sessions</Text>
        </Pressable>
      </View>

      {landingTab === 'start' ? (
        <>
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
        </>
      ) : (
        <View style={styles.recentListWrap}>
          {recentSessions.length === 0 ? (
            <View style={styles.recentEmptyCard}>
              <Text style={styles.placeholderText}>No recent sessions</Text>
              <Text style={styles.placeholderHint}>Completed sessions will appear here with each bride's name.</Text>
            </View>
          ) : (
            recentSessions.map((entry) => (
              <Pressable
                key={entry.id}
                style={styles.recentSessionRow}
                onPress={() => {
                  setSelectedHistorySession(entry);
                  setShortlistDressIds(entry.shortlistDressIds ?? []);
                  setShowShortlistOnly(false);
                  setActiveTab('analytics');
                  setSessionStage('results');
                }}
              >
                <View>
                  <Text style={styles.recentSessionName}>{entry.brideName}</Text>
                  <Text style={styles.recentSessionMeta}>{formatSessionDate(entry.endedAt)}</Text>
                </View>
                <Text style={styles.recentSessionArrow}>›</Text>
              </Pressable>
            ))
          )}
        </View>
      )}
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

    const dressImages = getDressImages(currentDress);
    const imageCount = dressImages.length;
    const currentIndex = activeDressPhotoIndices[currentDress.id] ?? 0;
    const image = dressImages[currentIndex]?.image_url ?? null;

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
            {imageCount > 0 ? (
              <View pointerEvents="none" style={styles.photoIndicatorRow}>
                {dressImages.map((_, index) => (
                  <View
                    key={`${currentDress.id}-dot-${index}`}
                    style={[styles.photoIndicatorDot, index === currentIndex && styles.photoIndicatorDotActive]}
                  />
                ))}
              </View>
            ) : null}
            {imageCount > 1 ? (
              <View style={styles.photoNavOverlay}>
                <Pressable style={styles.photoNavZone} onPress={() => changeDressPhoto(currentDress.id, -1, sessionQueue)} />
                <Pressable style={styles.photoNavZone} onPress={() => changeDressPhoto(currentDress.id, 1, sessionQueue)} />
              </View>
            ) : null}
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{currentDress.name || 'Untitled dress'}</Text>
            </View>
          </Animated.View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable style={[styles.controlButton, styles.rejectButton]} onPress={() => animateSwipeOut('dislike')}>
            <Text style={[styles.controlText, styles.rejectText]}>✕</Text>
          </Pressable>
          <Pressable style={[styles.controlButton, styles.superButton]} onPress={() => animateSwipeOut('superlike')}>
            <Text style={[styles.controlText, styles.superText]}>★</Text>
          </Pressable>
          <Pressable style={[styles.controlButton, styles.likeButton]} onPress={() => animateSwipeOut('like')}>
            <Text style={[styles.controlText, styles.likeText]}>♥</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderAnalyticsTab = () => (
    <ScrollView contentContainerStyle={styles.resultsContent}>
      <Text style={styles.resultsTitle}>{activeSessionData.brideName.trim() || 'Session'} analytics</Text>
      <Text style={styles.resultsSubtitle}>
        {Object.keys(activeSessionData.dressDecisions).length} swiped / {activeSessionData.sessionQueue.length} chosen dresses
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

  const renderRankingTab = () => {
    const dressesToShow = showShortlistOnly
      ? rankedDresses.filter((entry) => activeSessionData.shortlistDressIds.includes(entry.dress.id))
      : rankedDresses;

    return (
      <ScrollView contentContainerStyle={styles.resultsContent}>
        <Text style={styles.resultsTitle}>{showShortlistOnly ? 'Shortlisted dresses' : 'Store ranking'}</Text>
        {dressesToShow.length === 0 ? (
          <Text style={styles.placeholderHint}>No dresses yet. Tap ☆ on a dress to build a shortlist.</Text>
        ) : (
          dressesToShow.map((entry, index) => {
            const dressImages = getDressImages(entry.dress);
            const imageIndex = activeDressPhotoIndices[entry.dress.id] ?? 0;
            const image = dressImages[imageIndex]?.image_url ?? null;
            const decision = activeSessionData.dressDecisions[entry.dress.id];
            const isShortlisted = activeSessionData.shortlistDressIds.includes(entry.dress.id);

            return (
              <Pressable key={entry.dress.id} style={styles.rankingCard} onPress={() => setSelectedResultDressId(entry.dress.id)}>
                {image ? <Image source={{ uri: image }} style={styles.rankingImage} /> : <View style={styles.rankingImage} />}
                <View style={styles.rankingBody}>
                  <View style={styles.rankingHeader}>
                    <Text style={styles.rankingName}>
                      #{index + 1} {entry.dress.name || 'Untitled dress'}
                    </Text>
                    <Pressable
                      hitSlop={10}
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleShortlist(entry.dress.id);
                      }}
                    >
                      <Text style={[styles.shortlistStar, isShortlisted && styles.shortlistStarActive]}>★</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.rankingScore}>Score: {entry.score}</Text>
                  <Text style={styles.rankingHint}>Tap card to view and browse photos</Text>
                  {decision ? <Text style={styles.decisionPill}>Session action: {decision}</Text> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    );
  };


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
              if (activeTab === 'ranking') {
                setShowShortlistOnly((previous) => !previous);
                return;
              }

              setSessionStage('landing');
              setSwipeIndex(0);
              setSessionQueue([]);
              setSelectedHistorySession(null);
              setSelectedResultDressId(null);
              setShowShortlistOnly(false);
              setLandingTab('recent');
            }}
          >
            <Text style={styles.secondaryButtonText}>
              {activeTab === 'ranking'
                ? showShortlistOnly
                  ? 'Show all dresses'
                  : 'Go to shortlist'
                : selectedHistorySession
                  ? 'Back to Recent Sessions'
                  : 'Start New Session'}
            </Text>
          </Pressable>
        </View>
      )}

      <Modal
        transparent
        visible={Boolean(selectedResultDress)}
        animationType="fade"
        onRequestClose={() => setSelectedResultDressId(null)}
      >
        <View style={styles.profileModalBackdrop}>
          <Pressable style={styles.dismissArea} onPress={() => setSelectedResultDressId(null)} />
          {selectedResultDress ? (
            <View style={styles.profileModalCard}>
              {(() => {
                const dressImages = getDressImages(selectedResultDress);
                const currentIndex = activeDressPhotoIndices[selectedResultDress.id] ?? 0;
                const image = dressImages[currentIndex]?.image_url ?? null;
                const isShortlisted = activeSessionData.shortlistDressIds.includes(selectedResultDress.id);
                return (
                  <>
                    <View style={styles.profileModalImageWrap}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.profileModalImage} resizeMode="cover" />
                      ) : (
                        <View style={[styles.profileModalImage, styles.placeholderCard]}>
                          <Text style={styles.placeholderText}>No photo</Text>
                        </View>
                      )}
                      {dressImages.length > 0 ? (
                        <View pointerEvents="none" style={styles.photoIndicatorRow}>
                          {dressImages.map((_, index) => (
                            <View
                              key={`${selectedResultDress.id}-profile-dot-${index}`}
                              style={[styles.photoIndicatorDot, index === currentIndex && styles.photoIndicatorDotActive]}
                            />
                          ))}
                        </View>
                      ) : null}
                      {dressImages.length > 1 ? (
                        <View style={styles.photoNavOverlay}>
                          <Pressable style={styles.photoNavZone} onPress={() => changeDressPhoto(selectedResultDress.id, -1)} />
                          <Pressable style={styles.photoNavZone} onPress={() => changeDressPhoto(selectedResultDress.id, 1)} />
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.profileModalBody}>
                      <View style={styles.rankingHeader}>
                        <Text style={styles.resultsTitle}>{selectedResultDress.name || 'Untitled dress'}</Text>
                        <Pressable onPress={() => toggleShortlist(selectedResultDress.id)}><Text style={[styles.shortlistStar, isShortlisted && styles.shortlistStarActive]}>★</Text></Pressable>
                      </View>
                      <Text style={styles.rankingHint}>Tap left/right side of image to navigate photos.</Text>
                    </View>
                  </>
                );
              })()}
            </View>
          ) : null}
        </View>
      </Modal>

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
  screen: { flex: 1, backgroundColor: '#FEFAFC' },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 14
  },
  landingTabs: { flexDirection: 'row', backgroundColor: '#F3DCE3', borderRadius: 14, padding: 3, width: '100%' },
  landingTabButton: { flex: 1, borderRadius: 11, paddingVertical: 8, alignItems: 'center' },
  landingTabButtonActive: { backgroundColor: '#FFFFFF' },
  landingTabText: { color: '#8B7E83', fontWeight: '600' },
  landingTabTextActive: { color: '#433A3F' },
  title: { fontSize: 29, fontWeight: '700', color: '#433A3F' },
  subtitle: { color: '#94888F', fontSize: 15 },
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
    borderColor: '#EADDE2',
    backgroundColor: '#F3DCE3'
  },
  placeholderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 8
  },
  placeholderText: {
    color: '#8B7E83',
    fontWeight: '600',
    textAlign: 'center'
  },
  placeholderHint: {
    color: '#8B7E83',
    textAlign: 'center',
    fontSize: 12
  },
  recentListWrap: { width: '100%', gap: 10, marginTop: 4 },
  recentEmptyCard: {
    borderWidth: 1,
    borderColor: '#ECE2E6',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 6
  },
  recentSessionRow: {
    borderWidth: 1,
    borderColor: '#EDE4E8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  recentSessionName: { color: '#433A3F', fontWeight: '700', fontSize: 16 },
  recentSessionMeta: { color: '#8B7E83', marginTop: 3, fontSize: 12 },
  recentSessionArrow: { fontSize: 26, color: '#B8ABAF' },
  primaryButton: {
    marginTop: 8,
    width: '100%',
    maxWidth: 260,
    backgroundColor: '#DEA9B6',
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16
  },
  secondaryButton: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EFE5E9',
    borderRadius: 20,
    paddingVertical: 11,
    alignItems: 'center'
  },
  secondaryButtonText: { color: '#8B7E83', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(33, 22, 29, 0.24)',
    justifyContent: 'flex-end'
  },
  dismissArea: { flex: 1 },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 10
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#433A3F' },
  modalSubtitle: { color: '#8B7E83', marginBottom: 6 },
  fieldLabel: { color: '#8B7E83', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#EFE5E9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#433A3F'
  },
  swipeStage: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  sessionName: { textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#433A3F' },
  sessionCounter: { textAlign: 'center', color: '#9B8E94', marginTop: 4 },
  deckArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  swipeCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE5E9',
    overflow: 'hidden'
  },
  swipeImage: { width: '100%', aspectRatio: 0.72, backgroundColor: '#F7EBDD' },
  photoIndicatorRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4
  },
  photoIndicatorDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)'
  },
  photoIndicatorDotActive: { backgroundColor: '#FFFFFF' },
  photoNavOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row'
  },
  photoNavZone: { flex: 1 },
  cardBody: { padding: 14, gap: 6 },
  cardName: { fontSize: 18, fontWeight: '700', color: '#433A3F' },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  controlButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectButton: { backgroundColor: '#EADDE8' },
  superButton: { backgroundColor: '#F7EBDD' },
  likeButton: { backgroundColor: '#F5D8DF' },
  controlText: { fontSize: 26, color: '#6A5C63', fontWeight: '700' },
  rejectText: { color: '#6A5C73' },
  superText: { color: '#C39A60' },
  likeText: { color: '#D67582' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#433A3F' },
  resultsStage: { flex: 1 },
  tabsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, backgroundColor: '#F3DCE3', borderRadius: 14, padding: 3 },
  tabButton: { flex: 1, borderRadius: 11, paddingVertical: 8, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#FFFFFF' },
  tabText: { color: '#8B7E83', fontWeight: '600' },
  tabTextActive: { color: '#433A3F' },
  resultsContent: { paddingHorizontal: 20, paddingVertical: 14, gap: 12, paddingBottom: 30 },
  resultsTitle: { fontSize: 21, fontWeight: '700', color: '#433A3F' },
  resultsSubtitle: { color: '#8B7E83' },
  analyticsCategorySection: { gap: 8 },
  analyticsCategoryTitle: { color: '#5A4E53', fontWeight: '700' },
  analyticsRow: { gap: 6 },
  analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  analyticsTag: { color: '#65585E', fontWeight: '600' },
  analyticsScore: { color: '#8B7E83', fontWeight: '600' },
  analyticsBarTrack: { flexDirection: 'row', height: 10, width: '100%', borderRadius: 5, overflow: 'hidden', backgroundColor: '#F3DCE3' },
  analyticsBarLike: { backgroundColor: '#2EAF64', height: '100%' },
  analyticsBarDislike: { backgroundColor: '#D94D4D', height: '100%' },
  rankingCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#ECE2E7',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10
  },
  rankingImage: { width: 72, height: 96, borderRadius: 8, backgroundColor: '#F1E8EB' },
  rankingBody: { flex: 1, gap: 4 },
  rankingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  rankingName: { color: '#54484E', fontWeight: '700' },
  rankingScore: { color: '#807278', fontWeight: '600' },
  rankingHint: { color: '#9C8F95', fontSize: 12 },
  shortlistStar: { color: '#CBBFC4', fontSize: 24, lineHeight: 24 },
  shortlistStarActive: { color: '#E6B94A' },
  decisionPill: { color: '#766971', fontSize: 12, fontWeight: '600' },
  profileModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 16, 0.52)',
    justifyContent: 'flex-end'
  },
  profileModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden'
  },
  profileModalImageWrap: { width: '100%', aspectRatio: 0.72, backgroundColor: '#F1E8EB' },
  profileModalImage: { width: '100%', height: '100%' },
  profileModalBody: { padding: 16, gap: 6 }
});
