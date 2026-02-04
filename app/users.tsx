import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, Button } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

type Profile = { id: string; email: string | null; display_name: string | null };

export default function Users() {
  const [me, setMe] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace("/(auth)/login"); // if not logged in, go to login
    setMe(u.user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,display_name")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setProfiles((data ?? []).filter(p => p.id !== u.user!.id)); // exclude self
  }

  useEffect(() => {
    load();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 12 }}>
        Users
      </Text>

      <Button title="Log out" onPress={logout} />

      <FlatList
        style={{ marginTop: 12 }}
        data={profiles}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/chat/${item.id}`)} // navigate to chat with this user
            style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, marginBottom: 10 }}
          >
            <Text style={{ color: "#111", fontWeight: "600" }}>
              {item.display_name ?? item.email ?? item.id}
            </Text>
            <Text style={{ color: "#666", fontSize: 12 }}>
              {item.email ?? ""}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: "#666", marginTop: 20 }}>No other users yet.</Text>}
      />
    </View>
  );
}
