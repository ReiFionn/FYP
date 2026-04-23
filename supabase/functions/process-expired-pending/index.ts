import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  try {
    const { data: expiredListings, error: fetchError } = await supabaseAdmin
      .from('listings')
      .select('id, payment_intent_id, events!inner(start_time)')
      .eq('status', 'sold')
      .eq('ticket_sent', false)
      .lt('events.start_time', new Date().toISOString())

    if (fetchError) throw fetchError
    if (!expiredListings || expiredListings.length === 0) {
      return new Response(JSON.stringify({ message: "No expired pending listings found." }), { status: 200 })
    }

    const results = []

    for (const listing of expiredListings) {
      try {
        if (listing.payment_intent_id) {
          await stripe.refunds.create({
            payment_intent: listing.payment_intent_id,
          })
        }

        const { error: updateError } = await supabaseAdmin
          .from('listings')
          .update({ status: 'expired' })
          .eq('id', listing.id)

        if (updateError) throw updateError

        results.push({ id: listing.id, status: 'success' })
      } catch (err: any) {
        console.error(`Failed to process listing ${listing.id}:`, err.message)
        results.push({ id: listing.id, status: 'failed', error: err.message })
      }
    }

    return new Response(JSON.stringify({ processed: results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})