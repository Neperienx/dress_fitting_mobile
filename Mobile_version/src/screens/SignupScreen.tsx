import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      await signUp({ username, password });
      Alert.alert('Account created', 'You can now sign in with your username and password.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Sign-up failed', (error as Error).message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput placeholder="Username" value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none" />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />
      <Pressable style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign up</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 10 },
  input: { backgroundColor: '#f1f1f1', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#007aff', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' }
});
