import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { initRevenueCat } from '@/lib/subscription';

const FIRST_LAUNCH_KEY = 'podium_first_launch_seen';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { Colors, isDark } = useTheme();
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      const seen = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
      setIsFirstLaunch(seen === null);
      const timer = setTimeout(() => SplashScreen.hideAsync(), 500);
      return () => clearTimeout(timer);
    };
    init();
  }, []);

  if (isFirstLaunch === null) return null; // loading

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        initialRouteName={isFirstLaunch ? 'first-launch' : '(tabs)'}
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="first-launch" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/welcome" options={{ headerShown: false }} />
        <Stack.Screen
          name="create"
          options={{
            presentation: 'modal',
            headerTitle: 'Create Competition',
          }}
        />
        <Stack.Screen
          name="competition/[id]"
          options={{
            headerTitle: '',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="join/[code]"
          options={{
            presentation: 'modal',
            headerTitle: 'Join Competition',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
