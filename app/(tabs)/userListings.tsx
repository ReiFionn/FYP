import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function UserListings() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const [myListings, setMyListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyListings();
    }, []);

    const fetchMyListings = async () => {
        try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('listings')
            .select(`
            id, 
            listing_price, 
            status, 
            ticket_sent, 
            ai_suggested_price,
            events (title, start_time, venue_name, city)
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
        if (userPrice === undefined || aiPrice === undefined) return "green"; 
        const aiPriceFive = (aiPrice / 100) * 5;
        
        if (userPrice >= aiPrice + (aiPriceFive * 2)) return "red";
        if (userPrice >= aiPrice + aiPriceFive) return "orange";
        return "green";
    };

    if (loading) {
        return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
            <ActivityIndicator size="large" />
        </View>
        );
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.background, padding: 20 }}>
        {myListings.length === 0 ? (
            <Text style={{ color: theme.tabIconDefault, fontSize: 16, marginTop: 20, textAlign: 'center' }}>
            You have no active or past listings.
            </Text>
        ) : (
            myListings.map((listing) => {
            const cardPriceColour = getAiPriceColour(listing.listing_price, listing.ai_suggested_price);

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
                        <Text style={{ color: '#0284c7', backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Active</Text>
                        )}
                        {listing.status === 'pending' && (
                        <Text style={{ color: '#d97706', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Pending</Text>
                        )}
                        {listing.status === 'sold' && !listing.ticket_sent && (
                        <Text style={{ color: '#dc2626', backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Needs Transfer</Text>
                        )}
                        {listing.status === 'sold' && listing.ticket_sent && (
                        <Text style={{ color: '#166534', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', overflow: 'hidden', fontSize: 12 }}>Sent</Text>
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