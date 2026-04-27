import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("../(tabs)");
    });
  }, []);

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert("Missing Fields", "Please enter an email and password.");
      return;
    }

    setLoading(true);

    if (isSignUp) {
      if (!displayName.trim()) {
        Alert.alert("Missing Name", "Please enter a display name.");
        setLoading(false);
        return;
      }

      const { data: isAvailable, error: checkError } = await supabase.rpc('check_username_available', { 
        username: displayName.trim() 
      });

      if (checkError || !isAvailable) {
        Alert.alert("Name Taken", "That display name is already in use.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          }
        }
      });
      
      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert("Success", "Account created! You can now log in.");
        setIsSignUp(false);
        setPassword("");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert("Login Failed", error.message);
      } else {
        router.replace("../(tabs)");
      }
    }

    setLoading(false);
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: "800", color: theme.text, marginBottom: 8 }}>
          {isSignUp ? "Create Account" : "Agorex"}
        </Text>
        <Text style={{ fontSize: 16, color: theme.tabIconDefault, marginBottom: 32 }}>
          {isSignUp ? "Sign up to start buying and selling tickets." : "Log in to manage your tickets and offers."}
        </Text>

        {isSignUp && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: theme.text, marginBottom: 8, fontWeight: '600' }}>Display Name</Text>
            <TextInput
              placeholder="e.g. fionn777"
              placeholderTextColor={theme.tabIconDefault}
              value={displayName}
              onChangeText={setDisplayName}
              style={{ backgroundColor: theme.tint, borderWidth: 1, borderColor: theme.border, padding: 16, borderRadius: 12, color: theme.text, fontSize: 16 }}
            />
          </View>
        )}

        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: theme.text, marginBottom: 8, fontWeight: '600' }}>Email</Text>
          <TextInput
            placeholder="hello@agorex.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor={theme.tabIconDefault}
            style={{ backgroundColor: theme.tint, borderWidth: 1, borderColor: theme.border, padding: 16, borderRadius: 12, color: theme.text, fontSize: 16 }}
          />
        </View>

        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: theme.text, marginBottom: 8, fontWeight: '600' }}>Password</Text>
          <TextInput
            placeholder="********"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor={theme.tabIconDefault}
            style={{ backgroundColor: theme.tint, borderWidth: 1, borderColor: theme.border, padding: 16, borderRadius: 12, color: theme.text, fontSize: 16 }}
          />
        </View>

        <TouchableOpacity 
          onPress={handleAuth} 
          disabled={loading}
          style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center', opacity: loading ? 0.7 : 1, marginBottom: 16 }}
        >
          {loading ? (
            <ActivityIndicator color={theme.tint} />
          ) : (
            <Text style={{ color: theme.tint, fontSize: 16, fontWeight: "700" }}>
              {isSignUp ? "Sign Up" : "Log In"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{ padding: 12, alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
            {isSignUp ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}