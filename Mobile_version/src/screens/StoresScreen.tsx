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
import { defaultStoreType, getStoreTypeLabel, StoreType } from '../types/store';

type Props = NativeStackScreenProps<StoresStackParamList, 'StoresList'>;
const MAX_STORE_NAME_LENGTH = 40;
const STORE_TYPES = [
  { value: 'wedding_dresses' as const, label: 'Wedding Dresses' },
  { value: 'engagement_rings' as const, label: 'Engagement Rings' }
];

export default function StoresScreen({ navigation }: Props) {
  const { session } = useAuth();
  const { stores, loadingStores, refreshStores, selectStore } = useStore();
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [storeType, setStoreType] = useState<StoreType>(defaultStoreType);
  const [savingStore, setSavingStore] = useState(false);

  const createStore = useCallback(async () => {
    const trimmedName = storeName.trim();
    const trimmedLocation = storeLocation.trim();

    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a store name.');
      return;
    }
    if (trimmedName.length > MAX_STORE_NAME_LENGTH) {
      Alert.alert('Name too long', `Store names can be up to ${MAX_STORE_NAME_LENGTH} characters.`);
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
        city: trimmedLocation || null,
        type: storeType
      });

      if (error) {
        throw error;
      }

      setStoreName('');
      setStoreLocation('');
      setStoreType(defaultStoreType);
      setShowCreateStoreModal(false);
      await refreshStores();
    } catch (error) {
      Alert.alert('Could not create store', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSavingStore(false);
    }
  }, [refreshStores, session?.user.id, storeLocation, storeName, storeType]);

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
              storeCity: store.city,
              storeType: store.type
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
          <Text numberOfLines={1} style={styles.storeTypePill}>
            {getStoreTypeLabel(store.type)}
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
              maxLength={MAX_STORE_NAME_LENGTH}
            />
            <TextInput
              style={styles.input}
              placeholder="Location"
              value={storeLocation}
              onChangeText={setStoreLocation}
              autoCapitalize="words"
            />
            <View style={styles.typePickerWrap}>
              <Text style={styles.typePickerLabel}>Store type</Text>
              <View style={styles.typeOptions}>
                {STORE_TYPES.map((option) => {
                  const isSelected = option.value === storeType;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.typeOption, isSelected && styles.typeOptionSelected]}
                      onPress={() => setStoreType(option.value)}
                    >
                      <Text style={[styles.typeOptionText, isSelected && styles.typeOptionTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
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
  container: { flex: 1, backgroundColor: '#F8F5F7' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#2E2A2B' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { color: '#6B6467' },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  storeTile: {
    width: '47%',
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E4E6',
    backgroundColor: '#FFFFFF',
    padding: 12,
    justifyContent: 'space-between'
  },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  addIcon: { fontSize: 38, color: '#9d99ac' },
  addLabel: { color: '#6B6467', fontWeight: '600' },
  storeIcon: { fontSize: 38, color: '#b3afc2' },
  storeName: { fontSize: 16, fontWeight: '600', color: '#2E2A2B' },
  storeLocation: { color: '#746f86' },
  storeTypePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#F2EEF9',
    color: '#5A4B79',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
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
  typePickerWrap: { gap: 8 },
  typePickerLabel: { color: '#4E4760', fontWeight: '600' },
  typeOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeOption: {
    borderWidth: 1,
    borderColor: '#d4d0e2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#faf9ff'
  },
  typeOptionSelected: {
    borderColor: '#787194',
    backgroundColor: '#ece9f7'
  },
  typeOptionText: { color: '#5c556f', fontWeight: '600' },
  typeOptionTextSelected: { color: '#2f2a3e' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  actionButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelButton: { backgroundColor: '#eceaf4' },
  cancelButtonText: { color: '#3f3b52', fontWeight: '600' },
  saveButton: { backgroundColor: '#787194' },
  disabledButton: { opacity: 0.65 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700' }
});
