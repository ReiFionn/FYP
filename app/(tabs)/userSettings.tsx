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
    const [connectingStripe, setConnectingStripe] = useState(false);
    const [payoutsReady, setPayoutsReady] = useState(false);

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

                if (data.stripe_account_id) {
                    const { data: statusData } = await supabase.functions.invoke('check-stripe-status', {
                    body: { accountId: data.stripe_account_id }
                    });
                    if (statusData?.isComplete) {
                    setPayoutsReady(true);
                    }
                }
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
        setConnectingStripe(true);
        try {
            const returnUrl = Linking.createURL('/'); 
            
            const stripeReturnUrl = returnUrl.includes('exp://') || returnUrl.includes('192.168')
                ? 'https://google.com' // has to be added because it bugs while using Expo, would work in production
                : returnUrl;

            const { data, error } = await supabase.functions.invoke('stripe-connect', {
                body: { returnUrl: stripeReturnUrl }
            });

            if (error || !data?.url) throw error;

            const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);

            if (result.type === 'success') {
                console.log("Stripe onboarding complete!");
            } else {
                console.log("User closed the onboarding");
            }

            await fetchProfile();

        } catch (error) {
            console.error("Stripe Onboarding Error:", error);
            Alert.alert("Error", "Could not initiate Stripe connection.");
        } finally {
            setConnectingStripe(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

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
                borderColor: theme.border,
                borderRadius: 8,
                padding: 12,
                color: theme.text,
                backgroundColor: theme.tint
            }}
            />
            <TouchableOpacity 
            onPress={handleSaveProfile}
            disabled={saving}
            style={{ backgroundColor: theme.primary, padding: 12, borderRadius: 8, marginTop: 12, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
            >
            <Text style={{ color: theme.tint, fontWeight: 'bold' }}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
        </View>

        <View style={{ padding: 15, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>Payout Details</Text>
            <Text style={{ color: theme.tabIconDefault, marginTop: 4, marginBottom: 15 }}>
                To receive money from sold tickets, you must connect a bank account via Stripe.
            </Text>
            
            {payoutsReady ? (
                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Bank Account Connected!</Text>
            ) : (
                <TouchableOpacity 
                    onPress={handleConnectBank}
                    disabled={connectingStripe}
                    style={{ 
                        backgroundColor: theme.text, 
                        padding: 12, 
                        borderRadius: 8, 
                        alignItems: 'center',
                        opacity: connectingStripe ? 0.7 : 1
                    }}
                >
                    {connectingStripe ? (
                        <ActivityIndicator color={theme.background} size="small" />
                    ) : (
                        <Text style={{ color: theme.background, fontWeight: 'bold' }}>
                            {stripeAccountId ? 'Finish Setup' : 'Set Up Payouts'}
                        </Text>
                    )}
                </TouchableOpacity>
            )}
        </View>
        </ScrollView>
    );
}