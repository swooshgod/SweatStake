import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after a short delay to allow fonts/assets to load
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
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
