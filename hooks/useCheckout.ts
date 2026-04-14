import { supabase } from "@/lib/supabase";
import { useStripe } from "@stripe/stripe-react-native";
import { Alert } from "react-native";

export function useCheckout() {
    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    const processCheckout = async (listingId: string, buyerId: string, offerId?: string) => {
        try {
        const { error: lockError } = await supabase.rpc('lock_listing', {
            p_listing_id: listingId,
            p_buyer_id: buyerId
        });

        if (lockError) throw new Error("This ticket is currently locked by another buyer.");

        const { data, error } = await supabase.functions.invoke('stripe-server', {
            body: { listingId, buyerId, offerId } 
        });

        if (error || !data?.paymentIntent) {
            await supabase.rpc('unlock_listing', { p_listing_id: listingId });
            throw new Error("Could not initialise payment.");
        }

        const { error: initError } = await initPaymentSheet({
            merchantDisplayName: "Agorex",
            customerId: data.customer,
            customerEphemeralKeySecret: data.ephemeralKey,
            paymentIntentClientSecret: data.paymentIntent,
            allowsDelayedPaymentMethods: true,
        });

        if (initError) {
            await supabase.rpc('unlock_listing', { p_listing_id: listingId });
            throw initError;
        }

        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
            await supabase.rpc('unlock_listing', { p_listing_id: listingId });
            return false;
        }

        Alert.alert("Success", "Your order is confirmed!");
        return true;

        } catch (e: any) {
        await supabase.rpc('unlock_listing', { p_listing_id: listingId });
        Alert.alert("Payment Error", e.message);
        return false;
        }
    };

    return { processCheckout };
}