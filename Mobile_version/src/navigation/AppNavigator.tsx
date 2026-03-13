import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import SessionScreen from '../screens/SessionScreen';
import StoresScreen from '../screens/StoresScreen';
import AlertsScreen from '../screens/AlertsScreen';
import StoreDetailScreen from '../screens/StoreDetailScreen';
import InventoryScreen from '../screens/InventoryScreen';
import DressProfileScreen from '../screens/DressProfileScreen';
import StoreRecentSessionsScreen from '../screens/StoreRecentSessionsScreen';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

type AppTabsParamList = {
  Home: undefined;
  Session: {
    open?: 'recent';
    sessionId?: string;
  } | undefined;
  Stores: undefined;
  Alerts: undefined;
};

export type StoresStackParamList = {
  StoresList: undefined;
  StoreDetail: {
    storeId: string;
    storeName: string;
    storeCity: string | null;
  };
  StoreRecentSessions: {
    storeId: string;
    storeName: string;
  };
  Inventory: {
    storeId: string;
    storeName: string;
  };
  DressProfile: {
    storeId: string;
    storeName: string;
    dress: {
      id: string;
      name: string | null;
      price: number | null;
      created_at: string;
      dress_images: {
        id: string;
        image_url: string;
        sort_order: number;
      }[];
    };
  };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<AppTabsParamList>();
const StoresStack = createNativeStackNavigator<StoresStackParamList>();

function StoreHeaderTitle() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabsParamList>>();
  const { stores, selectedStore, selectStore } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const hasStores = stores.length > 0;
  const title = selectedStore?.name ?? 'Link Shop';

  const handleTitlePress = () => {
    if (!hasStores) {
      navigation.navigate('Stores');
      return;
    }

    setIsMenuOpen(true);
  };

  const handleStorePress = async (storeId: string) => {
    await selectStore(storeId);
    setIsMenuOpen(false);
  };

  return (
    <>
      <Pressable style={headerStyles.trigger} onPress={handleTitlePress}>
        <Text numberOfLines={1} style={headerStyles.triggerText}>
          {title}
        </Text>
        <Text style={headerStyles.triggerIcon}>{hasStores ? '▾' : '↗'}</Text>
      </Pressable>

      <Modal transparent visible={isMenuOpen} animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
        <Pressable style={headerStyles.menuBackdrop} onPress={() => setIsMenuOpen(false)}>
          <View style={headerStyles.menuCard}>
            {stores.map((store) => {
              const isSelected = selectedStore?.id === store.id;
              return (
                <Pressable key={store.id} style={headerStyles.menuItem} onPress={() => void handleStorePress(store.id)}>
                  <Text style={[headerStyles.menuItemText, isSelected && headerStyles.menuItemSelected]}>{store.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function StoresNavigator() {
  return (
    <StoresStack.Navigator>
      <StoresStack.Screen name="StoresList" component={StoresScreen} options={{ title: 'Stores', headerShown: false }} />
      <StoresStack.Screen
        name="StoreDetail"
        component={StoreDetailScreen}
        options={({ route }) => ({ title: route.params.storeName })}
      />

      <StoresStack.Screen
        name="StoreRecentSessions"
        component={StoreRecentSessionsScreen}
        options={({ route }) => ({ title: `${route.params.storeName} Sessions` })}
      />

      <StoresStack.Screen
        name="Inventory"
        component={InventoryScreen}
        options={({ route }) => ({ title: `${route.params.storeName} Inventory` })}
      />

      <StoresStack.Screen name="DressProfile" component={DressProfileScreen} options={{ title: 'Dress Profile' }} />
    </StoresStack.Navigator>
  );
}

function AppTabs() {
  const screenOptions = useMemo(
    () => ({
      headerTitle: () => <StoreHeaderTitle />
    }),
    []
  );

  return (
    <Tabs.Navigator screenOptions={screenOptions}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Session" component={SessionScreen} />
      <Tabs.Screen name="Stores" component={StoresNavigator} options={{ headerShown: false }} />
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

const headerStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 220
  },
  triggerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#201d30',
    maxWidth: 185
  },
  triggerIcon: {
    fontSize: 14,
    color: '#6e6883'
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingTop: 98,
    paddingHorizontal: 18,
    alignItems: 'center'
  },
  menuCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e2ef',
    overflow: 'hidden'
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eeebf7'
  },
  menuItemText: {
    color: '#37324a'
  },
  menuItemSelected: {
    fontWeight: '700',
    color: '#26213a'
  }
});
