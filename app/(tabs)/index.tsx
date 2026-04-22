import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Image, ListRenderItem, Platform, RefreshControl, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CATEGORIES = [
  "Today", "Tomorrow", "Pop", "Rock", "Electronic", "Rap", "Indie", "R&B", 
  "Country", "Jazz", "Classical", "Comedy", "Theater", "Sports", "Festival", "Other"
];

type Event = {
  id: string;
  title: string;
  start_time: string;
  venue_name: string;
  address_line1: string;
  city: string;
  region: string;
  category: string;
};

type ListingWithEvent = {
  id: string;
  seller_id: string;
  status: string;
  listing_price: number;
  ai_suggested_price: number;
  events: Event;
  artist_image_url: string;
};

export default function Index() {
  const colorScheme = useColorScheme() ?? 'light';
  const [allData, setAllData] = useState<ListingWithEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  let aiPriceColour: string;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchListings();
    }, [])
  );

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }

      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ?? 
          Constants?.easConfig?.projectId;

        if (!projectId) {
          console.error("Project ID not found");
          return;
        }

        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
        }
      } catch (error) {
        console.error('Error fetching push token:', error);
      }
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  };

  const fetchListings = async () => {
    try {
      const { data: listings, error } = await supabase
        .from('listings').select(`*, events (id, title, age_restriction, start_time, venue_name, city, category)`).in('status', ['active', 'pending']);

      if (error) throw error;

      if (listings) {
        setAllData(listings as unknown as ListingWithEvent[]);
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
  };

  const aiPriceColourLogic = (userPrice: number, aiPrice: number) => {
    const aiPriceFive = aiPrice/100*5

    if (userPrice >= aiPrice + (aiPriceFive*2))
      aiPriceColour = Colors[colorScheme].error;
    else if (userPrice >= aiPrice + aiPriceFive)
      aiPriceColour = "#E2C28A"
    else
      aiPriceColour = "#A4CBB4"
  }

  const isToday = (dateString: string) => {
    const eventDate = new Date(dateString);
    const today = new Date();
    return eventDate.getDate() === today.getDate() && eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === today.getFullYear();
  };

  const isTomorrow = (dateString: string) => {
    const eventDate = new Date(dateString);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return eventDate.getDate() === tomorrow.getDate() && eventDate.getMonth() === tomorrow.getMonth() && eventDate.getFullYear() === tomorrow.getFullYear();
  };

  const displayedListings = allData.filter(listing => {
    const matchesSearch = listing.events.title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = true;
    if (activeCategory === "Today") {
      matchesCategory = isToday(listing.events.start_time);
    } else if (activeCategory === "Tomorrow") {
      matchesCategory = isTomorrow(listing.events.start_time);
    } else if (activeCategory) {
      matchesCategory = listing.events.category === activeCategory;
    }

    return matchesSearch && matchesCategory;
  });

  const renderListing: ListRenderItem<ListingWithEvent> = ({ item }) => {
    if (!item.events) return null;

    aiPriceColourLogic(item.listing_price, item.ai_suggested_price);
    
    return (
      <TouchableOpacity
        onPress={() => router.push(`/listings/${item.id}`)}
        style={{
          backgroundColor: Colors[colorScheme].background,
          borderWidth: 1,
          borderColor: Colors[colorScheme].icon,
          borderRadius: 16,
          marginBottom: 16,
          overflow: "hidden",
        }}
      >

        <View>
          {item.artist_image_url ? (
              <Image 
                source={{ uri: item.artist_image_url }} 
                style={{ width: '100%', height: 160 }} 
                resizeMode="cover"
              />
            ) : (
              <View style={{ height: 160, backgroundColor: Colors[colorScheme].icon, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: Colors[colorScheme].tabIconDefault, fontWeight: '600' }}>No Image Available</Text>
              </View>
            )}
        </View>

        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors[colorScheme].text, flex: 1, marginRight: 8 }}>
              {item.events.title}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: aiPriceColour }}>
              €{item.listing_price}
            </Text>
          </View>

          <View style={{ marginTop: 6 }}>
            <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 14 }}>
              {formatDate(item.events.start_time)} • {item.events.venue_name}
            </Text>
            <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 12, marginTop: 4 }}>
              {item.events.city}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      <FlatList
        data={displayedListings}
        keyExtractor={(i) => i.id}
        renderItem={renderListing}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: "800", color: Colors[colorScheme].text, marginBottom: 12 }}>
              Agorex
            </Text>

            <TextInput
              placeholder="Search for items..."
              placeholderTextColor={Colors[colorScheme].tabIconDefault}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                backgroundColor: Colors[colorScheme].icon,
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
                color: Colors[colorScheme].text,
                marginBottom: 12
              }}
            />

            <FlatList
              horizontal
              data={CATEGORIES}
              keyExtractor={(c) => c}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
              renderItem={({ item }) => {
                const isActive = activeCategory === item;
                return (
                  <TouchableOpacity
                    onPress={() => setActiveCategory(isActive ? null : item)}
                    style={{
                      height: 40,
                      paddingHorizontal: 20,
                      borderRadius: 20,
                      justifyContent: 'center',
                      backgroundColor: isActive ? Colors[colorScheme].text : Colors[colorScheme].icon,
                    }}
                  >
                    <Text style={{ color: isActive ? Colors[colorScheme].background : Colors[colorScheme].text, fontWeight: "600" }}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={() => (
          <Text style={{ color: Colors[colorScheme].tabIconDefault, textAlign: 'center', marginTop: 40 }}>No events found.</Text>
        )}
      />
    </View>
  );
}