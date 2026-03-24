import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, NavigatorScreenParams, RouteProp, useNavigation } from '@react-navigation/native';
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

type AppTabsParamList = {
  Home: undefined;
  Session:
    | {
        open?: 'recent';
        sessionId?: string;
        resetToStart?: boolean;
      }
    | undefined;
  Stores: NavigatorScreenParams<StoresStackParamList> | undefined;
  Alerts: undefined;
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
        <Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={headerStyles.triggerText}>
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

function AccountHeaderButton() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabsParamList>>();

  return (
    <Pressable onPress={() => navigation.navigate('Home')} style={headerStyles.accountButton}>
      <Text style={headerStyles.accountButtonIcon}>👤</Text>
    </Pressable>
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
  const { selectedStore } = useStore();

  const getTabIcon = (route: RouteProp<AppTabsParamList, keyof AppTabsParamList>) => {
    switch (route.name) {
      case 'Stores':
        return '🏠';
      case 'Session':
        return '✨';
      case 'Alerts':
        return '🔔';
      default:
        return '•';
    }
  };

  const screenOptions = useMemo(
    () => ({
      headerTitle: () => <StoreHeaderTitle />,
      headerRight: () => <AccountHeaderButton />,
      headerTitleAlign: 'center' as const
    }),
    []
  );

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        ...screenOptions,
        headerStyle: { backgroundColor: '#FEFCFD' },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: '#FEFCFD', borderTopColor: '#EFE7EA' },
        tabBarActiveTintColor: '#D59AA9',
        tabBarInactiveTintColor: '#8A8084',
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{getTabIcon(route)}</Text>
      })}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarButton: () => null
        }}
      />
      <Tabs.Screen
        name="Stores"
        component={StoresNavigator}
        options={{ headerShown: false, tabBarLabel: 'Store' }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();

            if (!selectedStore) {
              navigation.navigate('Stores', { screen: 'StoresList' });
              return;
            }

            navigation.navigate('Stores', {
              screen: 'StoreDetail',
              params: {
                storeId: selectedStore.id,
                storeName: selectedStore.name,
                storeCity: selectedStore.city
              }
            });
          }
        })}
      />
      <Tabs.Screen
        name="Session"
        component={SessionScreen}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate('Session', { resetToStart: true });
          }
        })}
      />
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
    justifyContent: 'center',
    gap: 6,
    maxWidth: 290,
    minWidth: 0
  },
  triggerText: {
    fontSize: 24,
    fontFamily: Platform.select({
      ios: 'SnellRoundhand-Bold',
      android: 'serif',
      default: 'serif'
    }),
    color: '#443C40',
    maxWidth: 255,
    minWidth: 0,
    flexShrink: 1
  },
  triggerIcon: {
    fontSize: 14,
    color: '#908487'
  },
  accountButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#EADFE3',
    backgroundColor: '#FFF7FA'
  },
  accountButtonIcon: {
    fontSize: 18
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9E4E6',
    overflow: 'hidden'
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE8EB'
  },
  menuItemText: {
    color: '#2E2A2B'
  },
  menuItemSelected: {
    fontWeight: '700',
    color: '#2E2A2B'
  }
});
