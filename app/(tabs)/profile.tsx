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

type Review = {
  id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: {
    display_name: string;
    picture_url: string | null;
  };
};

export default function Profile() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'listings' | 'purchases' | 'reviews'>('listings');

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

      const [profile, listings, purchases, reviews] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('listings').select('*, events(title, start_time, venue_name, city)').eq('seller_id', user.id).neq('status', 'sold'),
        supabase.from('listings').select('*, events(title, start_time, venue_name, city)').eq('active_buyer_id', user.id),
        supabase.from('reviews').select('id, reviewer_id, rating, comment, created_at, profiles!reviews_reviewer_id_fkey(display_name, picture_url)').eq('reviewee_id', user.id).order('created_at', { ascending: false })
      ]);

      if (profile.data) setProfile(profile.data);
      if (listings.data) setListings(listings.data);
      if (purchases.data) setPurchases(purchases.data);
      if (reviews.data) setReviews(reviews.data as unknown as Review[]);

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
    if (userPrice === undefined || aiPrice === undefined) return "#A4CBB4";
    
    const marginOrange = aiPrice * 0.10;
    const marginRed = aiPrice * 0.25;
    
    if (userPrice >= aiPrice + marginRed) return theme.error;
    if (userPrice >= aiPrice + marginOrange) return "#E2C28A";
    
    return "#A4CBB4";
  };

  const renderItemCard = (item: Item, type: 'Listing' | 'Purchase') => {
    const cardPriceColour = getAiPriceColour(item.listing_price, item.ai_suggested_price);
    return (
      <TouchableOpacity key={item.id} onPress={() => router.push(`/listings/${item.id}`)} style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.icon, borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, flex: 1, marginRight: 8 }}>{item.events?.title || 'Unknown Event'}</Text>
            {type === 'Listing' && <Text style={{ fontSize: 16, fontWeight: "700", color: cardPriceColour }}>€{item.listing_price}</Text>}
          </View>
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: theme.tabIconDefault, fontSize: 14 }}>{item.events?.start_time ? new Date(item.events.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : ''} • {item.events?.venue_name}</Text>
            <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginTop: 4 }}>{item.events?.city}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  };

  const renderReviewCard = (review: Review) => {
    return (
      <TouchableOpacity 
        key={review.id} 
        onPress={() => router.push(`/user/${review.reviewer_id}`)}
        style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.icon, borderRadius: 16, marginBottom: 16, padding: 16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Image 
            source={{ uri: review.profiles?.picture_url || 'https://cdn.vectorstock.com/i/500p/08/19/gray-human-icon-profile-placeholder-vector-35850819.jpg' }} 
            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: theme.icon }} 
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
              {review.profiles?.display_name || 'Unknown User'}
            </Text>
            <Text style={{ color: theme.tint, letterSpacing: 2, fontSize: 14 }}>
              {renderStars(review.rating)} <Text style={{ color: theme.tabIconDefault, fontSize: 12, letterSpacing: 0 }}>({Number(review.rating).toFixed(1)}/5)</Text>
            </Text>
          </View>
          <Text style={{ color: theme.tabIconDefault, fontSize: 12 }}>
            {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        
        {review.comment && review.comment.trim() !== "" && (
          <Text style={{ color: theme.text, fontSize: 14, marginTop: 4, lineHeight: 20 }}>
            {review.comment}
          </Text>
        )}
      </TouchableOpacity>
    );
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
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
        <Text style={{ fontSize: 18, letterSpacing: 2, color: theme.text }}>
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

      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 30, borderBottomWidth: 1, borderColor: theme.icon }}>
        <TouchableOpacity onPress={() => setActiveTab('listings')} style={{ flex: 1, paddingBottom: 12, borderBottomWidth: activeTab === 'listings' ? 2 : 0, borderColor: theme.text }}>
          <Text style={{ textAlign: 'center', fontWeight: '700', color: activeTab === 'listings' ? theme.text : theme.tabIconDefault }}>Listings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('purchases')} style={{ flex: 1, paddingBottom: 12, borderBottomWidth: activeTab === 'purchases' ? 2 : 0, borderColor: theme.text }}>
          <Text style={{ textAlign: 'center', fontWeight: '700', color: activeTab === 'purchases' ? theme.text : theme.tabIconDefault }}>Purchases</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('reviews')} style={{ flex: 1, paddingBottom: 12, borderBottomWidth: activeTab === 'reviews' ? 2 : 0, borderColor: theme.text }}>
          <Text style={{ textAlign: 'center', fontWeight: '700', color: activeTab === 'reviews' ? theme.text : theme.tabIconDefault }}>Reviews</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 20 }}>
        {activeTab === 'listings' && (
          listings.length > 0 ? listings.map(item => renderItemCard(item, 'Listing')) : <Text style={{ color: theme.tabIconDefault, textAlign: 'center', marginTop: 20 }}>No active listings.</Text>
        )}
        
        {activeTab === 'purchases' && (
          purchases.length > 0 ? purchases.map(item => renderItemCard(item, 'Purchase')) : <Text style={{ color: theme.tabIconDefault, textAlign: 'center', marginTop: 20 }}>No past purchases.</Text>
        )}

        {activeTab === 'reviews' && (
          reviews.length > 0 ? reviews.map(review => renderReviewCard(review)) : <Text style={{ color: theme.tabIconDefault, textAlign: 'center', marginTop: 20 }}>No reviews yet.</Text>
        )}
      </View>

      <TouchableOpacity onPress={handleLogout} style={{ padding: 16, marginHorizontal: 20, marginBottom: 40, borderWidth: 1, borderRadius: 8, alignItems: 'center', borderColor: theme.icon }}>
        <Text style={{ color: theme.error, fontSize: 16, fontWeight: '700' }}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}