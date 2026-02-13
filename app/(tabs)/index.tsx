import { View, Text, FlatList, TextInput, TouchableOpacity, Image, ListRenderItem } from "react-native";
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";


const CATEGORIES = ["Today", "Rock", "Pop", "Rap", "Electronic"];

type Event = {
  id: string;
  title: string;
  start_time: string; // supabase returns strings for timestamps
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
  events: Event; 
};

export default function Index() {
  const colorScheme = useColorScheme() ?? 'light';
  const [data, setData] = useState<ListingWithEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const { data: listings, error } = await supabase
        .from('listings').select(`*, events (id, title, age_restriction, start_time, venue_name, city, category)`).eq('status', 'active'); // only shows active listings

      if (error) throw error;

      if (listings) {
        setData(listings as unknown as ListingWithEvent[]); // force type to match
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

  const renderListing: ListRenderItem<ListingWithEvent> = ({ item }) => {
    if (!item.events) return null;
    
    return (
      <TouchableOpacity
        style={{
          backgroundColor: Colors[colorScheme].background,
          borderWidth: 1,
          borderColor: Colors[colorScheme].icon,
          borderRadius: 16,
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        <View style={{ height: 160, backgroundColor: Colors[colorScheme].icon, justifyContent: 'center', alignItems: 'center' }}>
           <Text style={{color: Colors[colorScheme].tabIconDefault}}>Event Image</Text> {/* placeholder for image */}
        </View> 

        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors[colorScheme].text, flex: 1, marginRight: 8 }}>
              {item.events.title}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: '#0a7ea4' }}>
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
    <View style={{ flex: 1, padding: 16, backgroundColor: Colors[colorScheme].background }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: Colors[colorScheme].text, marginBottom: 12 }}>Fair Play</Text>

      <View style={{ paddingHorizontal: 16 }}>
        <TextInput
          placeholder="Search for items..."
          placeholderTextColor="#ECEDEE"
          style={{
            backgroundColor: Colors[colorScheme].icon,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 2}}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              height: 40,
              paddingVertical: 0, 
              paddingHorizontal: 20,
              borderRadius: 20,
              justifyContent: 'center', 
              alignItems: 'center', 
              marginRight: 2,
              backgroundColor: Colors[colorScheme].icon,
            }}
          >
            <Text numberOfLines={1} 
              style={{ 
                color: Colors[colorScheme].text, 
                fontWeight: "600",
                fontSize: 14,
              }}>
            {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={renderListing}
      />
    </View>
  );
}
