import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!);
  const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    const body = await req.json();
    const { listingId, buyerId } = body;

    if (!listingId || !buyerId) {
      return new Response(JSON.stringify({ error: "Missing listingId or buyerId" }), { status: 400 });
    }

    const { data: listing, error: dbError } = await supabaseAdmin
      .from('listings')
      .select('listing_price')
      .eq('id', listingId)
      .single();

    if (dbError || !listing) {
      return new Response(JSON.stringify({ error: "Listing not found" }), { status: 404 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', buyerId).single();
    
    if (profileError) {
      return new Response(JSON.stringify({ error: "Error fetching buyer profile" }), { status: 500 });
    }

    let stripeCustomerId = profile?.stripe_customer_id;

    const amountInCents = Math.round(listing.listing_price * 100);

    if (!stripeCustomerId) {
      const newCustomer = await stripe.customers.create({});
      stripeCustomerId = newCustomer.id;

      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', buyerId);
    }

    const customerSession = await stripe.customerSessions.create({
      customer: stripeCustomerId,
      components: {
        mobile_payment_element: {
          enabled: true,
          features: {
            payment_method_save: "enabled",
            payment_method_redisplay: "enabled",
            payment_method_remove: "enabled",
          },
        },
      },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      customer: stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: { listingId },
    });

    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        customerSessionClientSecret: customerSession.client_secret,
        customer: stripeCustomerId,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Stripe error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}