import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^16.0.0";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      endpointSecret
    );

    console.log(`Webhook received: ${event.type}`);

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const purchasedListingId = paymentIntent.metadata.listingId;
        const buyerId = paymentIntent.metadata.buyerId;
        const offerId = paymentIntent.metadata.offerId;
        
        if (purchasedListingId && buyerId) {
          const { error: rpcError } = await supabaseAdmin.rpc('mark_listing_sold', {
              p_listing_id: purchasedListingId,
              p_buyer_id: buyerId
          });

          if (rpcError) console.error("DB RPC Error:", rpcError);

          if (offerId && offerId !== 'none') {
              await supabaseAdmin
                  .from('conversation_messages')
                  .update({ offer_status: 'paid' })
                  .eq('id', offerId);
          }

          const { data: listing } = await supabaseAdmin
            .from('listings')
            .select('seller_id')
            .eq('id', purchasedListingId)
            .single();

          if (listing?.seller_id) {
            const { data: sellerProfile } = await supabaseAdmin
                .from('profiles')
                .select('push_token')
                .eq('id', listing.seller_id)
                .single();

            if (sellerProfile?.push_token) {
              await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: {
                      'Accept': 'application/json',
                      'Accept-encoding': 'gzip, deflate',
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                      to: sellerProfile.push_token,
                      sound: 'default',
                      title: 'Ticket Sold!',
                      body: 'Someone just paid for your ticket. Please transfer it to the buyer now.',
                      data: { listingId: purchasedListingId }, // Allows the app to route them when tapped
                  }),
              });
            }
          }
        }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});