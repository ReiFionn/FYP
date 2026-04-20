import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Settings() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
        .from('profiles')
        .select('display_name, stripe_account_id')
        .eq('id', user.id)
        .single();

        if (data) {
        setDisplayName(data.display_name || '');
        setStripeAccountId(data.stripe_account_id);
        }
        setLoading(false);
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
        const { error } = await supabase
            .from('profiles')
            .update({ display_name: displayName })
            .eq('id', user.id);
            
        if (error) Alert.alert('Error', error.message);
        else Alert.alert('Success', 'Profile updated');
        }
        setSaving(false);
    };

    const handleConnectBank = async () => {
        try {
            const returnUrl = Linking.createURL('/'); 

            const { data, error } = await supabase.functions.invoke('stripe-connect', {
            body: { returnUrl }
            });

            if (error || !data?.url) throw error;

            const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);

            if (result.type === 'success') {
            console.log("Stripe onboarding complete!");
            } else {
            console.log("User cancelled the onboarding");
            }

        } catch (error) {
            console.error("Stripe Onboarding Error:", error);
        }
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.background, padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text, marginBottom: 20 }}>Settings</Text>

        <View style={{ marginBottom: 30 }}>
            <Text style={{ color: theme.text, marginBottom: 8, fontWeight: '600' }}>Display Name</Text>
            <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={{
                borderWidth: 1,
                borderColor: theme.icon,
                borderRadius: 8,
                padding: 12,
                color: theme.text,
                backgroundColor: theme.background
            }}
            />
            <TouchableOpacity 
            onPress={handleSaveProfile}
            disabled={saving}
            style={{ backgroundColor: '#0284c7', padding: 12, borderRadius: 8, marginTop: 12, alignItems: 'center' }}
            >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
        </View>

        <View style={{ padding: 15, backgroundColor: theme.icon, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>Payout Details</Text>
            <Text style={{ color: theme.tabIconDefault, marginTop: 4, marginBottom: 15 }}>
                To receive money from sold tickets, you must connect a bank account via Stripe.
            </Text>
            
            {stripeAccountId ? (
            <Text style={{ color: '#166534', fontWeight: 'bold' }}>Bank Account Connected!</Text>
            ) : (
            <TouchableOpacity 
                onPress={handleConnectBank}
                style={{ backgroundColor: '#635BFF', padding: 12, borderRadius: 8, alignItems: 'center' }}
            >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Set Up Payouts</Text>
            </TouchableOpacity>
            )}
        </View>
        </ScrollView>
    );
}