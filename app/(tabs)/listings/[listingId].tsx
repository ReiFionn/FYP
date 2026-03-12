import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from "@/lib/supabase";
import { Button } from '@react-navigation/elements';
import { useStripe } from "@stripe/stripe-react-native";
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from 'react-native';

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
};

export default function ListingDetails() {
  const { listingId } = useLocalSearchParams(); 
  const colorScheme = useColorScheme() ?? 'light';
  const [listing, setListing] = useState<ListingWithEvent | null>(null);
  const [loading, setLoading] = useState(true);
  let aiPriceColour = "green"
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loadingPayment, setLoadingPayment] = useState(false);

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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
  };

    ///////////////////////////// PAYMENT LOGIC

const fetchPaymentSheetParams = async () => {
    if (!listing) return { paymentIntent: null, ephemeralKey: null, customer: null };

    const response = await fetch("/api/stripe-server", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listingId: listing.id 
      }),
    });
    const { paymentIntent, ephemeralKey, customer } = await response.json();

    return {
      paymentIntent,
      ephemeralKey,
      customer,
    };
  };

  const initializePaymentSheet = async () => {
    const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams();
    
    if (!paymentIntent) return;

    const { error } = await initPaymentSheet({
      merchantDisplayName: "Fair Play App",
      customerId: customer,
      customerEphemeralKeySecret: ephemeralKey,
      paymentIntentClientSecret: paymentIntent,
      allowsDelayedPaymentMethods: true,
      defaultBillingDetails: {
        name: "Jane Doe",
      },
      returnURL: "expostripe://stripe-redirect",
    });
    if (!error) {
      setLoadingPayment(true);
    }
  };

  const openPaymentSheet = async () => {
    const { error } = await presentPaymentSheet();

    if (error) {
      Alert.alert(`Error code: ${error.code}`, error.message);
    } else {
      Alert.alert("Success", "Your order is confirmed!");
    }
  };

  useEffect(() => {
    if (listing) {
      initializePaymentSheet();
    }
  }, [listing]);

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
      
      {/* <View style={{ height: 250, backgroundColor: Colors[colorScheme].icon, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors[colorScheme].tabIconDefault }}>Event Image Placeholder</Text>
      </View> */}

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
          <Button disabled={!loadingPayment} onPress={openPaymentSheet}>Buy</Button>
          <Button>Make Offer</Button>
        </View>

        <View style={{ height: 1, backgroundColor: Colors[colorScheme].icon, marginVertical: 20 }} />

        <Text style={{ color: Colors[colorScheme].text, fontSize: 18, fontWeight: '700' }}>Ticket Details</Text>
        <Text style={{ color: Colors[colorScheme].tabIconDefault, marginTop: 8 }}>
          xxxxxxxxxxxxxxxxxxxxxx
        </Text>

      </View>
    </ScrollView>
  );
}