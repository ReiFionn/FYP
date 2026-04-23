import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCheckout } from '@/hooks/useCheckout';
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../../lib/supabase";

type Msg = { 
  id: string; 
  conversation_id: string; 
  sender_id: string; 
  body: string; 
  created_at: string;
  message_type?: string;
  offer_amount?: number;
  offer_status?: string;
};

type Profile = { id: string; email: string | null; display_name: string | null; picture_url?: string | null; };
type ListingSummary = { id: string; listing_price: number; events: { title: string } };

const getListingContext = (bodyStr: string) => {
  try {
    const parsed = JSON.parse(bodyStr);
    if (parsed && parsed.listingId) return parsed;
  } catch (e) {}
  return { listingId: null, listingTitle: 'Event Ticket' };
};

export default function Chat() {
  const { otherUserId, listingId } = useLocalSearchParams<{ otherUserId: string, listingId?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { processCheckout } = useCheckout();
  const [myId, setMyId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [isMakingOffer, setIsMakingOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [sellerListings, setSellerListings] = useState<ListingSummary[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(listingId || null);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace("/(auth)/login");
      setMyId(data.user.id);

      const { data: cid } = await supabase.rpc("get_or_create_dm", { other_user: otherUserId });
      setConversationId(cid as string);

      loadProfile();
      loadListings();
    })();
  }, [otherUserId]);

  useEffect(() => {
    if (!conversationId) return;

    (async () => {
      const { data } = await supabase
        .from("conversation_messages")
        .select("id,conversation_id,sender_id,body,created_at,message_type,offer_amount,offer_status")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
        
      if (data) setMessages(data as Msg[]);
    })();
    
    const channel = supabase.channel(`dm:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => setMessages((prev) => [...prev, payload.new as Msg]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => setMessages((prev) => prev.map(msg => msg.id === payload.new.id ? (payload.new as Msg) : msg)))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,display_name,picture_url") 
      .eq("id", otherUserId)
      .single();
      
    if (data) setOtherProfile(data);
  }

  async function loadListings() {
    const { data } = await supabase
      .from("listings")
      .select("id, listing_price, events(title)")
      .eq("seller_id", otherUserId)
      .eq("status", "active");
    
    if (data) {
      const listings = data as unknown as ListingSummary[];
      setSellerListings(listings);
      if (listings.length === 1 && !listingId) setSelectedListingId(listings[0].id);
    }
  }

  async function send() {
    if (!myId || !conversationId) return;
    const body = draft.trim();
    if (!body) return;
    setDraft("");

    await supabase.from("conversation_messages").insert({ conversation_id: conversationId, sender_id: myId, body });
  }

  async function sendOffer() {
    if (!myId || !conversationId || !selectedListingId) return alert("Please select an item to make an offer on.");
    
    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid numeric amount.");

    const selectedListing = sellerListings.find(l => l.id === selectedListingId);

    const listingContext = JSON.stringify({
      listingId: selectedListingId,
      listingTitle: selectedListing?.events.title || 'Event Ticket'
    });

    const { error } = await supabase.from("conversation_messages").insert({ 
      conversation_id: conversationId, 
      sender_id: myId, 
      body: listingContext,
      message_type: 'offer',
      offer_amount: amount,
      offer_status: 'pending'
    });

    if (!error) {
      setIsMakingOffer(false);
      setOfferAmount("");
    } else alert(error.message);
  }

  async function updateOfferStatus(messageId: string, newStatus: 'declined' | 'withdrawn' | 'accepted' | 'paid') {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, offer_status: newStatus } : msg));

    const { error } = await supabase
      .from("conversation_messages")
      .update({ offer_status: newStatus })
      .eq("id", messageId);
      
    if (error) {
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, offer_status: 'pending' } : msg));
      Alert.alert("Error", "Could not update offer.");
      return false;
    }
    return true;
  }

  async function acceptOffer(messageId: string, listingId: string) {
    if (!listingId) return alert("Missing listing context.");

    const { error: listingError } = await supabase
      .from('listings')
      .update({ status: 'pending' })
      .eq('id', listingId);

    if (listingError) {
      console.error("Hold Error:", listingError);
      Alert.alert("Database Error", `Reason: ${listingError.message}`);
      return;
    }

    await updateOfferStatus(messageId, 'accepted');
  }

  async function payForOffer(messageId: string, itemListingId: string) {
    if (!myId || !itemListingId) return alert("Missing listing context.");

    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('status')
      .eq('id', itemListingId)
      .single();

    if (fetchError) return alert("Could not verify listing status.");
    if (listing?.status === 'sold') {
      return Alert.alert("Unavailable", "This ticket has already been sold.");
    }
    
    await processCheckout(itemListingId, myId, messageId);
  }

  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} >
      <TouchableOpacity 
        onPress={() => router.push(`../user/${otherUserId}`)}
        style={{ paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.icon, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Image 
          source={{ uri: otherProfile?.picture_url || 'https://cdn.vectorstock.com/i/500p/08/19/gray-human-icon-profile-placeholder-vector-35850819.jpg' }} 
          style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.icon, backgroundColor: theme.background }} 
        />
        <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>
          {otherProfile?.display_name || "Loading..."}
        </Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        style={{ flex: 1, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 20 }}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === myId;

          if (item.message_type === 'system') {
            return (
              <View 
                key={item.id} 
                style={{ 
                  alignSelf: 'center', 
                  width: '85%', 
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: 12, 
                  padding: 15, 
                  marginVertical: 15, 
                  alignItems: 'center' 
                }}
              >
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>
                  {item.body}
                </Text>
                <Pressable 
                  onPress={() => router.push(`/listings/${listingId}`)} 
                  style={{ backgroundColor: theme.primary, width: '100%', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: theme.tint, fontWeight: '700' }}>Rate Transaction</Text>
                </Pressable>
              </View>
            );
          }
          
          if (item.message_type === 'offer') {
            const context = getListingContext(item.body);
            
            return (
              <View style={{ flexDirection: "row", marginBottom: 12, justifyContent: isMe ? "flex-end" : "flex-start" }}>
                <View style={[{ maxWidth: "85%", minWidth: 220, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 }, isMe ? { borderBottomRightRadius: 4, backgroundColor: theme.tint } : { borderBottomLeftRadius: 4, backgroundColor: theme.card }]}>
                  
                  <Text style={{ color: isMe ? theme.text : theme.text, fontSize: 16, fontWeight: '800', marginBottom: 2 }}>
                    {isMe ? 'You offered' : 'Offer received'}: €{item.offer_amount}
                  </Text>
                  
                  <Text style={{ color: isMe ? theme.tabIconDefault : theme.tabIconDefault, fontSize: 13, marginBottom: 8, fontWeight: '500' }}>
                    For: {context.listingTitle}
                  </Text>
                  
                  {!isMe && item.offer_status === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Pressable style={{ flex: 1, backgroundColor: theme.error, padding: 10, borderRadius: 8, alignItems: 'center' }} onPress={() => updateOfferStatus(item.id, 'declined')}>
                        <Text style={{ color: theme.tint, fontWeight: '700' }}>Decline</Text>
                      </Pressable>
                      <Pressable style={{ flex: 1, backgroundColor: '#A4CBB4', padding: 10, borderRadius: 8, alignItems: 'center' }} onPress={() => acceptOffer(item.id, context.listingId)}>
                        <Text style={{ color: theme.tint, fontWeight: '700' }}>Accept</Text>
                      </Pressable>
                    </View>
                  )}

                  {isMe && item.offer_status === 'pending' && (
                    <Pressable style={{ marginTop: 8, alignSelf: 'flex-start', paddingVertical: 4 }} onPress={() => updateOfferStatus(item.id, 'withdrawn')}>
                      <Text style={{ color: theme.tabIconDefault, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' }}>Withdraw Offer</Text>
                    </Pressable>
                  )}

                  {isMe && item.offer_status === 'accepted' && (
                    <Pressable style={{ marginTop: 12, backgroundColor: theme.primary, padding: 12, borderRadius: 8, alignItems: 'center' }} onPress={() => payForOffer(item.id, context.listingId)}>
                      <Text style={{ color: theme.tint, fontWeight: '800', fontSize: 16 }}>Pay Now</Text>
                    </Pressable>
                  )}

                  {(item.offer_status !== 'pending' && !(isMe && item.offer_status === 'accepted')) && (
                    <Text style={{ 
                      color: (item.offer_status === 'accepted' || item.offer_status === 'paid') ? '#A4CBB4' : theme.error, 
                      marginTop: 8, 
                      fontWeight: '800', 
                      textTransform: 'uppercase', 
                      fontSize: 12 
                    }}>
                      {item.offer_status === 'accepted' && !isMe ? "Accepted - Waiting for payment" : item.offer_status}
                    </Text>
                  )}

                  <Text style={{ fontSize: 11, marginTop: 8, alignSelf: isMe ? 'flex-end' : 'flex-start', color: isMe ? theme.tabIconDefault : theme.tabIconDefault }}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <View style={{ flexDirection: "row", marginBottom: 12, justifyContent: isMe ? "flex-end" : "flex-start" }}>
              <View style={[{ maxWidth: "75%", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }, isMe ? { borderBottomRightRadius: 4, backgroundColor: theme.tint } : { borderBottomLeftRadius: 4, backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, fontSize: 16 }}>{item.body}</Text>
                <Text style={{ fontSize: 11, marginTop: 4, alignSelf: isMe ? 'flex-end' : 'flex-start', color: theme.tabIconDefault }}>{formatTime(item.created_at)}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.icon, backgroundColor: theme.background }}>
        {isMakingOffer ? (
          <View style={{ flexDirection: 'column' }}>
            
            {sellerListings.length > 0 ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
                  Select an item to make an offer on:
                </Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={sellerListings}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ gap: 8 }}
                  renderItem={({ item }) => {
                    const isSelected = selectedListingId === item.id;
                    return (
                      <Pressable onPress={() => setSelectedListingId(item.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.card : theme.background }}>
                        <Text style={{ color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? '700' : '400' }}>{item.events.title} (€{item.listing_price})</Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            ) : (
              <Text style={{ color: theme.tabIconDefault, marginBottom: 12, fontStyle: 'italic' }}>
                This user has no active listings.
              </Text>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => setIsMakingOffer(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.tabIconDefault, fontSize: 24 }}>✕</Text>
              </Pressable>
              <Text style={{ fontSize: 20, color: theme.text, paddingHorizontal: 4 }}>€</Text>
              <TextInput value={offerAmount} onChangeText={setOfferAmount} placeholder="0.00" placeholderTextColor={theme.tabIconDefault} keyboardType="numeric" editable={sellerListings.length > 0} style={{ minWidth: 100, flex: 1, height: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, fontSize: 16, color: theme.text, borderColor: theme.border, marginLeft: 4 }} />
              <Pressable onPress={sendOffer} disabled={!offerAmount || !selectedListingId} style={({ pressed }) => [{ marginLeft: 12, borderRadius: 22, height: 44, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: (offerAmount && selectedListingId) ? theme.primary : theme.icon, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={{ color: (offerAmount && selectedListingId) ? theme.tint : theme.background, fontWeight: '700', fontSize: 16 }}>Send</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Pressable onPress={() => setIsMakingOffer(true)} style={{ padding: 12, marginRight: 4 }}>
              <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>€</Text>
            </Pressable>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Message..." placeholderTextColor={theme.tabIconDefault} style={{ flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, maxHeight: 100, fontSize: 16, color: theme.text, backgroundColor: theme.background, borderColor: theme.border }} multiline />
            <Pressable onPress={send} disabled={!draft.trim()} style={({ pressed }) => [{ marginLeft: 12, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: draft.trim() ? theme.primary : theme.icon, opacity: pressed ? 0.8 : 1 }]}>
              <Text style={{ color: draft.trim() ? theme.tint : theme.background, fontWeight: '700', fontSize: 16 }}>Send</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}