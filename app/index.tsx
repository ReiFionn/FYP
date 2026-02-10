import { useEffect } from "react";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

export default function Index() {
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      router.replace(data.user ? "../(tabs)/index" : "/(auth)/login");
    });
  }, []);

  return null;
}
