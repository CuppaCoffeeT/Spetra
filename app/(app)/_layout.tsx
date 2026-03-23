import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Drawer } from 'expo-router/drawer';
import {
  DrawerToggleButton,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
} from '@react-navigation/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useEffect, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/src/components/useColorScheme';
import { useAppStore } from '@/src/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '@/src/store/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

const icons = {
  home: 'home',
  transactions: 'list',
  add: 'plus-circle',
  settings: 'cog',
} as const;

export default function AppDrawerLayout() {
  const colorScheme = useColorScheme();
  const { bootstrapped, bootstrapError, bootstrap } = useAppStore(
    useShallow((state) => ({
      bootstrapped: state.bootstrapped,
      bootstrapError: state.bootstrapError,
      bootstrap: state.bootstrap,
    }))
  );
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (bootstrapped) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [bootstrapped]);

  if (!bootstrapped) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (bootstrapError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#F8FAFC',
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#DC2626', marginBottom: 12 }}>
          Failed to load data
        </Text>
        <Text style={{ fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 20 }}>
          {bootstrapError}
        </Text>
        <Pressable
          style={{
            backgroundColor: '#2563EB',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 10,
          }}
          onPress={() => {
            hasBootstrappedRef.current = false;
            useAppStore.setState({ bootstrapped: false, bootstrapError: null, loading: false });
            void bootstrap();
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Drawer
      screenOptions={({ route }: { route: { name: string } }) => ({
        headerShown: true,
        headerTitleAlign: 'center',
        headerLeft: () => <DrawerToggleButton tintColor="#0F172A" />,
        drawerIcon: ({ color, focused, size }: { color: string; focused: boolean; size?: number }) => {
          const iconName = icons[route.name as keyof typeof icons] ?? 'circle';
          return (
            <FontAwesome name={iconName} size={size ?? 20} color={focused ? '#2563EB' : color} />
          );
        },
      })}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen name="home" options={{ title: 'Overview' }} />
      <Drawer.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Drawer.Screen name="add" options={{ title: 'Manual Input' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
    </Drawer>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { signOut, loading } = useAuth();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <DrawerItemList {...props} />
      <View style={{ flex: 1 }} />
      <DrawerItem
        label={loading ? 'Signing out…' : 'Sign out'}
        onPress={() => void signOut()}
        inactiveTintColor="#DC2626"
        icon={({ color, size }) => (
          <FontAwesome name="sign-out" size={size ?? 20} color={color ?? '#DC2626'} />
        )}
      />
    </DrawerContentScrollView>
  );
}
