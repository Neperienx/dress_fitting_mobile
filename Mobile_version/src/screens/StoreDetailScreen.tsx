import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { StoresStackParamList } from '../navigation/AppNavigator';
import { SavedSession, loadSessionHistory } from '../utils/sessionHistory';

type Props = NativeStackScreenProps<StoresStackParamList, 'StoreDetail'>;

type MenuSection = {
  key: 'sessions' | 'inventory' | 'insights';
  title: string;
  subtitle: string;
};

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

function formatSessionDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function StoreDetailScreen({ navigation, route }: Props) {
  const { storeId, storeName, storeCity } = route.params;
  const [searchValue, setSearchValue] = useState('');
  const [activeOverlay, setActiveOverlay] = useState<MenuSection | null>(null);
  const [recentSessions, setRecentSessions] = useState<SavedSession[]>([]);

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

  const navigateToRecentSessions = (sessionId?: string) => {
    setActiveOverlay(null);
    navigation.getParent()?.navigate('Session', { open: 'recent', sessionId });
  };

  const handleSectionPress = (section: MenuSection) => {
    if (section.key === 'inventory') {
      navigation.navigate('Inventory', { storeId, storeName });
      return;
    }

    setActiveOverlay(section);
  };

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
            {activeOverlay?.key === 'sessions' ? (
              <>
                {recentSessions.length === 0 ? (
                  <Text style={styles.overlayBody}>No sessions yet. Start a session and it will appear here.</Text>
                ) : (
                  <View style={styles.overlayListWrap}>
                    {recentSessions.slice(0, 4).map((session) => (
                      <Pressable key={session.id} style={styles.overlaySessionRow} onPress={() => navigateToRecentSessions(session.id)}>
                        <View>
                          <Text style={styles.overlaySessionName}>{session.brideName || 'Untitled session'}</Text>
                          <Text style={styles.overlaySessionMeta}>{formatSessionDate(session.endedAt)}</Text>
                        </View>
                        <Text style={styles.overlaySessionArrow}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <Pressable style={styles.primaryAction} onPress={() => navigateToRecentSessions()}>
                  <Text style={styles.primaryActionText}>Open Recent Sessions tab</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.overlayBody}>
                  This is a placeholder overlay for {activeOverlay?.title?.toLowerCase()}. You can attach actions, forms, or analytics
                  here.
                </Text>
                <Pressable style={styles.closeButton} onPress={() => setActiveOverlay(null)}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f6fb' },
  content: { padding: 16, gap: 12 },
  storeName: { fontSize: 28, fontWeight: '700', color: '#211f35' },
  storeCity: { color: '#6f6a80', marginTop: -4 },
  searchInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dedbe9',
    backgroundColor: '#f0eef6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#312e43'
  },
  sectionList: { marginTop: 4, gap: 10 },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#e5e2ef',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTextWrap: { flex: 1, paddingRight: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#2a2739' },
  sectionSubtitle: { marginTop: 4, color: '#726d83' },
  chevron: { fontSize: 28, lineHeight: 28, color: '#9691a7' },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 14, 25, 0.36)',
    justifyContent: 'flex-end'
  },
  overlayCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    gap: 12
  },
  overlayTitle: { fontSize: 20, fontWeight: '700', color: '#241f35' },
  overlayBody: { color: '#5a566b', lineHeight: 20 },
  overlayListWrap: { gap: 8 },
  overlaySessionRow: {
    borderWidth: 1,
    borderColor: '#ece8f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  overlaySessionName: { color: '#312c45', fontWeight: '700' },
  overlaySessionMeta: { color: '#716b86', marginTop: 2, fontSize: 12 },
  overlaySessionArrow: { fontSize: 24, color: '#9e97b4' },
  primaryAction: {
    marginTop: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: '#7b7496',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  primaryActionText: { color: '#fff', fontWeight: '700' },
  closeButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#7b7496',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  closeButtonText: { color: '#fff', fontWeight: '700' }
});
