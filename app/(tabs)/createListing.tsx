import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

export default function CreateListingTest() {
  const colorScheme = useColorScheme() ?? 'light';
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [section, setSection] = useState('');
  const [row, setRow] = useState('');
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');

//   type Event = {
//   id: string;
//   title: string;
//   start_time: string;
//   venue_name: string;
//   address_line1: string;
//   city: string;
//   region: string;
//   category: string;
// };

// type ListingWithEvent = {
//   id: string;
//   seller_id: string;
//   status: string;
//   listing_price: number;
//   events: Event; 
// };

  const handleCreateListing = async () => {
    if (!price || isNaN(Number(price))) {
      Alert.alert('Error', 'Please enter a valid price.');
      return;
    }

    setLoading(true);

try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert([
          {
            title: title,
            start_time: date.toISOString(),
            venue_name: venueName, 
            address_line1: address, 
            city: city, 
            region: region, 
            category: category 
          }
        ])
        .select()
        .single();

      if (eventError) throw eventError;

      const { data: newListing, error: listingError } = await supabase
        .from('listings')
        .insert([
          {
            seller_id: user.id,
            event_id: newEvent.id,
            status: 'active',
            listing_price: parseFloat(price),
          }
        ])
        .select()
        .single();

      if (listingError) throw listingError;

      Alert.alert('Success!', 'Event and Listing created!');
      router.push(`/listings/${newListing.id}`);

    } catch (error: any) {
      console.error('Insert error:', error);
      Alert.alert('Database Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onChangeDate = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const showDatepicker = () => {
    setShowPicker(true);
  };


return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}
    >
      <ScrollView 
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 20, marginTop: 40 }}>
          Create Listing
        </Text>

        <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600' }}>Event Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Taylor Swift - Eras Tour"
          placeholderTextColor={Colors[colorScheme].tabIconDefault}
          style={{ backgroundColor: Colors[colorScheme].icon, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 20 }}
        />
        {/* ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}
        <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600' }}>Price (€)</Text>
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="150"
          placeholderTextColor={Colors[colorScheme].tabIconDefault}
          keyboardType="numeric"
          style={{ backgroundColor: Colors[colorScheme].icon, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 20 }}
        />
        {/* ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}
        <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600' }}>Event Date & Time</Text>
        <TouchableOpacity 
          onPress={showDatepicker}
          style={{ backgroundColor: Colors[colorScheme].icon, padding: 16, borderRadius: 12, marginBottom: 20 }}
        >
          <Text style={{ color: Colors[colorScheme].text }}>
            {date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={date}
            mode="datetime"
            is24Hour={true}
            display="default"
            onChange={onChangeDate}
            style={Platform.OS === 'ios' ? { alignSelf: 'center', marginBottom: 20 } : {}}
          />
        )}
        {/* ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}
        <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600' }}>Venue</Text>
        <View style={{ zIndex: 1000, marginBottom: 20 }}> 
          <GooglePlacesAutocomplete
            placeholder="Search for venue"
            fetchDetails={true}
            disableScroll={true}
            onPress={(data, details = null) => {
              if (!details) return;
              setVenueName(data.structured_formatting.main_text);

              let foundCity = '';
              let foundRegion = '';
              details.address_components.forEach(component => {
                if (component.types.includes('locality')) foundCity = component.long_name;
                if (component.types.includes('administrative_area_level_1')) foundRegion = component.short_name;
              });

              setCity(foundCity);
              setRegion(foundRegion);
              setAddress(details.formatted_address?.split(',')[0] || '');
            }}
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
              language: 'en',
              types: 'establishment',
            }}
            styles={{
              container: {
                flex: 0,
              },
              textInput: {
                backgroundColor: Colors[colorScheme].icon,
                color: Colors[colorScheme].text,
                paddingHorizontal: 16,
                height: 50,
                borderRadius: 12,
              },
              listView: {
                position: 'absolute',
                top: 55,
                width: '100%',
                backgroundColor: Colors[colorScheme].background,
                borderRadius: 8,
                elevation: 5,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                zIndex: 1000,
              },
              description: {
                color: Colors[colorScheme].text,
              }
            }}
          />
        </View>
        
        {venueName ? (
          <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 12, marginBottom: 20, marginTop: -10 }}>
            Located in: {city}, {region}
          </Text>
        ) : null}
        {/* ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}
        <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600' }}>If Applicable</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600' }}>Section</Text>
            <TextInput
              value={section}
              onChangeText={setSection}
              placeholder="e.g. 102"
              placeholderTextColor={Colors[colorScheme].tabIconDefault}
              style={{ backgroundColor: Colors[colorScheme].icon, color: Colors[colorScheme].text, padding: 16, borderRadius: 12 }}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600' }}>Row</Text>
            <TextInput
              value={row}
              onChangeText={setRow}
              placeholder="e.g. A"
              placeholderTextColor={Colors[colorScheme].tabIconDefault}
              style={{ backgroundColor: Colors[colorScheme].icon, color: Colors[colorScheme].text, padding: 16, borderRadius: 12 }}
            />
          </View>
        </View>
        {/* ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}
        <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600' }}>Category</Text>
        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. Music, Sports"
          placeholderTextColor={Colors[colorScheme].tabIconDefault}
          style={{ backgroundColor: Colors[colorScheme].icon, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 30 }}
        />
        {/* ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}
        <TouchableOpacity
          onPress={handleCreateListing}
          disabled={loading}
          style={{ backgroundColor: '#0a7ea4', padding: 16, borderRadius: 12, alignItems: 'center', opacity: loading ? 0.7 : 1, marginBottom: 40 }}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Create Listing</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}