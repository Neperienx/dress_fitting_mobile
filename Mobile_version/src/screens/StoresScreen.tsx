import React, { useCallback, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
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
import { useStore } from '../context/StoreContext';
import { assertSupabaseConfigured, supabase } from '../lib/supabase';
import { StoresStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StoresStackParamList, 'StoresList'>;

export default function StoresScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { stores, loadingStores, refreshStores, selectStore } = useStore();
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [savingStore, setSavingStore] = useState(false);

  const createStore = useCallback(async () => {
    const trimmedName = storeName.trim();
    const trimmedLocation = storeLocation.trim();

    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a store name.');
      return;
    }

    if (!session?.user.id) {
      Alert.alert('Not signed in', 'Please sign in again before creating a store.');
      return;
    }

    try {
      assertSupabaseConfigured();
      setSavingStore(true);
      const { error } = await supabase.from('studios').insert({
        owner_id: session.user.id,
        name: trimmedName,
        city: trimmedLocation || null
      });

      if (error) {
        throw error;
      }

      setStoreName('');
      setStoreLocation('');
      setShowCreateStoreModal(false);
      await refreshStores();
    } catch (error) {
      Alert.alert('Could not create store', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSavingStore(false);
    }
  }, [refreshStores, session?.user.id, storeLocation, storeName]);

  const storeTiles = useMemo(
    () =>
      stores.map((store) => (
        <Pressable
          key={store.id}
          style={styles.storeTile}
          onPress={async () => {
            await selectStore(store.id);
            navigation.navigate('StoreDetail', {
              storeId: store.id,
              storeName: store.name,
              storeCity: store.city
            });
          }}
        >
          <Text style={styles.storeIcon}>🏬</Text>
          <Text numberOfLines={2} style={styles.storeName}>
            {store.name}
          </Text>
          <Text numberOfLines={1} style={styles.storeLocation}>
            {store.city || 'Location not set'}
          </Text>
        </Pressable>
      )),
    [navigation, selectStore, stores]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Stores</Text>

        {loadingStores ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Loading stores...</Text>
          </View>
        ) : (
          <View style={styles.tilesGrid}>
            <Pressable style={[styles.storeTile, styles.addTile]} onPress={() => setShowCreateStoreModal(true)}>
              <Text style={styles.addIcon}>＋</Text>
              <Text style={styles.addLabel}>New Store</Text>
            </Pressable>
            {storeTiles}
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={showCreateStoreModal} onRequestClose={() => setShowCreateStoreModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create store</Text>
            <TextInput
              style={styles.input}
              placeholder="Store name"
              value={storeName}
              onChangeText={setStoreName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Location"
              value={storeLocation}
              onChangeText={setStoreLocation}
              autoCapitalize="words"
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={() => setShowCreateStoreModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.saveButton, savingStore && styles.disabledButton]}
                onPress={() => void createStore()}
                disabled={savingStore}
              >
                <Text style={styles.saveButtonText}>{savingStore ? 'Saving...' : 'Save'}</Text>
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
  storeTile: {
    width: '47%',
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfdcea',
    backgroundColor: '#fff',
    padding: 12,
    justifyContent: 'space-between'
  },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  addIcon: { fontSize: 38, color: '#9d99ac' },
  addLabel: { color: '#4f4a63', fontWeight: '600' },
  storeIcon: { fontSize: 38, color: '#b3afc2' },
  storeName: { fontSize: 16, fontWeight: '600', color: '#2a2739' },
  storeLocation: { color: '#746f86' },
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
    gap: 12
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
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  actionButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelButton: { backgroundColor: '#eceaf4' },
  cancelButtonText: { color: '#3f3b52', fontWeight: '600' },
  saveButton: { backgroundColor: '#787194' },
  disabledButton: { opacity: 0.65 },
  saveButtonText: { color: '#fff', fontWeight: '700' }
});
