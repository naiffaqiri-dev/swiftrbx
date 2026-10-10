# SwiftRBX Discord Bot

A persistent Discord.js ticket bot for SwiftRBX. It handles Robux and service tickets, buyer-side order confirmation, single-use website payment links, transfer-receipt notifications, and ticket transcripts.

## Setup

1. Install Node.js and npm on a host that can run a persistent Node process.
2. Copy `.env.example` to `.env` and set the required values. Never commit `.env` or share Discord/Supabase secrets.
3. Install the locked dependencies and start the bot from this directory:

   ```sh
   npm ci
   npm start
   ```

4. Keep `banner.jpg` beside `index.js`; it is used by the ticket panel.
5. Enable the Discord Message Content intent for the bot in the Discord Developer Portal. Invite it with permissions to view and send messages, manage ticket channels, create and manage public threads in the transcript channel, manage roles if notification-role controls are used, and read message history.

The bot is a long-running process and should be deployed to a persistent Node host, not a serverless function.

## Environment variables

Required:

- `DISCORD_TOKEN` — bot token. Keep it private.
- `SUPABASE_URL` — project URL.
- `SUPABASE_SECRET_KEY` — server-only Supabase secret/service-role key. `SUPABASE_SERVICE_ROLE_KEY` is also accepted as a fallback. Never use an anon/public key here.
- `PANEL_CHANNEL_ID` — channel where the ticket panel is posted.

Optional:

- `LIVE_STOCK_CHANNEL_ID` — live stock channel; defaults to `1481253146209681478`.
- `SITE_URL` — website origin used for checkout links; defaults to `https://www.swiftrbx.site`.
- `SUPPORT_ROLE_ID` — support role allowed in tickets.
- `SALER_ROLE_ID` or `SALES_ROLE_ID` — seller/support role allowed in tickets.
- `TICKETS_CATEGORY_ID` — parent category for created tickets.

The transcript archive and transfer-review channels are configured in `index.js`: transcript threads are created under channel `1426198826724888577`, and submitted transfer receipts are posted to channel `1558441717743751169`.

## Payment and data notes

The buyer confirms the order and seller details in Discord. The bot then issues a buyer-bound website link with a one-hour deadline. The website authenticates the linked buyer, accepts a single receipt submission, and stores the payment/order state in the existing Supabase tables. The bot polls submitted payment records and routes the receipt and order details to the transfer-review channel. Ticket creation, messages, closure, deletion, and payment status are copied into each ticket's transcript thread.

This bot expects the website's existing Supabase schema and RPCs. This package does not create or migrate database objects. Configure the same Supabase project used by the website.
