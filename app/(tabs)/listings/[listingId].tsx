import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCheckout } from '@/hooks/useCheckout';
import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Rating } from 'react-native-ratings';

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
  seller_display_name?: string;
  seller_picture_url?: string | null;
  seller_trust_rating?: number;
};

export default function ListingDetails() {
  const { listingId } = useLocalSearchParams(); 
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [listing, setListing] = useState<ListingWithEvent | null>(null);
  const [loading, setLoading] = useState(true);
  let aiPriceColour = "#A4CBB4";
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState<string | null>(null);  
  const { processCheckout } = useCheckout();
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [issueType, setIssueType] = useState('Ticket Not Received');
  const [userMessage, setUserMessage] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [sellerNeedsToRate, setSellerNeedsToRate] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);

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

  useEffect(() => {
    const checkReviewStatus = async () => {
      if (!listing || !buyerId || listing.status !== 'sold' || !listing.ticket_received) return;
      
      if (buyerId === listing.seller_id) {
        const { data } = await supabase
          .from('reviews')
          .select('id')
          .eq('listing_id', listing.id)
          .eq('reviewer_id', buyerId)
          .single();
        
        if (!data) {
          setSellerNeedsToRate(true);
        } else {
          setSellerNeedsToRate(false);
        }
      }
    };
    checkReviewStatus();
  }, [listing, buyerId]);

  const renderStars = (rating: number) => {
    const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const thresholdRating = Math.floor(safeRating * 2) / 2;
    const fullStars = Math.floor(thresholdRating);
    const hasHalfStar = thresholdRating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    return '★'.repeat(fullStars) + (hasHalfStar ? '½' : '') + '☆'.repeat(emptyStars);
  };

  const fetchListing = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`*, events (id, title, age_restriction, start_time, venue_name, city, address_line1, category)`)
        .eq('id', listingId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, picture_url, trust_rating')
          .eq('id', data.seller_id)
          .maybeSingle()
        
        if (profileError) {
          console.error("Profile Error (Check RLS Policies):", profileError.message);
        }
        
        const listingWithDetails = {
            ...data,
            seller_display_name: profileData?.display_name || 'Unknown User',
            seller_picture_url: profileData?.picture_url || null,
            seller_trust_rating: profileData?.trust_rating || 0
        };

        setListing(listingWithDetails as unknown as ListingWithEvent);
      }
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
        "Your money is safe in escrow. We just notified the seller to transfer the ticket to you. Once you receive it, confirm receipt here once it arrives.",
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
              setReviewModalVisible(true);
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

  const handleDelete = () => {
    Alert.alert(
      "Delete Listing",
      "Are you sure? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from('listings').delete().eq('id', listing?.id);
            if (error) {
              Alert.alert("Error", "Could not delete listing.");
            } else {
              router.replace('/(tabs)');
            }
          }
        }
      ]
    );
  };

  const handleUpdatePrice = async () => {
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid number.");
      return;
    }

    setUpdatingPrice(true);
    
    const { error } = await supabase
      .from('listings')
      .update({ listing_price: priceNum })
      .eq('id', listing?.id);

    setUpdatingPrice(false);

    if (error) {
      Alert.alert("Error", "Could not update price. Please try again.");
    } else {
      setListing(prev => prev ? { ...prev, listing_price: priceNum } : null);
      setEditModalVisible(false);
      Alert.alert("Success", "Listing price updated!");
    }
  };

  const submitDispute = async () => {
    if (!userMessage.trim()) return;

    setSubmittingReport(true);
    try {
      const accusedId = (listing?.active_buyer_id === buyerId) 
      ? listing?.seller_id 
      : listing?.active_buyer_id;

      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          listing_id: listing?.id,
          reporter_id: buyerId,
          accused_id: accusedId,
          issue_type: issueType,
          user_message: userMessage.trim()
        }]);

      if (error) throw error;

      Alert.alert("Received", "We've started an investigation. You'll be notified of the outcome.");
      setReportModalVisible(false);
      setUserMessage('');
      
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  const submitReview = async () => {
    if (!listing || !buyerId) return;
    
    setSubmittingReview(true);
    try {
      const isBuyer = buyerId === listing.active_buyer_id;
      const revieweeId = isBuyer ? listing.seller_id : listing.active_buyer_id;

      const { error } = await supabase.rpc('submit_and_update_rating', {
        p_listing_id: listing.id,
        p_reviewee_id: revieweeId,
        p_rating: ratingValue,
        p_comment: reviewComment.trim() || null
      });

      if (error) throw error;

      if (isBuyer) {
        setReviewModalVisible(false);
        Alert.alert("Thanks!", "Your review has been submitted.");
      } else {
        setSellerNeedsToRate(false);
        Alert.alert("Thanks!", "Your review has been submitted.");
      }
      
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!listing || !listing.events) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Listing not found.</Text>
      </View>
    );
  }

  const aiPriceColourLogic = (userPrice: number, aiPrice: number) => {
    const aiPriceFive = aiPrice/100*5

    if (userPrice >= aiPrice + (aiPriceFive*2))
      aiPriceColour = theme.error;
    else if (userPrice >= aiPrice + aiPriceFive)
      aiPriceColour = "#E2C28A";
    else
      aiPriceColour = "#A4CBB4";
  }

  console.log("Event Data from Supabase:", listing.events);
  aiPriceColourLogic(listing.listing_price, listing.ai_suggested_price)
  
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
      
      {listing.artist_image_url && listing.artist_image_url.trim() !== "" && listing.artist_image_url !== "null" ? (
        <Image 
          source={{ uri: listing.artist_image_url }} 
          style={{ width: '100%', height: 250 }} 
          resizeMode="cover"
        />
      ) : (
        <View style={{ height: 250, backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>No Image Available</Text>
        </View>
      )}

      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: theme.text, flex: 1, marginRight: 12 }}>
            {listing.events.title}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: aiPriceColour }}>
            €{listing.listing_price}
          </Text>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '500' }}>
            {formatDate(listing.events.start_time)}
          </Text>
          <Text style={{ color: theme.tabIconDefault, fontSize: 16, marginTop: 4 }}>
            {listing.events.venue_name}, {listing.events.address_line1}, {listing.events.city}
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: theme.icon, marginVertical: 20 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {listing.status === 'sold' ? (
            buyerId === listing.active_buyer_id ? (
              <View style={{ width: '100%' }}>
                {listing.ticket_received ? (
                  <View style={{ padding: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 8, width: '100%', alignItems: 'center' }}>
                    <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>Ticket Received!</Text>
                    <Text style={{ color: theme.text, marginTop: 4 }}>Funds have been released to the seller.</Text>
                  </View>
                ) : listing.ticket_sent ? (
                  <View style={{ padding: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 8, width: '100%' }}>
                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Action Required</Text>
                    <Text style={{ color: theme.tabIconDefault, marginTop: 8, marginBottom: 15, lineHeight: 22 }}>
                      The seller has confirmed transferring the ticket to you. Please click below to release their payout.
                    </Text>
                    <TouchableOpacity onPress={handleConfirmReceipt} style={{ backgroundColor: theme.primary, width: '100%', padding: 14, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 16 }}>Confirm Ticket Received</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ padding: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 8, width: '100%' }}>
                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Awaiting Transfer</Text>
                    <Text style={{ color: theme.tabIconDefault, marginTop: 8, lineHeight: 22 }}>
                      Your payment is secure in escrow. We are waiting for the seller to transfer the ticket. This page will update once they send it.
                    </Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setReportModalVisible(true)} style={{ marginTop: 15, alignSelf: 'center' }}>
                  <Text style={{ color: theme.error, fontWeight: '600' }}>Report an Issue</Text>
                </TouchableOpacity>
              </View>
            ) : buyerId === listing.seller_id ? (
              <View style={{ width: '100%' }}>
                {listing.ticket_sent ? (
                  listing.ticket_received && sellerNeedsToRate ? (
                    <View style={{ padding: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 8, width: '100%', alignItems: 'center' }}>
                      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Transaction Complete!</Text>
                      <Text style={{ color: theme.tabIconDefault, marginTop: 4, textAlign: 'center', marginBottom: 15 }}>
                        The buyer received the ticket. Please rate them below.
                      </Text>
                      <Rating
                        type="star"
                        fractions={2}
                        startingValue={0}
                        imageSize={40}
                        tintColor={theme.card}
                        onFinishRating={(rating: number) => setRatingValue(rating)}
                        style={{ paddingVertical: 10 }}
                      />
                      <TextInput
                        style={{
                          backgroundColor: theme.tint, color: theme.text, width: '100%',
                          borderRadius: 8, padding: 10, marginTop: 15, height: 60, textAlignVertical: 'top'
                        }}
                        placeholder="Optional comment..."
                        placeholderTextColor={theme.tabIconDefault}
                        multiline
                        value={reviewComment}
                        onChangeText={setReviewComment}
                      />
                      <TouchableOpacity disabled={submittingReview} onPress={submitReview} style={{ backgroundColor: theme.primary, width: '100%', marginTop: 15, padding: 14, borderRadius: 8, alignItems: 'center', opacity: submittingReview ? 0.7 : 1 }}>
                        <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 16 }}>{submittingReview ? "Submitting..." : "Submit Review"}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ padding: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 8, width: '100%', alignItems: 'center' }}>
                      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Ticket Transferred!</Text>
                      <Text style={{ color: theme.tabIconDefault, marginTop: 4, textAlign: 'center' }}>Awaiting buyer confirmation to release your payout.</Text>
                    </View>
                  )
                ) : (
                  <View style={{ padding: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 8, width: '100%' }}>
                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Next Step: Transfer Ticket</Text>
                    <Text style={{ color: theme.tabIconDefault, marginTop: 8, marginBottom: 15, lineHeight: 22 }}>
                      Please transfer the ticket to the buyer. Once transferred, confirm below.
                    </Text>
                    <TouchableOpacity onPress={handleConfirmSent} style={{ backgroundColor: theme.primary, width: '100%', padding: 14, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 16 }}>I Have Transferred the Ticket</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity onPress={() => setReportModalVisible(true)} style={{ marginTop: 15, alignSelf: 'center' }}>
                  <Text style={{ color: theme.error, fontWeight: '600' }}>Report an Issue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ color: theme.tabIconDefault, fontSize: 18, fontWeight: '700' }}>Sold</Text>
            )
          ) : (
            buyerId === listing.seller_id ? (
              <View style={{ width: '100%', backgroundColor: theme.icon, padding: 16, borderRadius: 12 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
                  Manage Your Listing
                </Text>
                
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <TouchableOpacity 
                    onPress={() => {
                      setNewPrice(listing?.listing_price?.toString() || '');
                      setEditModalVisible(true);
                    }}
                    style={{ flex: 1, backgroundColor: theme.primary, padding: 14, borderRadius: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 16 }}>Edit Price</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={handleDelete}
                    style={{ flex: 1, backgroundColor: theme.error, padding: 14, borderRadius: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 16 }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ width: '100%', gap: 12 }}>
                <TouchableOpacity 
                  disabled={loadingPayment} 
                  onPress={() => {
                    if (!buyerId) {
                      Alert.alert("Sign In Required", "Please log in to purchase this ticket.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Log In", onPress: () => router.push('/login') }
                      ]);
                      return;
                    }
                    handleBuy();
                  }} 
                  style={{ backgroundColor: theme.primary, width: '100%', padding: 14, borderRadius: 8, alignItems: 'center', opacity: loadingPayment ? 0.7 : 1 }}
                >
                  <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 16 }}>Buy Ticket</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => {
                    if (!buyerId) {
                      Alert.alert("Sign In Required", "Please log in to make an offer or message the seller.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Log In", onPress: () => router.push('/login') }
                      ]);
                      return;
                    }
                    router.push({ 
                      pathname: `/chat/[otherUserId]`, 
                      params: { otherUserId: listing.seller_id, listingId: listing.id } 
                    });
                  }} 
                  style={{ backgroundColor: theme.icon, width: '100%', padding: 14, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Make Offer / Message Seller</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>

        <View style={{ height: 1, backgroundColor: theme.icon, marginVertical: 20 }} />

        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Ticket Details</Text>
        <View style={{ marginLeft: 20, marginTop: 12, gap: 4 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Seller</Text>
        
          <TouchableOpacity 
            onPress={() => {
              if (buyerId === listing.seller_id) {
                router.push('/(tabs)/profile');
              } else {
                router.push(`/user/${listing.seller_id}`);
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.icon, padding: 16, borderRadius: 16, marginBottom: 20 }}
          >
            <Image 
              source={{ uri: listing.seller_picture_url || 'https://cdn.vectorstock.com/i/500p/08/19/gray-human-icon-profile-placeholder-vector-35850819.jpg' }} 
              style={{ width: 50, height: 50, borderRadius: 25, marginRight: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }} 
            />
            
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                {listing.seller_display_name}
              </Text>
              <Text style={{ fontSize: 14, letterSpacing: 2, color: theme.tint }}>
                {renderStars(listing.seller_trust_rating || 0)} <Text style={{ color: theme.tabIconDefault, fontSize: 12, letterSpacing: 0 }}>({Number(listing.seller_trust_rating || 0).toFixed(1)}/5)</Text>
              </Text>
            </View>

            <Text style={{ color: theme.tabIconDefault, fontSize: 24 }}>›</Text>
          </TouchableOpacity>

          <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>AI Suggested Price: €{listing.ai_suggested_price}</Text>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 12 }}>Event Information</Text>
          
          <View style={{ marginLeft: 20, gap: 4, marginTop: 4 }}>
            <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>Title: {listing.events.title}</Text>
            <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>Start Time: {formatDate(listing.events.start_time)}</Text>
            <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>Category: {listing.events.category}</Text>
            <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>Venue Name: {listing.events.venue_name}</Text>
            <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>Venue Address:</Text>
            
            <View style={{ marginLeft: 20 }}>
              <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>{listing.events.address_line1}</Text>
              <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>{listing.events.city}</Text>
              <Text style={{ color: theme.tabIconDefault, fontSize: 16, fontWeight: '500' }}>{listing.events.region}</Text>
            </View>
          </View>
        </View>
      </View>

      <Modal visible={reviewModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: theme.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: '50%' }}>
              
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 10 }}>
                Ticket Secured!
              </Text>
              <Text style={{ fontSize: 16, color: theme.tabIconDefault, textAlign: 'center', marginBottom: 20 }}>
                Rate your experience with the seller!
              </Text>

              <Rating
                type="star"
                fractions={2}
                startingValue={0}
                imageSize={40}
                tintColor={theme.card}
                onFinishRating={(rating: number) => setRatingValue(rating)}
                style={{ paddingVertical: 10 }}
              />

              <TextInput
                style={{
                  backgroundColor: theme.tint, color: theme.text,
                  borderRadius: 10, padding: 15, height: 100, textAlignVertical: 'top', marginVertical: 20
                }}
                placeholder="Leave a comment (optional)..."
                placeholderTextColor={theme.tabIconDefault}
                multiline
                value={reviewComment}
                onChangeText={setReviewComment}
              />

              <TouchableOpacity disabled={submittingReview} onPress={submitReview} style={{ backgroundColor: theme.primary, padding: 14, borderRadius: 8, alignItems: 'center', opacity: submittingReview ? 0.7 : 1 }}>
                <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 16 }}>{submittingReview ? "Submitting..." : "Submit Review"}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} style={{ marginTop: 15, alignSelf: 'center' }}>
                <Text style={{ color: theme.tabIconDefault, fontWeight: '600' }}>Skip for now</Text>
              </TouchableOpacity>

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={reportModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: theme.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: '60%' }}>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>Report Issue</Text>
                <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                  <Text style={{ color: theme.tabIconDefault, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: theme.text, marginBottom: 10, fontWeight: '600' }}>What is the problem?</Text>
              
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {['Ticket Not Received', 'Fake/Invalid Ticket', 'Payment Issue', 'Other'].map((type) => (
                  <TouchableOpacity 
                    key={type}
                    onPress={() => setIssueType(type)}
                    style={{ 
                      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, 
                      backgroundColor: issueType === type ? theme.text : theme.icon 
                    }}>
                    <Text style={{ color: issueType === type ? theme.tint : theme.text }}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: theme.text, marginBottom: 10, fontWeight: '600' }}>Details</Text>
              <TextInput
                style={{
                  backgroundColor: theme.tint, color: theme.text,
                  borderRadius: 10, padding: 15, height: 120, textAlignVertical: 'top', marginBottom: 20
                }}
                placeholder="Explain what happened..."
                placeholderTextColor={theme.tabIconDefault}
                multiline
                value={userMessage}
                onChangeText={setUserMessage}
              />

              <TouchableOpacity disabled={submittingReport} onPress={submitDispute} style={{ backgroundColor: theme.error, padding: 14, borderRadius: 8, alignItems: 'center', opacity: submittingReport ? 0.7 : 1 }}>
                <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 16 }}>{submittingReport ? "Submitting..." : "Submit Issue"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: theme.card, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: '30%' }}>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>Edit Price</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Text style={{ color: theme.tabIconDefault, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 24, color: theme.text, marginRight: 8, fontWeight: '700' }}>€</Text>
                <TextInput
                  style={{
                    flex: 1, backgroundColor: theme.tint, color: theme.text,
                    borderRadius: 10, padding: 15, fontSize: 18
                  }}
                  placeholder="0.00"
                  placeholderTextColor={theme.tabIconDefault}
                  keyboardType="numeric"
                  value={newPrice}
                  onChangeText={setNewPrice}
                  autoFocus
                />
              </View>

              <TouchableOpacity 
                disabled={updatingPrice} 
                onPress={handleUpdatePrice} 
                style={{ backgroundColor: theme.text, padding: 14, borderRadius: 8, alignItems: 'center', opacity: updatingPrice ? 0.7 : 1 }}
              >
                <Text style={{ color: theme.background, fontWeight: '700', fontSize: 16 }}>
                  {updatingPrice ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  );
}