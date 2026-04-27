import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ListRenderItem, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';

const CATEGORIES = [
  "All", "Pop", "Rock", "Electronic", "Rap", "Indie", "R&B", 
  "Country", "Jazz", "Classical", "Comedy", "Theater", "Sports", "Festival", "Other"
];
const DATES = ["Anytime", "Today", "Tomorrow", "This Week", "This Month"];
const SORTS = [
  { label: 'Recently Added', value: 'newest' }, 
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' }
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

export default function Search() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [results, setResults] = useState<ListingWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeDate, setActiveDate] = useState("Anytime");
  const [activeSort, setActiveSort] = useState("date_asc");

  useEffect(() => {
    executeSearch();
  }, [activeCategory, activeDate, activeSort]);

  const onRefresh = async () => {
    setRefreshing(true);
    await executeSearch();
    setRefreshing(false);
  };

  const executeSearch = async () => {
    setLoading(true);
    try {
      let dbQuery = supabase
        .from('listings')
        .select(`*, events!inner (id, title, age_restriction, start_time, venue_name, city, category)`)
        .in('status', ['active', 'pending']);

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        dbQuery = dbQuery.or(`title.ilike.${term},venue_name.ilike.${term},city.ilike.${term}`, { foreignTable: 'events' });
      }

      if (activeCategory !== "All") {
        dbQuery = dbQuery.eq('events.category', activeCategory);
      }

      if (activeDate !== "Anytime") {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        
        if (activeDate === "Today") {
          const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
          dbQuery = dbQuery.gte('events.start_time', startOfDay).lte('events.start_time', endOfDay);
        } else if (activeDate === "Tomorrow") {
          const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
          const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59).toISOString();
          dbQuery = dbQuery.gte('events.start_time', startOfTomorrow).lte('events.start_time', endOfTomorrow);
        } else if (activeDate === "This Week") {
          const endOfWeek = new Date(now.setDate(now.getDate() + (7 - now.getDay()))).toISOString();
          dbQuery = dbQuery.gte('events.start_time', startOfDay).lte('events.start_time', endOfWeek);
        } else if (activeDate === "This Month") {
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
          dbQuery = dbQuery.gte('events.start_time', startOfDay).lte('events.start_time', endOfMonth);
        }
      }

      if (activeSort === 'price_asc') {
        dbQuery = dbQuery.order('listing_price', { ascending: true });
      } else if (activeSort === 'price_desc') {
        dbQuery = dbQuery.order('listing_price', { ascending: false });
      } else if (activeSort === 'newest') {
        dbQuery = dbQuery.order('created_updated_at', { ascending: false });
      } else {
        dbQuery = dbQuery.order('start_time', { foreignTable: 'events', ascending: true });
      }

      const { data, error } = await dbQuery;
      if (error) throw error;
      
      setResults((data || []) as unknown as ListingWithEvent[]);
    } catch (error) {
      console.error('Error executing search:', error);
    } finally {
      setLoading(false);
    }
  };

  const aiPriceColourLogic = (userPrice: number, aiPrice: number) => {
      if (userPrice === undefined || aiPrice === undefined) return "#A4CBB4";
      
      const marginOrange = aiPrice * 0.10;
      const marginRed = aiPrice * 0.25;
      
      if (userPrice >= aiPrice + marginRed) return Colors[colorScheme].error;
      if (userPrice >= aiPrice + marginOrange) return "#E2C28A"
      
      return "#A4CBB4"
    }

  const renderListing: ListRenderItem<ListingWithEvent> = ({ item }) => {
    if (!item.events) return null;
    const aiPriceColour = aiPriceColourLogic(item.listing_price, item.ai_suggested_price);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/listings/${item.id}`)}
        style={{
          backgroundColor: theme.background,
          borderWidth: 1,
          borderColor: theme.icon,
          borderRadius: 16,
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        <View>
          {item.artist_image_url && item.artist_image_url.trim() !== "" && item.artist_image_url !== "null" ? (
            <Image source={{ uri: item.artist_image_url }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
          ) : (
            <View style={{ height: 160, backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>No Image Available</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, flex: 1, marginRight: 8 }}>
              {item.events.title}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: aiPriceColour }}>
              €{item.listing_price}
            </Text>
          </View>

          <View style={{ marginTop: 6 }}>
            <Text style={{ color: theme.tabIconDefault, fontSize: 14 }}>
              {new Date(item.events.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })} • {item.events.venue_name}
            </Text>
            <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginTop: 4 }}>
              {item.events.city}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const FilterRow = ({ data, activeValue, onSelect }: { data: any[], activeValue: string, onSelect: (val: string) => void }) => (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(i) => i.value || i}
      style={{ marginBottom: 12 }}
      renderItem={({ item }) => {
        const val = item.value || item;
        const label = item.label || item;
        const isActive = activeValue === val;
        return (
          <TouchableOpacity
            onPress={() => onSelect(val)}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
              backgroundColor: isActive ? theme.text : theme.icon, 
            }}
          >
            <Text style={{ color: isActive ? theme.background : theme.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={loading && !refreshing ? [] : results} 
        keyExtractor={(i) => i.id}
        renderItem={renderListing}
        contentContainerStyle={{ padding: 16 }} 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: "800", color: theme.text, marginBottom: 12 }}>
              Explore
            </Text>
            
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={executeSearch}
              returnKeyType="search"
              placeholder="Search artists, venues, or cities..."
              placeholderTextColor={theme.tabIconDefault}
              style={{ 
                backgroundColor: theme.icon, 
                color: theme.text, 
                padding: 12, 
                borderRadius: 12, 
                fontSize: 16, 
                marginBottom: 12 
              }}
            />

            <FilterRow data={CATEGORIES} activeValue={activeCategory} onSelect={setActiveCategory} />
            <FilterRow data={DATES} activeValue={activeDate} onSelect={setActiveDate} />
            <FilterRow data={SORTS} activeValue={activeSort} onSelect={setActiveSort} />
          </View>
        }
        
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.text} />
            </View>
          ) : (
            <Text style={{ color: theme.tabIconDefault, textAlign: 'center', marginTop: 40, fontSize: 16 }}>
              No tickets found matching your criteria.
            </Text>
          )
        }
      />
    </View>
  );
}