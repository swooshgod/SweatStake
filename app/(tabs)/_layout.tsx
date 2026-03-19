import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';

function TabHeader({ showCreateButton }: { showCreateButton?: boolean }) {
  const { Colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <View style={[styles.header, { backgroundColor: Colors.background }]}>
      <View style={styles.headerInner}>
        <Text style={[styles.wordmark, { color: Colors.primary }]}>PODIUM</Text>
        <View style={[styles.wordmarkUnderline, { backgroundColor: Colors.primary }]} />
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themeToggle, { backgroundColor: Colors.surfaceLight }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Ionicons
            name={isDark ? 'sunny' : 'moon'}
            size={18}
            color={isDark ? Colors.accentGold : Colors.accentPurple}
          />
        </TouchableOpacity>
        {showCreateButton && (
          <TouchableOpacity
            onPress={() => {
              if (!isAuthenticated) {
                router.push('/(auth)/welcome');
                return;
              }
              router.push('/create');
            }}
            style={[styles.createButton, { backgroundColor: Colors.primary }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Create new competition"
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { Colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '700',
          letterSpacing: 0.5,
        },
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: () => <TabHeader showCreateButton />,
          title: 'Compete',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: () => <TabHeader />,
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  headerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 6,
  },
  wordmarkUnderline: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginTop: 3,
    opacity: 0.6,
  },
  headerRight: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
