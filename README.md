# Agorex
### Escrow System to Combat Ticket Touting

**Fionn Reilly (20101977) — BSc (Hons) in Applied Computing, SETU Waterford**  
Supervised by Robert O'Connor

---

## Overview

Agorex is a secure, peer-to-peer mobile marketplace for reselling event tickets. The platform uses an escrow-based transaction architecture to guarantee the safe transfer of funds and tickets between users, Google Gemini to provide transparent AI-driven fair market valuations to suppress scalping, and automated dispute resolution to reduce the burden on human moderators.

The name comes from *Agora* (the central gathering place in ancient Greek cities) and *exchange*.

---

## Core Objectives

| | Objective | Status |
|---|---|---|
| O1 | Eliminate financial risk in P2P transfers via a state-driven escrow flow | ✅ |
| O2 | Suppress scalping through transparent AI-generated fair market valuations | ✅ |
| O3 | Assist dispute resolution by auto-generating investigation reports for human admins | ✅ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo) |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Edge Functions, Storage) |
| Payments | Stripe Connect |
| AI | Google Gemini API |
| Venue Data | Google Places API |
| Event Images | Spotify API |
| Push Notifications | Expo Push Notifications |
| Scheduled Jobs | pg_cron |

---

## Architecture

Agorex uses a serverless Client-BaaS architecture. The React Native client communicates with Supabase, which acts as the central data and authentication hub. Sensitive third-party API calls (Stripe, Gemini, Spotify, Google Places) are handled exclusively through Supabase Edge Functions — API keys never touch the client.

Real-time updates are powered by the PostgreSQL Write-Ahead Log (WAL). Supabase Realtime tails the WAL and broadcasts change events to connected clients via WebSockets, which is how offer messages, status updates, and system events appear instantly without polling.

---

## Escrow Lifecycle

```
active → pending → sold → complete
                       ↘ expired (auto-refund via pg_cron)
```

1. Buyer sends an offer — negotiated via real-time in-app messaging
2. `lock_listing()` RPC prevents concurrent purchases
3. Buyer pays via Stripe Payment Sheet
4. `stripe-webhook` receives `payment_intent.succeeded` and calls `mark_listing_sold()`
5. Seller receives push notification and transfers ticket externally
6. Buyer confirms receipt — `release-escrow` deducts 2% fee and routes funds to seller's Stripe Connect account
7. Both parties rate each other — gated by RLS policy on `ticket_received = true`

If the seller fails to transfer before the event date, the hourly `process-expired-pending` cron job automatically issues a full Stripe refund.

---

## Edge Functions

| Function | Trigger | Purpose |
|---|---|---|
| `stripe-server` | Frontend (`useCheckout`) | Initialises Stripe PaymentIntent |
| `stripe-webhook` | Stripe `payment_intent.succeeded` | Marks listing sold, notifies seller |
| `release-escrow` | Buyer confirms receipt | Transfers funds to seller |
| `stripe-connect` | User initiates onboarding | Creates Stripe Express account |
| `check-stripe-status` | Profile load | Verifies KYC completion |
| `generate-support-ticket` | DB webhook on ticket insert | AI dispute investigation |
| `get-artist-image` | Listing creation | Fetches Spotify artist image |
| `process-expired-pending` | pg_cron (hourly) | Auto-refunds undelivered tickets |

---

## Database Functions (RPCs)

| Function | Purpose |
|---|---|
| `lock_listing` | Atomically locks a listing to a buyer during checkout |
| `unlock_listing` | Releases lock on payment cancel or failure |
| `mark_listing_sold` | Sets status to sold, expires competing offers |
| `find_duplicate_event` | Fuzzy deduplication using `pg_trgm` |
| `get_or_create_dm` | Idempotent conversation creator |
| `confirm_ticket_received` | Buyer-gated escrow release trigger |
| `submit_and_update_rating` | Atomic review insert + trust score recalculation |

---

## Environment Variables

Create a `.env` file in the project root. **Never commit this file.**

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=
EXPO_PUBLIC_GEMINI_API_KEY=
```

Supabase Edge Function secrets are set via the Supabase CLI:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_CONNECT_SECRET=...
supabase secrets set SLACK_WEBHOOK_URL=...
supabase secrets set SPOTIFY_CLIENT_ID=...
supabase secrets set SPOTIFY_CLIENT_SECRET=...
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npx expo start --clear
```

Scan the QR code with the Expo Go app on your phone, or press `i` for iOS simulator / `a` for Android emulator.

To deploy Edge Functions:
```bash
supabase functions deploy
```

---

## Project Site

**[reifionn.github.io/FYP-Pages](https://reifionn.github.io/FYP-Pages)** — includes the dev blog, full report, and demo video.

---

## Licence

This project was developed as a Final Year Project at SETU Waterford and is not licensed for commercial use.
