import { View, Text, FlatList, TextInput, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

const CATEGORIES = ["Today", "Rock", "Pop", "Rap", "Electronic"];

const FEED = [
  { id: "1", title: "1", price: "£25", user: "alex" },
  { id: "2", title: "2", price: "£40", user: "jamie" },
];

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ 
        flexDirection: "row", 
        justifyContent: "space-between", 
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12
      }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>Fair Play</Text>

        <View style={{ flexDirection: "row", gap: 16 }}>
          <TouchableOpacity onPress={() => router.push("/explore")}>
            <Text>Search!</Text>
          </TouchableOpacity>
          <Text>Messages!</Text>
          <Text>Profile!</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <TextInput
          placeholder="Search for items..."
          placeholderTextColor="#888"
          style={{
            backgroundColor: "#f2f2f2",
            borderRadius: 12,
            padding: 12,
            fontSize: 16
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
              backgroundColor: "#eee",
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 20,
              marginRight: 10
            }}
          >
            <Text>{item}</Text>
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
              borderColor: "#e5e5e5",
              borderRadius: 16,
              marginBottom: 16,
              overflow: "hidden"
            }}
          >
            <View style={{ height: 160, backgroundColor: "#ddd" }} />

            <View style={{ padding: 12 }}>
              <Text style={{ fontWeight: "600" }}>{item.title}</Text>
              <Text style={{ marginTop: 4 }}>{item.price}</Text>
              <Text style={{ color: "#777", marginTop: 2 }}>
                @{item.user}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
