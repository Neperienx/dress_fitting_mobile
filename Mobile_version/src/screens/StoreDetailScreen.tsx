import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { StoresStackParamList } from '../navigation/AppNavigator';
import { SavedSession, loadSessionHistory } from '../utils/sessionHistory';

const englishTagCatalog = require('../data/dress-tags.en.json') as {
  categories?: Array<{ name: string; tags: string[] }>;
};

type Props = NativeStackScreenProps<StoresStackParamList, 'StoreDetail'>;

type MenuSection = {
  key: 'sessions' | 'inventory' | 'insights';
  title: string;
  subtitle: string;
};

type InsightsTab = 'overview' | 'analytics';

const sections: MenuSection[] = [
  {
    key: 'sessions',
    title: 'Recent Sessions',
    subtitle: 'Open a quick preview'
  },
  {
    key: 'inventory',
    title: 'Inventory',
    subtitle: 'Manage dress profiles'
  },
  {
    key: 'insights',
    title: 'Insights',
    subtitle: 'Top silhouettes: A-line, Ball Gowns'
  }
];

export default function StoreDetailScreen({ navigation, route }: Props) {
  const { storeId, storeName, storeCity } = route.params;
  const [searchValue, setSearchValue] = useState('');
  const [activeOverlay, setActiveOverlay] = useState<MenuSection | null>(null);
  const [recentSessions, setRecentSessions] = useState<SavedSession[]>([]);
  const [insightsTab, setInsightsTab] = useState<InsightsTab>('overview');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void (async () => {
        const sessions = await loadSessionHistory(storeId);
        setRecentSessions(sessions);
      })();
    });

    return unsubscribe;
  }, [navigation, storeId]);

  const sessionSubtitle = useMemo(() => {
    if (recentSessions.length === 0) {
      return 'No recent sessions yet';
    }

    return `${recentSessions.length} recent session${recentSessions.length > 1 ? 's' : ''}`;
  }, [recentSessions.length]);

  const renderedSections = useMemo(
    () =>
      sections.map((section) =>
        section.key === 'sessions'
          ? {
              ...section,
              subtitle: sessionSubtitle
            }
          : section
      ),
    [sessionSubtitle]
  );

  const handleSectionPress = (section: MenuSection) => {
    if (section.key === 'sessions') {
      navigation.navigate('StoreRecentSessions', { storeId, storeName });
      return;
    }

    if (section.key === 'inventory') {
      navigation.navigate('Inventory', { storeId, storeName });
      return;
    }

    if (section.key === 'insights') {
      setInsightsTab('overview');
    }
    setActiveOverlay(section);
  };

  const overallTagRows = useMemo(
    () =>
      Object.entries(
        recentSessions.reduce<Record<string, { likes: number; dislikes: number; score: number }>>((summary, session) => {
          Object.entries(session.tagScores ?? {}).forEach(([tag, stats]) => {
            const previous = summary[tag] ?? { likes: 0, dislikes: 0, score: 0 };
            summary[tag] = {
              likes: previous.likes + (stats.likes ?? 0),
              dislikes: previous.dislikes + (stats.dislikes ?? 0),
              score: previous.score + (stats.score ?? 0)
            };
          });
          return summary;
        }, {})
      )
        .map(([tag, stats]) => ({ tag, ...stats }))
        .sort((a, b) => b.score - a.score),
    [recentSessions]
  );

  const bestDress = useMemo(() => {
    const scoreByDress = recentSessions.reduce<Record<string, number>>((scores, session) => {
      Object.entries(session.dressDecisions ?? {}).forEach(([dressId, decision]) => {
        const weight = decision === 'superlike' ? 2 : decision === 'like' ? 1 : -1;
        scores[dressId] = (scores[dressId] ?? 0) + weight;
      });
      return scores;
    }, {});

    let best: { id: string; score: number; name: string | null; tags: string[] } | null = null;

    recentSessions.forEach((session) => {
      session.allStoreDresses?.forEach((dress) => {
        const score = scoreByDress[dress.id];
        if (typeof score !== 'number') {
          return;
        }

        if (!best || score > best.score) {
          best = { id: dress.id, score, name: dress.name, tags: dress.tags };
        }
      });
    });

    return best;
  }, [recentSessions]);

  const accessoryInsights = useMemo(() => {
    const accessoryTags = new Set(
      (englishTagCatalog.categories ?? []).find((category) => category.name === 'Accessories')?.tags ?? []
    );

    const pairings = new Map<string, Map<string, number>>();

    recentSessions.forEach((session) => {
      const queueById = new Map(session.sessionQueue.map((dress) => [dress.id, dress]));

      Object.entries(session.dressDecisions ?? {}).forEach(([dressId, decision]) => {
        if (decision === 'dislike') {
          return;
        }

        const dress = queueById.get(dressId);
        if (!dress) {
          return;
        }

        const accessories = dress.tags.filter((tag) => accessoryTags.has(tag));
        const nonAccessories = dress.tags.filter((tag) => !accessoryTags.has(tag));

        if (accessories.length === 0 || nonAccessories.length === 0) {
          return;
        }

        nonAccessories.forEach((tag) => {
          const stats = pairings.get(tag) ?? new Map<string, number>();
          accessories.forEach((accessory) => {
            stats.set(accessory, (stats.get(accessory) ?? 0) + 1);
          });
          pairings.set(tag, stats);
        });
      });
    });

    return Array.from(pairings.entries())
      .map(([tag, stats]) => {
        const [accessory = '', count = 0] = Array.from(stats.entries()).sort((a, b) => b[1] - a[1])[0] ?? [];
        return {
          tag,
          accessory,
          count
        };
      })
      .filter((entry) => entry.accessory)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [recentSessions]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.storeName}>{storeName}</Text>
        <Text style={styles.storeCity}>{storeCity || 'Location not set'}</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          value={searchValue}
          onChangeText={setSearchValue}
          autoCapitalize="none"
        />

        <View style={styles.sectionList}>
          {renderedSections.map((section) => (
            <Pressable key={section.key} style={styles.sectionCard} onPress={() => handleSectionPress(section)}>
              <View style={styles.sectionTextWrap}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent visible={activeOverlay !== null} onRequestClose={() => setActiveOverlay(null)}>
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>{activeOverlay?.title}</Text>
            {activeOverlay?.key === 'insights' ? (
                  <>
                    <View style={styles.insightsTabs}>
                      <Pressable style={[styles.insightsTabButton, insightsTab === 'overview' && styles.insightsTabButtonActive]} onPress={() => setInsightsTab('overview')}>
                        <Text style={[styles.insightsTabText, insightsTab === 'overview' && styles.insightsTabTextActive]}>Overview</Text>
                      </Pressable>
                      <Pressable style={[styles.insightsTabButton, insightsTab === 'analytics' && styles.insightsTabButtonActive]} onPress={() => setInsightsTab('analytics')}>
                        <Text style={[styles.insightsTabText, insightsTab === 'analytics' && styles.insightsTabTextActive]}>Overall Analytics</Text>
                      </Pressable>
                    </View>

                    {recentSessions.length === 0 ? (
                      <Text style={styles.overlayBody}>No completed sessions yet. Finish at least one session to unlock insights.</Text>
                    ) : insightsTab === 'overview' ? (
                      <View style={styles.insightsSectionWrap}>
                        <View style={styles.insightCard}>
                          <Text style={styles.insightTitle}>Best fitting dress in store</Text>
                          {bestDress ? (
                            <>
                              <Text style={styles.insightValue}>{bestDress.name || 'Untitled dress'}</Text>
                              <Text style={styles.insightMeta}>Overall fit score: {bestDress.score}</Text>
                              <Text style={styles.insightMeta}>Top tags: {bestDress.tags.slice(0, 3).join(', ') || 'No tags'}</Text>
                            </>
                          ) : (
                            <Text style={styles.overlayBody}>Not enough swipe decisions yet to rank dresses.</Text>
                          )}
                        </View>

                        <View style={styles.insightCard}>
                          <Text style={styles.insightTitle}>Accessory pairings</Text>
                          {accessoryInsights.length === 0 ? (
                            <Text style={styles.overlayBody}>No accessory pairings found yet.</Text>
                          ) : (
                            accessoryInsights.map((entry) => (
                              <Text key={`${entry.tag}-${entry.accessory}`} style={styles.insightMeta}>
                                {entry.tag} → {entry.accessory} ({entry.count} sessions)
                              </Text>
                            ))
                          )}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.insightsSectionWrap}>
                        {overallTagRows.length === 0 ? (
                          <Text style={styles.overlayBody}>No tag interactions found for this store yet.</Text>
                        ) : (
                          overallTagRows.map((row) => (
                            <View key={row.tag} style={styles.analyticsRow}>
                              <View style={styles.analyticsHeader}>
                                <Text style={styles.analyticsTag}>{row.tag}</Text>
                                <Text style={styles.analyticsScore}>Score {row.score}</Text>
                              </View>
                              <View style={styles.analyticsBarTrack}>
                                <View style={[styles.analyticsBarLike, { flex: row.likes || 0 }]} />
                                <View style={[styles.analyticsBarDislike, { flex: row.dislikes || 0 }]} />
                              </View>
                              <Text style={styles.insightMeta}>
                                {row.likes} likes • {row.dislikes} dislikes
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    )}

                    <Pressable style={styles.closeButton} onPress={() => setActiveOverlay(null)}>
                      <Text style={styles.closeButtonText}>Close</Text>
                    </Pressable>
                  </>
                ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5EFF3' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, gap: 16 },
  storeName: { fontSize: 28, fontWeight: '700', color: '#433A3F' },
  storeCity: { color: '#8B7E83', marginTop: -4 },
  searchInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E6D9DF',
    backgroundColor: '#FEFAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#433A3F'
  },
  sectionList: { marginTop: 8, gap: 14 },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#E6D9DF',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#2D1F26',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  sectionTextWrap: { flex: 1, paddingRight: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#433A3F' },
  sectionSubtitle: { marginTop: 4, color: '#958A90' },
  chevron: { fontSize: 28, lineHeight: 28, color: '#A4959B' },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(33, 22, 29, 0.22)',
    justifyContent: 'flex-end'
  },
  overlayCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    gap: 12
  },
  overlayTitle: { fontSize: 20, fontWeight: '700', color: '#433A3F' },
  overlayBody: { color: '#857980', lineHeight: 20 },
  insightsTabs: { flexDirection: 'row', borderRadius: 11, backgroundColor: '#F3DCE3', padding: 3, gap: 4 },
  insightsTabButton: { flex: 1, borderRadius: 8, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  insightsTabButtonActive: { backgroundColor: '#FFFCFD' },
  insightsTabText: { fontWeight: '600', color: '#8B7E83', fontSize: 12 },
  insightsTabTextActive: { color: '#5A4E53' },
  insightsSectionWrap: { gap: 10 },
  insightCard: { borderWidth: 1, borderColor: '#F0E6EA', borderRadius: 12, padding: 12, gap: 5 },
  insightTitle: { fontWeight: '700', color: '#433A3F' },
  insightValue: { fontSize: 16, fontWeight: '700', color: '#433A3F' },
  insightMeta: { color: '#94888F', fontSize: 12 },
  analyticsRow: { gap: 5 },
  analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  analyticsTag: { color: '#64585D', fontWeight: '600' },
  analyticsScore: { color: '#8B7E83', fontWeight: '600' },
  analyticsBarTrack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#F2E8EC' },
  analyticsBarLike: { backgroundColor: '#2EAF64' },
  analyticsBarDislike: { backgroundColor: '#D94D4D' },
  closeButton: {
    marginTop: 6,
    alignSelf: 'flex-end',
    backgroundColor: '#D59AA9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  closeButtonText: { color: '#FFFCFD', fontWeight: '700' }
});
