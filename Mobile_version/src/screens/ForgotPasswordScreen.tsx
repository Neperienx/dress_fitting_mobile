import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [username, setUsername] = useState('');

  const handleReset = async () => {
    try {
      await resetPassword(username);
      Alert.alert('Reset sent', 'If the username exists, reset instructions were sent.');
    } catch (error) {
      Alert.alert('Reset failed', (error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot password</Text>
      <Text style={styles.subtitle}>Enter your username and we will send a reset link.</Text>
      <TextInput placeholder="Username" value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none" />
      <Pressable style={styles.button} onPress={handleReset}>
        <Text style={styles.buttonText}>Send reset link</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#6B6467' },
  input: { backgroundColor: '#f1f1f1', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#007aff', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' }
});
