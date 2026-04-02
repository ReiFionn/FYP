import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!);

const supabaseAdmin = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!; 

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(payload, signature!, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const purchasedListingId = paymentIntent.metadata.listingId;
        
        if (purchasedListingId) {
        const { error } = await supabaseAdmin
            .from('listings')
            .update({ status: 'sold' })
            .eq('id', purchasedListingId);

        if (error) {
            console.error("DB Error:", error);
            return new Response("Database Error", { status: 500 });
        }
        console.log(`Listing ${purchasedListingId} sold.`);
        }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}

// https://www.youtube.com/watch?v=DsXz90g7gEk, https://docs.stripe.com/webhooks, https://docs.stripe.com/webhooks/handling-payment-events?lang=node, 
// https://supabase.com/docs/guides/database/secure-data 