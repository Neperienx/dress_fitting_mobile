import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');

  const handleReset = async () => {
    try {
      await resetPassword(email.trim());
      Alert.alert('Reset sent', 'Check your email for reset instructions.');
    } catch (error) {
      Alert.alert('Reset failed', (error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot password</Text>
      <Text style={styles.subtitle}>Enter your email and we will send a reset link.</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
      <Pressable style={styles.button} onPress={handleReset}>
        <Text style={styles.buttonText}>Send reset email</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#555' },
  input: { backgroundColor: '#f1f1f1', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#007aff', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' }
});
