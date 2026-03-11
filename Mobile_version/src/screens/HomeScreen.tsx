import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Welcome {session?.user.user_metadata.first_name ?? session?.user.email}</Text>
      <Text style={styles.body}>This is a placeholder home page for bridal studio operations.</Text>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', gap: 12 },
  title: { fontSize: 30, fontWeight: '700' },
  subtitle: { fontSize: 16 },
  body: { color: '#555' },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' }
});
