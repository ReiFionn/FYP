import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!);
  
  try {
    const body = await req.json();
    const { listingId } = body;

    if (!listingId) {
      return new Response(JSON.stringify({ error: "Missing listingId" }), { status: 400 });
    }

    const { data: listing, error: dbError } = await supabase
      .from('listings')
      .select('listing_price')
      .eq('id', listingId)
      .single();

    if (dbError || !listing) {
      return new Response(JSON.stringify({ error: "Listing not found" }), { status: 404 });
    }

    const amountInCents = Math.round(listing.listing_price * 100);

    const customer = await stripe.customers.create({});

    const customerSession = await stripe.customerSessions.create({
      customer: customer.id,
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
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        customerSessionClientSecret: customerSession.client_secret,
        customer: customer.id,
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