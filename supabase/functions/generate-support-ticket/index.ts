import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import Stripe from "npm:stripe@14.25.0";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let ticketId = null;

  try {
    const payload = await req.json();
    ticketId = payload.record.id;
    const createdAt = payload.record.created_at;
    const ticketStatus = payload.record.status;
    const listingId = payload.record.listing_id;
    const reporterId = payload.record.reporter_id;
    const accusedId = payload.record.accused_id;
    const userMessage = payload.record.user_message;
    const issueType = payload.record.issue_type;

    const { data: currentTicket } = await supabaseAdmin
      .from('support_tickets')
      .select('status')
      .eq('id', ticketId)
      .single();

    if (currentTicket?.status === 'processing' || currentTicket?.status === 'investigated') {
      return new Response("Already being handled", { status: 200 });
    }

    await supabaseAdmin
      .from('support_tickets')
      .update({ status: 'processing' })
      .eq('id', ticketId);

    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('*, events(title)')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) throw new Error("Listing not found");

    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .or(`and(user1_id.eq.${reporterId},user2_id.eq.${accusedId}),and(user1_id.eq.${accusedId},user2_id.eq.${reporterId})`)
      .single();

    let chatLogs = [];
    if (conversation) {
      const { data: messages } = await supabaseAdmin
        .from('conversation_messages') 
        .select('sender_id, body, created_at, message_type, offer_amount, offer_status')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false }) 
        .limit(50);
      chatLogs = messages ? messages.reverse() : [];
    }

    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', listing.seller_id)
      .single();

    let stripeEvidence = "No Stripe data available.";
    if (sellerProfile?.stripe_account_id) {
        const transfers = await stripe.transfers.list({ destination: sellerProfile.stripe_account_id, limit: 5 });
        const relevant = transfers.data.find(t => t.description?.includes(listingId));
        stripeEvidence = relevant ? `Transfer found: €${relevant.amount/100}. Status: ${relevant.reversed ? 'Reversed' : 'Paid'}` : "No specific transfer found for this ID.";
    }

    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are a specialized Marketplace Dispute Investigator for a ticket-reselling platform.
      Your goal is to analyse the evidence and provide a verdict on whether a scam or error occurred.

      [THE PERFECT TRANSACTION STANDARD]
      1. PRE-SALE: All price negotiations occur via the 'offer' system.
      2. LOCK: Buyer pays full amount into Platform Escrow (Listing Status: 'sold').
      3. FULFILLMENT: Seller transfers ticket OUTSIDE OF THE PLATFORM.
      4. NOTIFICATION: Seller updates 'ticket_sent' to TRUE after transfer.
      5. VERIFICATION: Buyer verifies ticket is in their possession and updates 'ticket_received' to TRUE.
      6. RELEASE: Platform releases funds to Seller's Stripe Connect account.

      [SUPPORT TICKET METADATA]
      Ticket ID: ${ticketId}
      Created At: ${createdAt}
      Current Status: ${ticketStatus}

      [DISPUTE DETAILS]
      Reporter ID: ${reporterId}
      Accused ID: ${accusedId}
      Issue Type: ${issueType}
      User Message: "${userMessage}"

      [LISTING & ESCROW STATUS]
      Listing ID: ${listingId}
      Event: ${listing.events.title}
      Price: €${listing.listing_price}
      Database Escrow Status: ${listing.status}
      Confirmed Sent by Seller: ${listing.ticket_sent}
      Confirmed Received by Buyer: ${listing.ticket_received}

      [STRIPE EVIDENCE]
      ${stripeEvidence}

      [CHAT LOGS]
      ${JSON.stringify(chatLogs)}

      [INSTRUCTIONS]
      1. Review the chat logs for off-platform payment requests or proof of transfer.
      2. Check if the seller's Stripe data aligns with the transaction.
      3. Identify if either party is lying based on the DB flags (sent/received).
      4. Note the Timeline: Compare the Ticket 'Created At' time against the timestamps in the chat logs.
      5. Provide a CLEAR VERDICT (e.g., "Seller likely fraudulent", "Buyer error", "Refund recommended").
      
      Keep the verdict professional and data-driven for the admin team.
    `;

    const aiResult = await model.generateContent(prompt);
    const verdict = aiResult.response.text();

    const { error: dbError } = await supabaseAdmin
      .from('support_tickets')
      .update({ 
        ai_investigation_report: verdict,
        status: 'investigated' 
      })
      .eq('id', ticketId);

    if (dbError) throw new Error(`Database Update Failed: ${dbError.message}`);

    await fetch(Deno.env.get('SLACK_WEBHOOK_URL')!, {
        method: 'POST',
        body: JSON.stringify({
            text: `*Dispute Investigated*\n*Ticket:* ${ticketId}\n*Event:* ${listing.events.title}\n\n*Verdict:*\n${verdict}`
        })
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error: any) {
    if (ticketId && (error.message.includes('503') || error.message.includes('Service Unavailable'))) {
      await supabaseAdmin
        .from('support_tickets')
        .update({ status: 'open' })
        .eq('id', ticketId);
    }
    
    console.error("error:", error.message);
    return new Response(error.message, { status: 500 });
  }
});