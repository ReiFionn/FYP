import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function UserListings() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const [myListings, setMyListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        fetchMyListings();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchMyListings();
        setRefreshing(false);
    };

    const fetchMyListings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUserId(user.id);

            const { data, error } = await supabase
                .from('listings')
                .select(`
                    id, 
                    listing_price, 
                    status, 
                    ticket_sent,
                    ticket_received,
                    ai_suggested_price,
                    events (title, start_time, venue_name, city),
                    reviews ( reviewer_id )
                `)
                .eq('seller_id', user.id)
                .order('created_updated_at', { ascending: false });

            if (error) throw error;
            if (data) setMyListings(data);
        } catch (error) {
            console.error('Error fetching listings:', error);
        } finally {
            setLoading(false);
        }
    };

    const getAiPriceColour = (userPrice?: number, aiPrice?: number) => {
        if (userPrice === undefined || aiPrice === undefined) return "#A4CBB4"; 
        const aiPriceFive = (aiPrice / 100) * 5;
        
        if (userPrice >= aiPrice + (aiPriceFive * 2)) return theme.error;
        if (userPrice >= aiPrice + aiPriceFive) return "#E2C28A";
        return "#A4CBB4";
    };

    if (loading && !refreshing) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <ScrollView 
            style={{ flex: 1, backgroundColor: theme.background, padding: 20 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
            }
        >
            {myListings.length === 0 ? (
                <Text style={{ color: theme.tabIconDefault, fontSize: 16, marginTop: 20, textAlign: 'center' }}>
                    You have no active or past listings.
                </Text>
            ) : (
                myListings.map((listing) => {
                    const cardPriceColour = getAiPriceColour(listing.listing_price, listing.ai_suggested_price);
                    const hasRated = listing.reviews?.some((r: any) => r.reviewer_id === currentUserId);

                    return (
                        <TouchableOpacity
                            key={listing.id}
                            onPress={() => router.push(`/listings/${listing.id}`)}
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
                                        {listing.events?.title || 'Unknown Event'}
                                    </Text>
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: cardPriceColour }}>
                                        €{listing.listing_price}
                                    </Text>
                                </View>

                                <View style={{ marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={{ color: theme.tabIconDefault, fontSize: 14 }}>
                                            {listing.events?.start_time ? new Date(listing.events.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : ''} • {listing.events?.venue_name}
                                        </Text>
                                        <Text style={{ color: theme.tabIconDefault, fontSize: 12, marginTop: 4 }}>
                                            {listing.events?.city}
                                        </Text>
                                    </View>

                                    <View>
                                        {listing.status === 'active' && (
                                            <Text style={{ color: theme.tint, backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Active</Text>
                                        )}
                                        {listing.status === 'pending' && (
                                            <Text style={{ color: theme.tint, backgroundColor: '#E2C28A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Pending</Text>
                                        )}
                                        {listing.status === 'sold' && !listing.ticket_sent && (
                                            <Text style={{ color: theme.tint, backgroundColor: theme.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Needs Transfer</Text>
                                        )}
                                        {listing.status === 'sold' && listing.ticket_sent && !listing.ticket_received && (
                                            <Text style={{ color: theme.tint, backgroundColor: '#E2C28A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Awaiting Buyer</Text>
                                        )}
                                        {listing.status === 'sold' && listing.ticket_received && !hasRated && (
                                            <Text style={{ color: theme.tint, backgroundColor: theme.text, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Rate Buyer</Text>
                                        )}
                                        {listing.status === 'sold' && listing.ticket_received && hasRated && (
                                            <Text style={{ color: theme.tint, backgroundColor: '#A4CBB4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Complete</Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })
            )}
        </ScrollView>
    );
}