import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { StoresStackParamList } from '../navigation/AppNavigator';
import { SavedSession, loadSessionHistory } from '../utils/sessionHistory';

type Props = NativeStackScreenProps<StoresStackParamList, 'StoreRecentSessions'>;

function formatSessionDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function StoreRecentSessionsScreen({ navigation, route }: Props) {
  const { storeId } = route.params;
  const [searchValue, setSearchValue] = useState('');
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void (async () => {
        const loadedSessions = await loadSessionHistory(storeId);
        setSessions(loadedSessions);
      })();
    });

    return unsubscribe;
  }, [navigation, storeId]);

  const filteredSessions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return sessions;
    }

    return sessions.filter((session) => (session.brideName || '').toLowerCase().includes(query));
  }, [searchValue, sessions]);

  const openSession = (sessionId?: string) => {
    navigation.getParent()?.navigate('Session', { open: 'recent', sessionId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by person name..."
          value={searchValue}
          onChangeText={setSearchValue}
          autoCapitalize="words"
        />

        {filteredSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No matching sessions</Text>
            <Text style={styles.emptyStateBody}>Try another name, or run a new session to see it here.</Text>
          </View>
        ) : (
          <View style={styles.tilesGrid}>
            {filteredSessions.map((session) => (
              <Pressable key={session.id} style={styles.sessionTile} onPress={() => openSession(session.id)}>
                <Text numberOfLines={2} style={styles.sessionName}>
                  {session.brideName || 'Untitled session'}
                </Text>
                <Text style={styles.sessionMeta}>{formatSessionDate(session.endedAt)}</Text>
                <Text style={styles.sessionMeta}>{session.sessionQueue.length} dresses reviewed</Text>
                <Text style={styles.openLabel}>Open session →</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5F7' },
  content: { padding: 16, gap: 12 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E9E4E6',
    backgroundColor: '#F8F5F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#2E2A2B'
  },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sessionTile: {
    width: '47%',
    minHeight: 148,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E4E6',
    backgroundColor: '#FFFFFF',
    padding: 12,
    justifyContent: 'space-between'
  },
  sessionName: { color: '#2b2740', fontWeight: '700', fontSize: 16 },
  sessionMeta: { color: '#6B6467', fontSize: 12 },
  openLabel: { color: '#61597b', fontWeight: '600', marginTop: 8 },
  emptyState: {
    borderWidth: 1,
    borderColor: '#E9E4E6',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 4
  },
  emptyStateTitle: { color: '#2E2A2B', fontWeight: '700' },
  emptyStateBody: { color: '#6B6467' }
});
