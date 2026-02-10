import { View, Text, FlatList, TextInput, TouchableOpacity, Image } from "react-native";
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const CATEGORIES = ["Today", "Rock", "Pop", "Rap", "Electronic"];

const FEED = [
  { id: "1", title: "1", price: "£25", user: "alex" },
  { id: "2", title: "2", price: "£40", user: "jamie" },
];

export default function Index() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: Colors[colorScheme].background }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: Colors[colorScheme].text, marginBottom: 12 }}>
            Users
          </Text>

      <View style={{ paddingHorizontal: 16 }}>
        <TextInput
          placeholder="Search for items..."
          placeholderTextColor="#ECEDEE"
          style={{
            backgroundColor: Colors[colorScheme].icon,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              backgroundColor: Colors[colorScheme].icon,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 20,
              marginRight: 10,
            }}
          >
            <Text style={{ color: Colors[colorScheme].text}}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={FEED}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              borderWidth: 1,
              borderColor: Colors[colorScheme].icon,
              borderRadius: 16,
              marginBottom: 16,
              overflow: "hidden"
            }}
          >
            <View style={{ height: 160, backgroundColor: Colors[colorScheme].background }} />

            <View style={{ padding: 12 }}>
              <Text style={{ fontWeight: "600", color: Colors[colorScheme].text }}>{item.title}</Text>
              <Text style={{ marginTop: 4,  color: Colors[colorScheme].text }}>{item.price}</Text>
              <Text style={{ color: Colors[colorScheme].text, marginTop: 2 }}>
                @{item.user}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
