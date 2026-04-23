import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGemini } from '@/hooks/useGemini';
import { supabase } from '@/lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

export default function CreateListingTest() {
  const [isAllowed, setIsAllowed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const checkStripeConnection = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isActive) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', user.id)
          .single();

        if (!profile?.stripe_account_id) {
          return blockUser("Set Up Payouts");
        }

        const { data: statusData, error } = await supabase.functions.invoke('check-stripe-status', {
          body: { accountId: profile.stripe_account_id }
        });

        if (error || !statusData?.isComplete) {
          return blockUser("Finish Setup");
        }

        if (isActive) setIsAllowed(true);
      };

      const blockUser = (actionText: string) => {
        if (!isActive) return;
        setIsAllowed(false);
        Alert.alert(
          "Payouts Not Configured",
          "You must complete your Stripe bank connection to receive funds before you can sell tickets.",
          [
            { text: "Cancel", style: "cancel", onPress: () => router.back() },
            { text: actionText, onPress: () => router.push('/userSettings') } 
          ]
        );
      };

      checkStripeConnection();

      return () => { isActive = false; };
    }, [])
  );

  if (!isAllowed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const colorScheme = useColorScheme() ?? 'light';
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [section, setSection] = useState('');
  const [row, setRow] = useState('');
  const [ticketType, setTicketType] = useState('');
  const [date, setDate] = useState(new Date());
  const [dateMetadata, setDateMetadata] = useState(new Date());
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [category, setCategory] = useState('');
  const [ageRestriction, setAgeRestriction] = useState('');
  const [platformOfPuchase, setPlatformOfPurchase] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showPickerMetadata, setShowPickerMetadata] = useState(false);
  const { askGemini } = useGemini();

  const resetForm = () => {
    setTitle('');
    setPrice('');
    setSection('');
    setRow('');
    setTicketType('');
    setDate(new Date());
    setDateMetadata(new Date());
    setVenueName('');
    setAddress('');
    setCity('');
    setRegion('');
    setPlaceId('');
    setCategory('');
    setAgeRestriction('');
    setPlatformOfPurchase('');
    setReceiptUri(null);
  };

  const categoryData = [
    { label: 'Pop', value: 'Pop' },
    { label: 'Rock', value: 'Rock' },
    { label: 'Electronic / Dance', value: 'Electronic' },
    { label: 'Hip-Hop / Rap', value: 'Rap' },
    { label: 'Indie / Alternative', value: 'Indie' },
    { label: 'R&B / Soul', value: 'R&B' },
    { label: 'Country', value: 'Country' },
    { label: 'Jazz / Blues', value: 'Jazz' },
    { label: 'Classical', value: 'Classical' },
    { label: 'Comedy', value: 'Comedy' },
    { label: 'Theater / Arts', value: 'Theater' },
    { label: 'Sports', value: 'Sports' },
    { label: 'Festival', value: 'Festival' },
    { label: 'Other', value: 'Other' },
  ];

  const ageData = [
    { label: 'All Ages', value: 'All Ages' },
    { label: '14+', value: '14+' },
    { label: '16+', value: '16+' },
    { label: '18+', value: '18+' },
    { label: '21+', value: '21+' },
  ];

  const ticketTypeData = [
    { label: 'General Admission (GA)', value: 'General Admission' },
    { label: 'Seated', value: 'Seated' },
    { label: 'VIP', value: 'VIP' },
    { label: 'Early Entry', value: 'Early Entry' },
    { label: 'Meet & Greet', value: 'Meet & Greet' },
    { label: 'Multi-Day Pass', value: 'Multi-Day Pass' },
  ];

  const handleCreateListing = async () => {
    if (!title || !price || !date || !venueName || !category || !ageRestriction || !ticketType || !platformOfPuchase || !dateMetadata) {
      Alert.alert('Missing Fields', 'Please fill out all required fields before submitting.');
      return;
    }

    if (isNaN(Number(price))) {
      Alert.alert('Invalid Price', 'Please enter a valid number for the price.');
      return;
    }

    setLoading(true);
    let currentUser;

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Not authenticated");
      currentUser = authData.user;

      const { data: duplicateId, error: rpcError } = await supabase.rpc('find_duplicate_event', {
        p_title: title,
        p_place_id: placeId,
        p_start_time: date.toISOString()
      });

      if (rpcError) throw rpcError;

      let finalEventId;
      if (duplicateId) {
        finalEventId = duplicateId;
      } else {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .insert([{
            title: title,
            start_time: date.toISOString(),
            venue_name: venueName,
            address_line1: address,
            city: city,
            region: region,
            category: category,
            age_restriction: ageRestriction, 
            google_place_id: placeId
          }])
          .select('id')
          .single();

        if (eventError) throw eventError;
        finalEventId = (eventData as any).id;
      }

      let finalAiPrice = null;
      const targetSection = section || 'GA';
      const targetType = ticketType || 'General Admission';

      if (duplicateId) {
        const { data: existingListing } = await supabase
          .from('listings')
          .select('ai_suggested_price')
          .eq('event_id', finalEventId)
          .eq('original_purchase_metadata->>section', targetSection)
          .eq('original_purchase_metadata->>type', targetType) 
          .limit(1)
          .maybeSingle();

        if (existingListing?.ai_suggested_price) {
          finalAiPrice = existingListing.ai_suggested_price;
        }
      }

      if (!finalAiPrice) {
        const sectionContext = section ? ` in section "${section}"` : '';
        const prompt = `You are a ticket pricing AI. Suggest a price for what this ticket would have been bought for in Euros: "${title}" at "${venueName}, ${address}, ${city}, ${region}"${sectionContext}. The ticket is a "${ticketType}" tier ticket. The ticket was purchased from ${platformOfPuchase} at ${dateMetadata}. Return ONLY a valid number, no symbols, no text.`;
        
        const aiResponse = await askGemini(prompt);
        finalAiPrice = (aiResponse && !isNaN(Number(aiResponse)))
          ? parseFloat(aiResponse)
          : parseFloat(price) * 0.9;
      }

      let receiptUrl = null;
      if (receiptUri) {
        const response = await fetch(receiptUri);
        const blob = await response.blob();
        const filename = `${currentUser.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('ticket_proofs')
          .upload(filename, blob);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('ticket_proofs')
          .getPublicUrl(filename);

        receiptUrl = publicUrlData.publicUrl;
      }

      const { data: imgData } = await supabase.functions.invoke('get-artist-image', {
        body: { artistName: title },
      });
      const fetchedArtistImageUrl = imgData?.imageUrl || null;

      const { data: newListing, error: listingError } = await supabase
        .from('listings')
        .insert([{
          seller_id: currentUser.id,
          event_id: finalEventId,
          status: 'active',
          listing_price: parseFloat(price),
          ai_suggested_price: finalAiPrice,
          artist_image_url: fetchedArtistImageUrl,
          original_purchase_metadata: {
            source: platformOfPuchase || "App Form",
            time: dateMetadata.toISOString(),
            type: ticketType, 
            section: section || 'GA',
            row: row || 'N/A',
            receipt_image: receiptUrl
          }
        }])
        .select()
        .single();

      if (listingError) throw listingError;

      Alert.alert('Success!', 'Event and Listing created!');
      resetForm();
      router.push(`/listings/${newListing.id}`);

    } catch (error: any) {
      console.error('Insert error:', error);
      Alert.alert('Database Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: Colors[colorScheme].text, marginBottom: 24, marginTop: 40, paddingHorizontal: 4 }}>
          Create Listing
        </Text>

        <View style={{ backgroundColor: Colors[colorScheme].card, padding: 20, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors[colorScheme].border, shadowColor: Colors[colorScheme].tint, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors[colorScheme].text, marginBottom: 16 }}>Event Details</Text>

          <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Event Title <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Taylor Swift - Eras Tour"
            placeholderTextColor={Colors[colorScheme].tabIconDefault}
            style={{ backgroundColor: Colors[colorScheme].tint, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 }}
          />

          <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Event Date & Time <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
          <TouchableOpacity onPress={() => setShowPicker(true)} style={{ backgroundColor: Colors[colorScheme].tint, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 }}>
            <Text style={{ color: Colors[colorScheme].text, fontSize: 16 }}>
              {date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          </TouchableOpacity>
          {showPicker && (
            <DateTimePicker
              value={date}
              mode="datetime"
              display="default"
              onChange={(e, d) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (d) setDate(d);
              }}
              style={Platform.OS === 'ios' ? { alignSelf: 'center', marginBottom: 16 } : {}}
            />
          )}

          <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Venue <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
          <View style={{ zIndex: 1000, marginBottom: 16 }}>
            <GooglePlacesAutocomplete
              placeholder="Search for venue"
              fetchDetails={true}
              disableScroll={true}
              onPress={(data, details = null) => {
                if (!details) return;
                setVenueName(data.structured_formatting.main_text);
                setPlaceId(data.place_id);

                let foundCity = '', foundRegion = '';
                details.address_components.forEach(c => {
                  if (c.types.includes('locality')) foundCity = c.long_name;
                  if (c.types.includes('administrative_area_level_1')) foundRegion = c.short_name;
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
                textInput: { backgroundColor: Colors[colorScheme].tint, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 0, height: 52 },
                listView: { position: 'absolute', top: 60, width: '100%', backgroundColor: Colors[colorScheme].card, borderRadius: 12, elevation: 5, shadowColor: Colors[colorScheme].tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, zIndex: 1000 },
                description: { color: Colors[colorScheme].text }
              }}
            />
          </View>
          {venueName ? (
            <Text style={{ color: Colors[colorScheme].tabIconDefault, fontSize: 12, marginBottom: 16, marginTop: -8 }}>
              {city}, {region}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Category <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
              <Dropdown
                data={categoryData}
                labelField="label"
                valueField="value"
                placeholder="Select..."
                value={category}
                onChange={item => setCategory(item.value)}
                style={{ backgroundColor: Colors[colorScheme].tint, padding: 16, borderRadius: 12, marginBottom: 16 }}
                selectedTextStyle={{ color: Colors[colorScheme].text, fontSize: 15 }}
                placeholderStyle={{ color: Colors[colorScheme].tabIconDefault, fontSize: 15 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Age Limit <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
              <Dropdown
                data={ageData}
                labelField="label"
                valueField="value"
                placeholder="Select..."
                value={ageRestriction}
                onChange={item => setAgeRestriction(item.value)}
                style={{ backgroundColor: Colors[colorScheme].tint, padding: 16, borderRadius: 12, marginBottom: 16 }}
                selectedTextStyle={{ color: Colors[colorScheme].text, fontSize: 15 }}
                placeholderStyle={{ color: Colors[colorScheme].tabIconDefault, fontSize: 15 }}
              />
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: Colors[colorScheme].card, padding: 20, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors[colorScheme].border, shadowColor: Colors[colorScheme].tint, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors[colorScheme].text, marginBottom: 16 }}>Ticket Details</Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Price (€) <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={Colors[colorScheme].tabIconDefault}
                keyboardType="numeric"
                style={{ backgroundColor: Colors[colorScheme].tint, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Ticket Type <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
              <Dropdown
                data={ticketTypeData}
                labelField="label"
                valueField="value"
                placeholder="Type..."
                value={ticketType}
                onChange={item => setTicketType(item.value)}
                style={{ backgroundColor: Colors[colorScheme].tint, padding: 16, borderRadius: 12, marginBottom: 16 }}
                selectedTextStyle={{ color: Colors[colorScheme].text, fontSize: 15 }}
                placeholderStyle={{ color: Colors[colorScheme].tabIconDefault, fontSize: 15 }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Section (Optional)</Text>
              <TextInput
                value={section}
                onChangeText={setSection}
                placeholder="e.g. 102"
                placeholderTextColor={Colors[colorScheme].tabIconDefault}
                style={{ backgroundColor: Colors[colorScheme].tint, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Row (Optional)</Text>
              <TextInput
                value={row}
                onChangeText={setRow}
                placeholder="e.g. A"
                placeholderTextColor={Colors[colorScheme].tabIconDefault}
                style={{ backgroundColor: Colors[colorScheme].tint, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 }}
              />
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: Colors[colorScheme].card, padding: 20, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors[colorScheme].border, shadowColor: Colors[colorScheme].tint, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors[colorScheme].text, marginBottom: 16 }}>Original Purchase</Text>

          <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Platform of Purchase <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
          <TextInput
            value={platformOfPuchase}
            onChangeText={setPlatformOfPurchase}
            placeholder="e.g. Ticketmaster, Dice, RA"
            placeholderTextColor={Colors[colorScheme].tabIconDefault}
            style={{ backgroundColor: Colors[colorScheme].tint, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 }}
          />

          <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Date of Purchase <Text style={{ color: Colors[colorScheme].error }}>*</Text></Text>
          <TouchableOpacity onPress={() => setShowPickerMetadata(true)} style={{ backgroundColor: Colors[colorScheme].tint, color: Colors[colorScheme].text, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 }}>
            <Text style={{ color: Colors[colorScheme].text, fontSize: 16 }}>
              {dateMetadata.toLocaleString([], { dateStyle: 'medium' })}
            </Text>
          </TouchableOpacity>
          {showPickerMetadata && (
            <DateTimePicker
              value={dateMetadata}
              mode="date"
              display="default"
              onChange={(e, d) => {
                if (Platform.OS === 'android') setShowPickerMetadata(false);
                if (d) setDateMetadata(d);
              }}
              style={Platform.OS === 'ios' ? { alignSelf: 'center', marginBottom: 16 } : {}}
            />
          )}

          <Text style={{ color: Colors[colorScheme].text, marginBottom: 8, fontWeight: '600', fontSize: 14 }}>Proof of Purchase (Optional)</Text>
          <TouchableOpacity
            onPress={pickImage}
            style={{
              backgroundColor: Colors[colorScheme].tint,
              padding: receiptUri ? 0 : 20,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              height: receiptUri ? 150 : 100,
              overflow: 'hidden',
              borderWidth: receiptUri ? 0 : 1,
              borderColor: Colors[colorScheme].border,
              borderStyle: 'dashed'
            }}
          >
            {receiptUri ? (
              <Image source={{ uri: receiptUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={{ color: Colors[colorScheme].primary, fontWeight: '700', fontSize: 15 }}>
                + Upload Receipt
              </Text>
            )}
          </TouchableOpacity>
          {receiptUri && (
            <TouchableOpacity onPress={() => setReceiptUri(null)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: Colors[colorScheme].error, fontSize: 14, fontWeight: '600' }}>Remove Image</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={handleCreateListing}
          disabled={loading}
          style={{ backgroundColor: Colors[colorScheme].primary, padding: 18, borderRadius: 14, alignItems: 'center', marginBottom: 60, shadowColor: Colors[colorScheme].tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? (
            <ActivityIndicator color={Colors[colorScheme].tint} />
          ) : (
            <Text style={{ color: Colors[colorScheme].tint, fontSize: 18, fontWeight: '700' }}>Create Listing</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}