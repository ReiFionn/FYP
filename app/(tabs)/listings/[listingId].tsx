import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from "@/lib/supabase";
import { Button } from '@react-navigation/elements';
import { useStripe } from "@stripe/stripe-react-native";
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import { useCheckout } from '@/hooks/useCheckout';

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
    await processCheckout(listing.id, buyerId);
    setLoadingPayment(false);
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
          <Button disabled={!loadingPayment} onPress={useCheckout}>Buy</Button>
          <Button onPress={() => router.push({ 
            pathname: `/chat/[otherUserId]`, 
            params: { otherUserId: listing.seller_id, listingId: listing.id } 
          })}>Make Offer</Button>
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