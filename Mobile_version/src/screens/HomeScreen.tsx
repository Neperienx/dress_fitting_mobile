import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../utils/authErrors';

export default function HomeScreen() {
  const { session, signOut, requestAccountDeletion } = useAuth();
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [submittingDeletionRequest, setSubmittingDeletionRequest] = useState(false);

  const submitDeletionRequest = async () => {
    try {
      setSubmittingDeletionRequest(true);
      await requestAccountDeletion(deletionReason);
      setShowDeletionModal(false);
      setDeletionReason('');
      Alert.alert(
        'Deletion request sent',
        'Your account deletion request was recorded. Store inventory and images are preserved for reassignment instead of being deleted.'
      );
    } catch (error) {
      Alert.alert('Could not request deletion', getAuthErrorMessage(error));
    } finally {
      setSubmittingDeletionRequest(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Welcome {session?.user.user_metadata.first_name ?? session?.user.email}</Text>
      <Text style={styles.body}>Manage your account. Store data is kept separate from account deletion so boutique inventory can be reassigned later.</Text>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.deleteButton]} onPress={() => setShowDeletionModal(true)}>
        <Text style={styles.buttonText}>Request account deletion</Text>
      </Pressable>

      <Modal transparent animationType="slide" visible={showDeletionModal} onRequestClose={() => setShowDeletionModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request account deletion</Text>
            <Text style={styles.body}>
              This requests deletion of your login account. Stores, dress profiles, ring profiles, and uploaded photos will stay in Supabase so they can be reassigned through a separate store recovery workflow.
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Reason (optional)"
              value={deletionReason}
              onChangeText={setDeletionReason}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setShowDeletionModal(false)}
                disabled={submittingDeletionRequest}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.confirmDeleteButton, submittingDeletionRequest && styles.disabledButton]}
                onPress={() => void submitDeletionRequest()}
                disabled={submittingDeletionRequest}
              >
                <Text style={styles.buttonText}>{submittingDeletionRequest ? 'Sending...' : 'Send request'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', gap: 12 },
  title: { fontSize: 30, fontWeight: '700' },
  subtitle: { fontSize: 16 },
  body: { color: '#6B6467' },
  button: { backgroundColor: '#C38D9E', borderRadius: 8, padding: 12, alignItems: 'center' },
  deleteButton: { backgroundColor: '#8F3D48' },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#2E2A2B' },
  reasonInput: {
    minHeight: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2D7DC',
    backgroundColor: '#FBF8FA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  actionButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelButton: { backgroundColor: '#EFE8EB' },
  cancelButtonText: { color: '#4B4146', fontWeight: '600' },
  confirmDeleteButton: { backgroundColor: '#8F3D48' },
  disabledButton: { opacity: 0.65 }
});
