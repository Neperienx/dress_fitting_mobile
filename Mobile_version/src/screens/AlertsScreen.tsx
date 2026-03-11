import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function AlertsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alerts</Text>
      <Text style={styles.body}>Placeholder for important notifications and reminders.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { marginTop: 8, color: '#555', textAlign: 'center' }
});
