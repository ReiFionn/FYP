import { Colors } from "@/constants/theme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Button, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, useColorScheme, View } from "react-native";
import { supabase } from "../../../lib/supabase";

type Msg = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

export default function Chat() {
  const { otherUserId } = useLocalSearchParams<{ otherUserId: string }>();

  const [myId, setMyId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const colorScheme = useColorScheme() ?? 'light';
  

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace("/(auth)/login"); // if not logged in, go to login
      setMyId(data.user.id);

      const { data: cid, error } = await supabase.rpc("get_or_create_dm", { other_user: otherUserId }); // calls postgres function
      if (error) return alert(error.message);
      setConversationId(cid as string);
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

    // https://supabase.com/docs/guides/realtime/postgres-changes
    
    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` }, // listen for new messages in this conversation
        (payload) => setMessages((prev) => [...prev, payload.new as Msg]) // append new message to state
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]); // reload messages when conversationId is set

  async function send() {
    if (!myId || !conversationId) return;
    const body = draft.trim();
    if (!body) return;
    setDraft("");

    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      sender_id: myId,
      body,
    }); // insert new message into database

    if (error) alert(error.message);
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: Colors[colorScheme].background }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: Colors[colorScheme].text, marginBottom: 10 }}>
        {otherUserId}
      </Text>

      <FlatList
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 6 }}>
            <Text style={{ color: Colors[colorScheme].text, fontWeight: item.sender_id === myId ? "700" : "400" }}>
              {item.sender_id === myId ? "Me" : "Them"}: {item.body}
            </Text>
            <Text style={{ color: Colors[colorScheme].tint, fontSize: 12 }}>
              {new Date(item.created_at).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={Colors[colorScheme].tint}
            style={{ flex: 1, borderWidth: 1, borderColor: Colors[colorScheme].tint, padding: 10, borderRadius: 10, color: Colors[colorScheme].tint }}
          />
          <Button title="Send" onPress={send} color={Colors[colorScheme].text}/>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
