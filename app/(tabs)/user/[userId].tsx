import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

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

export default function UserProfile() {
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const [profile, setProfile] = useState<Profile | null>(null);
    const [listings, setListings] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, [userId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const fetchData = async () => {
        if (!userId) {
        setLoading(false);
        return;
        }

        try {
        const [profileRes, listingsRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
            supabase.from('listings').select('*, events(title, start_time, venue_name, city)').eq('seller_id', userId).eq('status', 'active')
        ]);

        if (profileRes.error) console.error("Profile Error:", profileRes.error.message);
        if (listingsRes.error) console.error("Listings Error:", listingsRes.error.message);

        if (profileRes.data) setProfile(profileRes.data);
        if (listingsRes.data) setListings(listingsRes.data);
        } catch (error) {
        console.error("Error fetching data:", error);
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
        const aiPriceFive = (aiPrice / 100) * 5;
        if (userPrice >= aiPrice + (aiPriceFive * 2)) return theme.error;
        if (userPrice >= aiPrice + aiPriceFive) return "#E2C28A";
        return "#A4CBB4";
    };

    const renderItemCard = (item: Item) => {
        const cardPriceColour = getAiPriceColour(item.listing_price, item.ai_suggested_price);

        return (
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
                <Text style={{ fontSize: 16, fontWeight: "700", color: cardPriceColour }}>
                €{item.listing_price}
                </Text>
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
        );
    };

    if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}><ActivityIndicator size="large" color={theme.text} /></View>;
    if (!profile) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}><Text style={{ color: theme.text }}>User not found.</Text></View>;

    return (
        <ScrollView 
        style={{ flex: 1, backgroundColor: theme.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
        <View style={{ alignItems: 'center', paddingVertical: 30, borderBottomWidth: 1, borderBottomColor: theme.icon }}>
            <Image
            source={{ uri: profile?.picture_url || 'https://cdn.vectorstock.com/i/500p/08/19/gray-human-icon-profile-placeholder-vector-35850819.jpg' }}
            style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 12, borderWidth: 2, borderColor: theme.icon, backgroundColor: theme.background }}
            />
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4, color: theme.text }}>
            {profile?.display_name}
            </Text>
            <Text style={{ fontSize: 18, letterSpacing: 2, color: theme.text }}>
            {renderStars(profile?.trust_rating || 0)} <Text style={{ color: theme.tabIconDefault, fontSize: 14, letterSpacing: 0 }}>({Number(profile?.trust_rating || 0).toFixed(1)}/5)</Text>
            </Text>
        </View>

        <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 16, color: theme.text }}>Current Listings</Text>
            {listings.length > 0 ? (
            listings.map(item => renderItemCard(item))
            ) : (
            <Text style={{ color: theme.tabIconDefault }}>No active listings.</Text>
            )}
        </View>
        </ScrollView>
    );
}