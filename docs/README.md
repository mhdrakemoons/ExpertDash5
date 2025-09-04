# Baboo Travel Messaging Docs Index

Use this as your starting point. It links the full documentation set, gives you an implementation checklist, and points to official Twilio references.

---

## Implementation checklist (high-signal)

1) Twilio setup
- Create/confirm Conversations Service SID
- Set Service webhooks (single or specific URLs) to your Django endpoints
- Create an API Key/Secret for token minting
- Configure Messaging Service or Phone Number if relaying SMS/WhatsApp

2) Django backend
- Configure env vars (Account SID, Auth Token, API Key/Secret, Service SID)
- Implement token mint endpoint (Conversations grant)
- Implement conversations endpoints: list/paginate, details/participants
- Implement inquiries creation: conversation + participants + initial system message
- Implement message send: set `Attributes.from` when absent
- Implement webhook views: message-added, conversation-state-updated, participant-added (ACK 200, optional signature validation)
- Add `ConversationIndex` updates in webhook handlers; optional `MessageAudit`
- Enable CORS for Angular domains; add throttling except for webhooks and chat routes

3) Angular 10 frontend
- Install `@twilio/conversations`
- Add `AuthInterceptor` and `AuthGuard`
- Implement `TwilioClientService` with token refresh and connection state
- Build services: Conversations, Messages, Inquiries (all call Django)
- Build UI: conversations list, conversation view, message composer, inquiries view
- Render sender identity using `message.attributes.from` with role-based colors
- Use CDK Virtual Scroll for performance on long threads

4) End-to-end tests
- Initialize SDK (connected state)
- Create conversation via Django; verify in Twilio Console
- Send message; verify webhook fires and UI updates with correct `from`
- Token refresh path on `tokenAboutToExpire`/`tokenExpired`

5) Operations
- Turn on HTTPS, signature validation, structured logs
- Monitor Twilio Console delivery logs and webhook logs
- Configure alerts and dashboards (message throughput, webhook failures)

---

## How to navigate this docs set

- `docs/architecture.md`
  - What it is: System overview, roles, components, and Mermaid diagram.
  - You’ll learn: Who the actors are, how Angular ↔ Django ↔ Twilio ↔ Make.com connect, and which endpoints/services you need.

- `docs/twilio-setup.md`
  - What it is: Step-by-step Twilio Conversations setup (Service, env vars, webhooks, tokens, REST, SDK init).
  - You’ll learn: Exact Console settings, cURL examples for Conversations/Participants/Messages, SDK token refresh, and testing.

- `docs/backend-django.md`
  - What it is: Django integration guide (API design, token minting, creation flows, webhooks, integrations).
  - You’ll learn: View code outlines, model examples, how to aggregate lists, and how to call Make.com on outbound.

- `docs/frontend-angular.md`
  - What it is: Angular 10 guide (services, guard, interceptor, Twilio SDK client, UI components, virtual scrolling).
  - You’ll learn: How to wire HttpClient + SDK, paginate via backend, and display identities using `attributes.from`.

- `docs/webhooks.md`
  - What it is: Twilio → Django webhook guide.
  - You’ll learn: Which events to enable, exact payload fields, minimal Django handlers with optional signature validation, and test cURL payloads.

- `docs/data-model-and-from.md`
  - What it is: Data model and the `from` attribute strategy.
  - You’ll learn: Standard `from` values, backend generation rules, Angular rendering, webhook-driven index updates, and API response shapes.

- `docs/snippets-index.md`
  - What it is: Map from this prototype to reusable code patterns.
  - You’ll learn: Where to find working examples for auth, listing, creation, sending with `from`, and webhook parsing.

- `docs/foundation.md`
  - What it is: Planning blueprint that defined this documentation set.
  - You’ll learn: Goals, deliverables, questions answered, formatting rules, and acceptance criteria.

---

## Preview of key patterns

- Identity: All outbound messages should include `Attributes: { "from": "..." }`. Admin → "Baboo Team"; Expert → "{Name} - Local Expert"; Bot → "Bot"; Traveler → "{Name} - Traveler".
- Listing: Use Django to paginate conversations (fast + secure); SDK is primarily for real-time events.
- Webhooks: Parse URL-encoded form data; ACK 200; update a small `ConversationIndex` for quick list rendering.
- Integrations: Make.com posts traveler messages directly to Twilio; Django triggers Make.com on admin/expert outbound if you are relaying to external channels.

---

## External Twilio documentation (start here)

Core concepts
- Conversations Overview: https://www.twilio.com/docs/conversations
- Webhooks: https://www.twilio.com/docs/conversations/webhooks
- Service resource: https://www.twilio.com/docs/conversations/api/service-resource
- Service configuration: https://www.twilio.com/docs/conversations/api/service-configuration-resource

REST references
- Conversation: https://www.twilio.com/docs/conversations/api/conversation-resource
- Message: https://www.twilio.com/docs/conversations/api/message-resource
- Participant: https://www.twilio.com/docs/conversations/api/participant-resource

SDK (browser)
- JS SDK Overview: https://www.twilio.com/docs/conversations/javascript/overview
- Event Handling: https://www.twilio.com/docs/conversations/javascript/event-handling

Advanced
- Delivery Receipts: https://www.twilio.com/docs/conversations/delivery-receipts
- WhatsApp with Conversations: https://www.twilio.com/docs/whatsapp/tutorial/conversations

---

## Final notes
- Keep identities consistent: the token identity should match the expert/admin identity you add to Conversations.
- Always include `from` on outgoing messages (or let Django set it) to guarantee clean UI.
- Prefer backend aggregation for lists; rely on SDK for live updates.
- Return HTTP 200 fast in webhooks and do heavy work asynchronously.

You now have everything needed to rebuild the production dashboard with Angular 10 + Django using Twilio Conversations, grounded in this repository’s working patterns.
