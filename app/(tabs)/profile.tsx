import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function Index() {
  const colorScheme = useColorScheme() ?? 'light';
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      
    </SafeAreaView>
  );
}