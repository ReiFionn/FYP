import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

type ChatListItem = {
  id: string;
  email: string | null;
  display_name: string | null;
  picture_url: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
};

export default function Users() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [profiles, setProfiles] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/(auth)/login");

      const { data: convos, error: convoError } = await supabase
    .from("conversations")
    .select(`
      id,
      user1_id, 
      user2_id, 
      last_message_at,
      conversation_messages ( body, message_type, offer_amount )
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false })
    .order("created_at", { foreignTable: "conversation_messages", ascending: false })
    .limit(1, { foreignTable: "conversation_messages" });

      if (convoError) return alert(convoError.message);
      if (!convos || convos.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      const otherUserIds = convos.map((c) =>
        c.user1_id === user.id ? c.user2_id : c.user1_id
      );

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, display_name, picture_url")
        .in("id", otherUserIds);

      if (profilesError) return alert(profilesError.message);

      const mergedData = convos.map(convo => {
        const otherId = convo.user1_id === user.id ? convo.user2_id : convo.user1_id;
        const profile = profilesData?.find(p => p.id === otherId);
        
        let lastMessageText = "No messages yet";
        const lastMsg = convo.conversation_messages && convo.conversation_messages.length > 0 
          ? convo.conversation_messages[0] 
          : null;

        if (lastMsg) {
          if (lastMsg.message_type === 'offer') {
            let title = 'an item';
            try {
              const parsed = JSON.parse(lastMsg.body);
              if (parsed.listingTitle) title = parsed.listingTitle;
            } catch (e) {
              
            }
            lastMessageText = `Offer sent for ${title} (€${lastMsg.offer_amount})`;
          } else {
            lastMessageText = lastMsg.body;
          }
        }
        
        return {
          id: otherId,
          email: profile?.email || null,
          display_name: profile?.display_name || null,
          picture_url: profile?.picture_url || null,
          last_message_at: convo.last_message_at,
          last_message_text: lastMessageText
        };
      });

      setProfiles(mergedData);
      setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: theme.text }}>
          Messages
        </Text>
      </View>

      <FlatList
        data={loading && !refreshing ? [] : profiles}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/chat/${item.id}`)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderColor: theme.icon,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Image
              source={{ uri: item.picture_url || 'https://cdn.vectorstock.com/i/500p/08/19/gray-human-icon-profile-placeholder-vector-35850819.jpg' }}
              style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: theme.icon }}
            />
            
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600", marginBottom: 4 }} numberOfLines={1}>
                {item.display_name ?? item.email ?? "Unknown User"}
              </Text>
              <Text style={{ color: theme.tabIconDefault, fontSize: 14 }} numberOfLines={1}>
                {item.last_message_text}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', height: '100%', paddingTop: 4 }}>
              <Text style={{ color: theme.tabIconDefault, fontSize: 12 }}>
                {formatTime(item.last_message_at)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.text} />
            </View>
          ) : (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.tabIconDefault, fontSize: 16 }}>No messages yet.</Text>
            </View>
          )
        }
      />
    </View>
  );
}