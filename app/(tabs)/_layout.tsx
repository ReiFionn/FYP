import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { StripeProvider } from "@stripe/stripe-react-native";
import { router, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const requireAuth = (e: any) => {
    if (!isAuthenticated) {
      e.preventDefault();
      Alert.alert(
        "Sign In Required",
        "Please log in or create an account to access this feature.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log In", onPress: () => router.push('../(auth)/login') }
        ]
      );
    }
  };

  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
      merchantIdentifier="merchant.identifier"
      urlScheme="your-url-scheme"
    >
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.primary, 
          tabBarInactiveTintColor: theme.icon,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.border, 
            elevation: 0,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "house.fill" : "house"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "magnifyingglass.circle.fill" : "magnifyingglass"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="createListing"
          listeners={{ tabPress: requireAuth }}
          options={{
            title: 'List',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "plus.circle.fill" : "plus.circle"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          listeners={{ tabPress: requireAuth }}
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "envelope.fill" : "envelope"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          listeners={{ tabPress: requireAuth }}
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "person.crop.circle.fill" : "person.crop.circle"} color={color} />,
          }}
        />
        <Tabs.Screen name="chat/[otherUserId]" options={{ href: null }} />
        <Tabs.Screen name="listings/[listingId]" options={{ href: null }} />
        <Tabs.Screen name="userListings" options={{ href: null }} />
        <Tabs.Screen name="userSettings" options={{ href: null }} />
        <Tabs.Screen name="user/[userId]" options={{ href: null }} />
      </Tabs>
    </StripeProvider>
  );
}