import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from "@/lib/supabase";
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type Profile = {
  id: string;
  display_name: string;
  trust_rating: number;
  picture_url: string | null;
};

type Item = {
  id: string;
  events?: { title: string; start_time: string; venue_name: string; city: string };
  listing_price?: number;
  status?: string;
  ai_suggested_price?: number;
};

export default function Profile() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };


  const fetchUserData = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const [profile, listings, purchases] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('listings').select('*, events(title, start_time, venue_name, city)').eq('seller_id', user.id).neq('status', 'sold'),
        supabase.from('listings').select('*, events(title, start_time, venue_name, city)').eq('active_buyer_id', user.id)
      ]);

      if (profile.data) setProfile(profile.data);
      if (listings.data) setListings(listings.data);
      if (purchases.data) setPurchases(purchases.data);
      console.log(purchases)
      console.log(user.id)
    } catch (error) {
      console.error("Error fetching profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
    
    const thresholdRating = Math.floor(safeRating * 2) / 2;
    
    const fullStars = Math.floor(thresholdRating);
    const hasHalfStar = thresholdRating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return '★'.repeat(fullStars) + (hasHalfStar ? '½' : '') + '☆'.repeat(emptyStars);
  };

  const getAiPriceColour = (userPrice?: number, aiPrice?: number) => {
    if (userPrice === undefined || aiPrice === undefined) return "green"; // Fallback
    const aiPriceFive = (aiPrice / 100) * 5;
    
    if (userPrice >= aiPrice + (aiPriceFive * 2)) return "red";
    if (userPrice >= aiPrice + aiPriceFive) return "orange";
    return "green";
  };

  const renderItemCard = (item: Item, type: 'Listing' | 'Purchase') => {
    const cardPriceColour = getAiPriceColour(item.listing_price, item.ai_suggested_price);

    return(
      <TouchableOpacity
        key={item.id}
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
        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, flex: 1, marginRight: 8 }}>
              {item.events?.title || 'Unknown Event'}
            </Text>
            {type === 'Listing' && (
              <Text style={{ fontSize: 16, fontWeight: "700", color: cardPriceColour }}>
                €{item.listing_price}
              </Text>
            )}
          </View>

          <View style={{ marginTop: 6 }}>
            <Text style={{ color: theme.tabIconDefault, fontSize: 14 }}>
              {item.events?.start_time ? new Date(item.events.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : ''} • {item.events?.venue_name}
            </Text>
            <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginTop: 4 }}>
              {item.events?.city}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  };

  const handlePicturePress = () => {
    Alert.alert(
      "Profile Picture",
      "Choose an option",
      [
        { text: "Change Picture", onPress: pickAndUploadImage },
        { text: "Remove Picture", onPress: removePicture, style: "destructive" },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const pickAndUploadImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setLoading(true);
      const imageUri = result.assets[0].uri;
      
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile_pictures')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile_pictures')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ picture_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, picture_url: publicUrl } : null);

    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const removePicture = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ picture_url: null })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, picture_url: null } : null);
    } catch (error: any) {
      console.error("Remove error:", error);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error signing out", error.message);
      setLoading(false);
    } else {
      router.replace('/login'); 
    }
  };

  return (
    <ScrollView 
    style={{ flex: 1, backgroundColor: theme.background }}
    refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <TouchableOpacity 
        onPress={() => router.push('/userSettings')}
        style={{ 
          position: 'absolute', 
          top: 20, 
          right: 20, 
          zIndex: 10,
          padding: 8 
        }}
      >
        <IconSymbol name="gearshape.fill" size={28} color={theme.text} />
      </TouchableOpacity>      
      <View style={{ alignItems: 'center', paddingVertical: 30, borderBottomWidth: 1, borderBottomColor: theme.icon }}>
        <TouchableOpacity onPress={handlePicturePress} activeOpacity={0.8}>
          <Image
            source={{ uri: profile?.picture_url || 'https://cdn.vectorstock.com/i/500p/08/19/gray-human-icon-profile-placeholder-vector-35850819.jpg' }}
            style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 12 , borderWidth: 2, borderColor: theme.icon, backgroundColor: theme.background }}
          />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4, color: theme.text }}>
          {profile?.display_name}
        </Text>
        <Text style={{ fontSize: 18, letterSpacing: 2 }}>
          {renderStars(profile?.trust_rating || 0)} <Text style={{ color: theme.tabIconDefault, fontSize: 14 }}>({Number(profile?.trust_rating || 0).toFixed(1)}/5)</Text>
        </Text>
      </View>

      <TouchableOpacity 
        onPress={() => router.push('./userListings')}
        style={{
          padding: 15,
          backgroundColor: Colors[colorScheme].icon,
          borderRadius: 8,
          marginTop: 20,
          marginHorizontal: 20,
          alignItems: 'center'
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text }}>
          Manage My Listings
        </Text>
      </TouchableOpacity>

      <View style={{padding: 20}}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 16 , color: theme.text }}>Current Listings</Text>
        {listings.length > 0 ? (
          listings.map(item => renderItemCard(item, 'Listing'))
        ) : (
          <Text style={{ color: theme.tabIconDefault }}>No active listings.</Text>
        )}
      </View>

      <View style={{padding: 20}}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 16 , color: theme.text }}>Past Purchases</Text>
        {purchases.length > 0 ? (
          purchases.map(item => renderItemCard(item, 'Purchase'))
        ) : (
          <Text style={{ color: theme.tabIconDefault }}>No past purchases.</Text>
        )}
      </View>
      <TouchableOpacity 
        onPress={handleLogout} 
        style={{ 
          padding: 16, 
          marginHorizontal: 20, 
          marginBottom: 40, 
          borderWidth: 1, 
          borderRadius: 8, 
          alignItems: 'center',
          borderColor: theme.icon 
        }}
      >
        <Text style={{ 
          color: 'red', 
          fontSize: 16, 
          fontWeight: '700' 
        }}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}