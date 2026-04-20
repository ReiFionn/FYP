import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^16.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { listingId } = await req.json();
    if (!listingId) throw new Error("No listingId provided in the request body");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('*, events(title)') 
      .eq('id', listingId)
      .single();

    if (listingError) throw new Error(`DB Error: ${listingError.message}`);
    if (!listing) throw new Error("Listing not found in database");
    if (listing.active_buyer_id !== user.id) throw new Error("Only the buyer can release funds");    
    if (listing.ticket_received) throw new Error("Funds already released");

    const { data: sellerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', listing.seller_id)
      .single();

    if (profileError) throw new Error(`Profile DB Error: ${profileError.message}`);
    if (!sellerProfile?.stripe_account_id) throw new Error("Seller has no Stripe Connect account");

    const platformFeePercentage = 0.02; 
    const finalPrice = listing.listing_price;
    const amountToTransfer = Math.round(finalPrice * (1 - platformFeePercentage) * 100); 

    const transfer = await stripe.transfers.create({
      amount: amountToTransfer,
      currency: 'eur',
      destination: sellerProfile.stripe_account_id,
      description: `Payout for Ticket: ${listing.events?.title || listingId}`,
    });

    await supabaseAdmin
      .from('listings')
      .update({ ticket_received: true })
      .eq('id', listingId);

    return new Response(JSON.stringify({ success: true, transferId: transfer.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});