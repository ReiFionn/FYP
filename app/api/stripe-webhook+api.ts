import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!);

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

    switch(event.type) {
        case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const purchasedListingId = paymentIntent.metadata.listingId;
        
        console.log(`Payment succeeded for listing: ${purchasedListingId}`);
        
        // TODO: ADD SUPABASE UPDATE LOGIC 
        break;

        case 'payout.paid':
        console.log('Funds have transferred to bank account');
        break;

        default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}

// https://www.youtube.com/watch?v=DsXz90g7gEk, https://docs.stripe.com/webhooks