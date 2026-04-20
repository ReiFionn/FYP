import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCheckout } from '@/hooks/useCheckout';
import { supabase } from "@/lib/supabase";
import { Button } from '@react-navigation/elements';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, Text, View } from 'react-native';

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
  active_buyer_id: string;
  status: string;
  ticket_received: boolean;
  ticket_sent: boolean;
  listing_price: number;
  ai_suggested_price: number;
  events: Event; 
  artist_image_url: string;
};
export default function ListingDetails() {
  const { listingId } = useLocalSearchParams(); 
  const colorScheme = useColorScheme() ?? 'light';
  const [listing, setListing] = useState<ListingWithEvent | null>(null);
  const [loading, setLoading] = useState(true);
  let aiPriceColour = "green"
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState<string | null>(null);  
  const { processCheckout } = useCheckout();

  useEffect(() => {
    fetchListing();
  }, [listingId]);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setBuyerId(user.id);
    };
    getUserId();
  }, []);

  const fetchListing = async () => {
    try {
      const { data, error } = await supabase
        .from('listings').select(`*, events (id, title, age_restriction, start_time, venue_name, city, address_line1, category)`).eq('id', listingId).single();
      if (error) throw error;
      if (data) setListing(data as unknown as ListingWithEvent);
    } catch (error) {
      console.error('Error fetching listing:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit' });
  };

  const handleBuy = async () => {
    if (!buyerId || !listing) return;
    setLoadingPayment(true);
    
    const success = await processCheckout(listing.id, buyerId);
    
    setLoadingPayment(false);

    if (success) {
      Alert.alert(
        "Payment Successful!", 
        "Your money is safe in escrow. We just notified the seller to transfer the ticket to you. On you receive it, confirm receipt here once it arrives.",
         [{ text: "Got it", onPress: () => fetchListing() }] 
      );
    }
  };

  const handleConfirmReceipt = async () => {
    Alert.alert(
      "Confirm Receipt",
      "Are you sure you have received the ticket? This will immediately release the funds to the seller.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          style: "default",
          onPress: async () => {
            setListing(prev => prev ? { ...prev, ticket_received: true } : null);

            const { data, error } = await supabase.functions.invoke('release-escrow', {
              body: { listingId: listing?.id }
            });

            if (error || data?.error) {
              setListing(prev => prev ? { ...prev, ticket_received: false } : null);
              Alert.alert("Payout Error", data?.error || error.message);
            } else {
              Alert.alert("Success", "Funds have been released to the seller!");
            }
          }
        }
      ]
    );
  };

  const handleConfirmSent = async () => {
    Alert.alert(
      "Confirm Transfer",
      "Are you sure you have transferred the ticket to the buyer?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, I sent it", 
          style: "default",
          onPress: async () => {
            setListing(prev => prev ? { ...prev, ticket_sent: true } : null);

            const { error } = await supabase
              .from('listings')
              .update({ 
                ticket_sent: true, 
                ticket_sent_at: new Date().toISOString() 
              })
              .eq('id', listing?.id);

            if (error) {
              setListing(prev => prev ? { ...prev, ticket_sent: false } : null);
              Alert.alert("Error", "Could not confirm transfer. Please try again.");
            }
          }
        }
      ]
    );
  };

  if (!listing || !listing.events) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme].background }}>
        <Text style={{ color: Colors[colorScheme].text }}>Listing not found.</Text>
      </View>
    );
  }

  const aiPriceColourLogic = (userPrice: number, aiPrice: number) => {
    const aiPriceFive = aiPrice/100*5

    if (userPrice >= aiPrice + (aiPriceFive*2))
      aiPriceColour = "red"
    else if (userPrice >= aiPrice + aiPriceFive)
      aiPriceColour = "orange"
    else
      aiPriceColour = "green"
  }

  console.log("Event Data from Supabase:", listing.events);
  aiPriceColourLogic(listing.listing_price, listing.ai_suggested_price)
  
  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      
      {listing.artist_image_url ? (
        <Image 
          source={{ uri: listing.artist_image_url }} 
          style={{ width: '100%', height: 250 }} 
          resizeMode="cover"
        />
      ) : (
        <View style={{ height: 250, backgroundColor: Colors[colorScheme].icon, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: Colors[colorScheme].tabIconDefault }}>Placeholder</Text>
        </View>
      )}

      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: Colors[colorScheme].text, flex: 1, marginRight: 12 }}>
            {listing.events.title}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: aiPriceColour }}>
            €{listing.listing_price}
          </Text>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={{ color: Colors[colorScheme].text, fontSize: 16, fontWeight: '500' }}>
            {formatDate(listing.events.start_time)}
          </Text>
          <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 16, marginTop: 4 }}>
            {listing.events.venue_name}, {listing.events.address_line1}, {listing.events.city}
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: Colors[colorScheme].icon, marginVertical: 20 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {listing.status === 'sold' ? (
            buyerId === listing.active_buyer_id ? (
              listing.ticket_received ? (
                <View style={{ padding: 15, backgroundColor: '#dcfce7', borderRadius: 8, width: '100%', alignItems: 'center' }}>
                  <Text style={{ color: '#166534', fontSize: 18, fontWeight: '700' }}>Ticket Received!</Text>
                  <Text style={{ color: '#166534', marginTop: 4 }}>Funds have been released to the seller.</Text>
                </View>
              ) : listing.ticket_sent ? (
                <View style={{ padding: 15, backgroundColor: '#e0f2fe', borderRadius: 8, width: '100%' }}>
                  <Text style={{ color: '#0369a1', fontSize: 18, fontWeight: '700' }}>Action Required</Text>
                  <Text style={{ color: '#0369a1', marginTop: 8, marginBottom: 15, lineHeight: 22 }}>
                    The seller has confirmed transferring the ticket to you. Please click below to release their payout.
                  </Text>
                  <Button onPress={handleConfirmReceipt} style={{ backgroundColor: '#22c55e', width: '100%' }}>
                    Confirm Ticket Received
                  </Button>
                </View>
              ) : (
                <View style={{ padding: 15, backgroundColor: '#f3f4f6', borderRadius: 8, width: '100%' }}>
                  <Text style={{ color: '#374151', fontSize: 18, fontWeight: '700' }}>Awaiting Transfer</Text>
                  <Text style={{ color: '#4b5563', marginTop: 8, lineHeight: 22 }}>
                    Your payment is secure in escrow. We are waiting for the seller to transfer the ticket. This page will update once they send it.
                  </Text>
                </View>
              )
            ) : buyerId === listing.seller_id ? (
              listing.ticket_sent ? (
                <View style={{ padding: 15, backgroundColor: '#fef08a', borderRadius: 8, width: '100%', alignItems: 'center' }}>
                  <Text style={{ color: '#854d0e', fontSize: 18, fontWeight: '700' }}>Ticket Transferred!</Text>
                  <Text style={{ color: '#854d0e', marginTop: 4, textAlign: 'center' }}>Awaiting buyer confirmation to release your payout.</Text>
                </View>
              ) : (
                <View style={{ padding: 15, backgroundColor: '#fef08a', borderRadius: 8, width: '100%' }}>
                  <Text style={{ color: '#854d0e', fontSize: 18, fontWeight: '700' }}>Next Step: Transfer Ticket</Text>
                  <Text style={{ color: '#854d0e', marginTop: 8, marginBottom: 15, lineHeight: 22 }}>
                    Please transfer the ticket to the buyer. Once transferred, confirm below.
                  </Text>
                  <Button onPress={handleConfirmSent} style={{ backgroundColor: '#ca8a04', width: '100%' }}>
                    I Have Transferred the Ticket
                  </Button>
                </View>
              )
            ) : (
              <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>Sold</Text>
            )
          ) : (
            <>
              <Button disabled={loadingPayment} onPress={handleBuy}>Buy</Button>
              <Button onPress={() => router.push({ 
                pathname: `/chat/[otherUserId]`, 
                params: { otherUserId: listing.seller_id, listingId: listing.id } 
              })}>Make Offer</Button>
            </>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: Colors[colorScheme].icon, marginVertical: 20 }} />

        <Text style={{ color: Colors[colorScheme].text, fontSize: 18, fontWeight: '700' }}>Ticket Details</Text>
        <View style={{ marginLeft: 20 }}>
          <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>Seller: {listing.seller_id}</Text>
          <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>AI Suggested Price: €{listing.ai_suggested_price}</Text>
          <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>Event:</Text>
          
          <View style={{ marginLeft: 20 }}>
            <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>Title: {listing.events.title}</Text>
            <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>Start Time: {formatDate(listing.events.start_time)}</Text>
            <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>Category: {listing.events.category}</Text>
            <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>Venue Name: {listing.events.venue_name}</Text>
            <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>Venue Address:</Text>
            
            <View style={{ marginLeft: 20 }}>
              <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>{listing.events.address_line1}</Text>
              <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>{listing.events.city}</Text>
              <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 18, fontWeight: '700' }}>{listing.events.region}</Text>
            </View>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}