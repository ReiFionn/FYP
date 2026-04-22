import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StripeProvider } from "@stripe/stripe-react-native";
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

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
            title: 'Explore',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "magnifyingglass.circle.fill" : "magnifyingglass"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="createListing"
          options={{
            title: 'Sell',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "plus.circle.fill" : "plus.circle"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "envelope.fill" : "envelope"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => <IconSymbol size={28} name={focused ? "person.crop.circle.fill" : "person.crop.circle"} color={color} />,
          }}
        />
        <Tabs.Screen
          name="chat/[otherUserId]" 
          options={{
            href: null, 
          }}
        />
        <Tabs.Screen
          name="listings/[listingId]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="test_payment"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="userListings"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="userSettings"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </StripeProvider>
  );
}