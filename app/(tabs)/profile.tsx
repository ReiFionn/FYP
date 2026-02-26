import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const colorScheme = useColorScheme() ?? 'light';
  
  async function logout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      <TouchableOpacity onPress={logout}>
        <Text style={{ color: 'red', fontSize: 18, textAlign: 'center'}}>Log Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}