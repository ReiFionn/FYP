import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

type Profile = { id: string; email: string | null; display_name: string | null };

export default function Users() {
  const colorScheme = useColorScheme() ?? 'light';

  const [me, setMe] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

async function load() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return router.replace("/(auth)/login");
  setMe(user.id);

  const { data: convos, error: convoError } = await supabase
    .from("conversations")
    .select("user1_id, user2_id")
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  if (convoError) return alert(convoError.message);
  if (!convos || convos.length === 0) return setProfiles([]);

  const otherUserIds = convos.map((c) =>
    c.user1_id === user.id ? c.user2_id : c.user1_id
  );

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", otherUserIds); 

  if (profilesError) return alert(profilesError.message);
  
  setProfiles(profilesData ?? []);
}

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: Colors[colorScheme].background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: Colors[colorScheme].text, marginBottom: 12 }}>
        Messages
      </Text>

      <FlatList
        style={{ marginTop: 12 }}
        data={profiles}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/chat/${item.id}`)} // navigate to chat with this user
            style={{ padding: 12, borderWidth: 1, borderColor: Colors[colorScheme].background, borderRadius: 12, marginBottom: 10 }}
          >
            <Text style={{ color: Colors[colorScheme].text, fontWeight: "600" }}>
              {item.display_name ?? item.email ?? item.id}
            </Text>
            <Text style={{ color: Colors[colorScheme].text, fontSize: 12 }}>
              {item.email ?? ""}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: Colors[colorScheme].text, marginTop: 20 }}>You haven't messaged anyone yet.</Text>}
      />
    </View>
  );
}
