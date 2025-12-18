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
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useAppStore } from '@/src/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '@/src/store/auth';

SplashScreen.preventAutoHideAsync();

const icons = {
  home: 'home',
  transactions: 'list',
  add: 'plus-circle',
  settings: 'cog',
} as const;

export default function AppDrawerLayout() {
  const colorScheme = useColorScheme();
  const { bootstrapped, bootstrap } = useAppStore(
    useShallow((state) => ({
      bootstrapped: state.bootstrapped,
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
      SplashScreen.hideAsync();
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
