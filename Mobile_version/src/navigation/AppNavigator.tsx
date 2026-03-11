import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import SessionScreen from '../screens/SessionScreen';
import StoresScreen from '../screens/StoresScreen';
import AlertsScreen from '../screens/AlertsScreen';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

type AppTabsParamList = {
  Home: undefined;
  Session: undefined;
  Stores: undefined;
  Alerts: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<AppTabsParamList>();

function AppTabs() {
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Session" component={SessionScreen} />
      <Tabs.Screen name="Stores" component={StoresScreen} />
      <Tabs.Screen name="Alerts" component={AlertsScreen} />
    </Tabs.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? (
        <AppTabs />
      ) : (
        <AuthStack.Navigator>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
          <AuthStack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create account' }} />
          <AuthStack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ title: 'Forgot password' }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
