import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 12 }}>
        Login
      </Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor="#888"
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 10, marginBottom: 10, color: "#111" }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor="#888"
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 10, marginBottom: 10, color: "#111" }}
      />

      <Button title="Log in" onPress={signIn} />
      <View style={{ height: 10 }} />
      <Button title="Sign up" onPress={signUp} />
    </View>
  );
}

// https://supabase.com/docs/guides/auth/passwords