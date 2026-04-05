import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../../lib/supabase";

type Msg = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type Profile = { id: string; email: string | null; display_name: string | null };

export default function Chat() {
  const { otherUserId } = useLocalSearchParams<{ otherUserId: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [myId, setMyId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace("/(auth)/login");
      setMyId(data.user.id);

      const { data: cid, error } = await supabase.rpc("get_or_create_dm", { other_user: otherUserId });
      if (error) return alert(error.message);
      setConversationId(cid as string);

      loadProfile();
    })();
  }, [otherUserId]);

  useEffect(() => {
    if (!conversationId) return;

    (async () => {
      const { data, error } = await supabase
        .from("conversation_messages") 
        .select("id,conversation_id,sender_id,body,created_at")
        .eq("conversation_id", conversationId) 
        .order("created_at", { ascending: true });

      if (error) return alert(error.message);
      setMessages((data ?? []) as Msg[]);
    })();
    
    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,display_name")
      .eq("id", otherUserId)
      .single();

    if (error) return alert(error.message);
    setOtherProfile(data);
  }

  async function send() {
    if (!myId || !conversationId) return;
    const body = draft.trim();
    if (!body) return;
    setDraft("");

    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      sender_id: myId,
      body,
    });

    if (error) alert(error.message);
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: theme.background }} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} 
    >
      <View style={{ paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center', borderBottomColor: theme.icon }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>
          {otherProfile?.display_name || "Loading..."}
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        style={{ flex: 1, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 10 }}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === myId;
          return (
            <View style={{ flexDirection: "row", marginBottom: 12, justifyContent: isMe ? "flex-end" : "flex-start" }}>
              <View style={[
                { maxWidth: "75%", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
                isMe ? {borderBottomRightRadius: 4, backgroundColor: theme.tint } : {borderBottomLeftRadius: 4,  backgroundColor: theme.icon }
              ]}>
                <Text style={{ color: theme.text, fontSize: 16 }}>
                  {item.body}
                </Text>
                <Text style={{ fontSize: 11, marginTop: 4, alignSelf: isMe ? 'flex-end' : 'flex-start', color: theme.text }}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'flex-end', borderTopColor: theme.icon, backgroundColor: theme.background }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message..."
          placeholderTextColor={theme.tabIconDefault}
          style={{ flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, maxHeight: 100, fontSize: 16, color: theme.text, backgroundColor: theme.background, borderColor: theme.icon }}
          multiline
          maxLength={500}
        />
        <Pressable 
          onPress={send} 
          style={({ pressed }) => [
            { marginLeft: 12, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: draft.trim() ? theme.tint : theme.icon, opacity: pressed ? 0.8 : 1 }
          ]}
          disabled={!draft.trim()}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}