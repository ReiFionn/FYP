import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";

type Msg = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

export default function Chat() {
  const { otherUserId } = useLocalSearchParams<{ otherUserId: string }>();

  const [myId, setMyId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");

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
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: "#111", marginBottom: 10 }}>
        Chat
      </Text>

      <FlatList
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 6 }}>
            <Text style={{ color: "#111", fontWeight: item.sender_id === myId ? "700" : "400" }}>
              {item.sender_id === myId ? "Me" : "Them"}: {item.body}
            </Text>
            <Text style={{ color: "#777", fontSize: 12 }}>
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
            placeholderTextColor="#888"
            style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 10, color: "#111" }}
          />
          <Button title="Send" onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
