import { Colors } from "@/constants/theme";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Button, Text, TextInput, useColorScheme, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const colorScheme = useColorScheme() ?? 'light';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("../(tabs)");
    });
  }, []);

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);
    alert("Signed up! Now log in.");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    router.replace("../(tabs)");
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: Colors[colorScheme].background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: Colors[colorScheme].text, marginBottom: 12 }}>
        Login
      </Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor={Colors[colorScheme].tint}
        style={{ borderWidth: 1, borderColor: Colors[colorScheme].tint, padding: 10, borderRadius: 10, marginBottom: 10, color: Colors[colorScheme].tint }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor={Colors[colorScheme].tint}
        style={{ borderWidth: 1, borderColor: Colors[colorScheme].tint, padding: 10, borderRadius: 10, marginBottom: 10, color: Colors[colorScheme].tint }}
      />

      <Button title="Log in" onPress={signIn} color={Colors[colorScheme].text} />
      <View style={{ height: 10 }} />
      <Button title="Sign up" onPress={signUp} color={Colors[colorScheme].text} />
    </View>
  );
}

// https://supabase.com/docs/guides/auth/passwords