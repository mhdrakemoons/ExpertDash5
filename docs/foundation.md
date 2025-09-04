# Foundation Plan: Baboo Travel Production Messaging Dashboard

This document is the blueprint for producing a full developer-facing documentation set to rebuild the current React/Express/Twilio prototype as a production system using Angular 10 and Django while replacing TalkJS with Twilio Conversations.

## Goals and non-goals

- Goals
  - Provide an end-to-end implementation guide centered on Twilio Conversations that mirrors Baboo Travel workflows (main triad chat, admin↔traveler DMs, admin↔expert DMs).
  - Document how the prototype achieves auth, conversation listing, message sending, the "from" attribute strategy, and webhook processing; extract reusable patterns and code references.
  - Specify Twilio Conversations service setup, tokens, roles, webhooks, SDK usage, and REST calls; define required configuration and security.
  - Plan Angular 10 UI and services and Django endpoints that correspond to existing flows.
  - Define data model expectations and persistence concerns (Supabase used here; production will use Django ORM and Postgres; keep storage-agnostic guidance).
- Non‑goals
  - Rewriting business logic in this doc; we document patterns and provide guidance, not full code ports.
  - In-depth Django or Angular tutorials; we reference official docs where appropriate.

## Documentation deliverables (to be produced after this plan)

1. docs/architecture.md – System overview, context diagrams, roles, and flows
2. docs/twilio-setup.md – Twilio service configuration, tokens, roles, and webhook setup
3. docs/conversations.md – Conversation types, creation patterns, listing/pagination, participants
4. docs/messaging.md – Message sending patterns, attributes ("from"), media, typing indicators
5. docs/webhooks.md – Event matrix, payloads, Django endpoints, signature verification
6. docs/frontend-angular.md – Angular 10 app structure, Twilio JS SDK usage, state and services
7. docs/backend-django.md – API design, auth, conversation proxies, data model, integrations
8. docs/migration-talkjs.md – Replacing TalkJS with Twilio Conversations: feature parity and gaps
9. docs/operations.md – Security, CORS, rate limiting, logging, monitoring, environments
10. docs/snippets-index.md – Cross-reference to prototype files and canonical snippets

## Key questions to answer (and how we will answer them)

1. Authentication and identity
   - Q: How do we authenticate users and mint Twilio tokens?
   - Source: `src/contexts/AuthContext.tsx`, `src/services/api.ts`, `backend/routes/auth.js`, `backend/routes/twilio.js` token endpoint.
   - Production: Django view to validate JWT/session and return Conversations Access Token with correct grants.

2. Conversation taxonomy and lifecycle
   - Q: What conversation types exist (main triad, admin↔traveler, admin↔expert) and who can see them? When/how are they created?
   - Source: `backend/routes/inquiries.js` (creation), `backend/services/twilioService.js`, diagram and README.
   - Production: Define Django services to create conversations via Twilio REST JSON and add participants/roles.

3. Conversation listing and pagination
   - Q: How are conversations listed efficiently and securely?
   - Source: Frontend loads via backend aggregation (`apiService.getMainConversations`), backend `routes/conversations.js` and `services/twilioService.js`.
   - Production: Django endpoints to paginate conversations and expose minimal fields; Angular uses these instead of bulk SDK listing.

4. Messaging and "from" attribute
   - Q: How is sender identity standardized and displayed?
   - Source: `backend/utils/messageUtils.js`, `backend/routes/twilio.js` and `routes/external.js`; frontend `src/utils/messageDisplay.ts`; `FROM_ATTRIBUTE_GUIDE.md`.
   - Production: Preserve `attributes.from` contract; generate by role; parse and style on the Angular side.

5. External integrations via Make.com
   - Q: How do external traveler messages enter Twilio, and how do outgoing messages reach travelers?
   - Source: `TWILIO_SETUP_GUIDE.md`, `backend/routes/external.js`, webhook routes; diagram.
   - Production: Keep Make.com → Twilio direct; Twilio → Django webhooks; Admin/Expert sends → Django triggers Make.com webhook for delivery to WhatsApp/SMS/Email.

6. Webhooks and event processing
   - Q: Which events are handled and how are payloads parsed and acknowledged?
   - Source: `backend/README.md` webhook list, `backend/routes/webhooks.js` (URL-encoded parsing), examples in guides.
   - Production: Django views for `onMessageAdded`, `onConversationStateUpdated`, `onParticipantAdded`, plus generic handler; Twilio signature verification; always 200 OK.

7. Roles and permissions
   - Q: How are Twilio Conversations roles assigned and enforced?
   - Source: `backend/services/twilioRoleService.js` and usage in inquiries creation and token minting.
   - Production: Define mapping: admin → Service/Channel Admin; expert → Service/Channel User; bot user as admin for automation.

8. Data storage and models
   - Q: What do we store about inquiries, users, message audit, acceptance state?
   - Source: `backend/routes/inquiries.js` SQL, `backend/routes/expertAcceptance.js`, `backend/routes/admin.js`, Supabase migrations directory.
   - Production: Translate to Django models (Users, Inquiries, ConversationIndex, Acceptance, AuditLog), scoped to Angular needs.

9. Security and operations
   - Q: What protections exist (CORS, Helmet, rate limiting, webhook verification), and how are environments configured?
   - Source: `backend/server.js` CORS + Helmet + limiter; `CLOUD_RUN_MIGRATION_GUIDE.md` for deployment practices.
   - Production: Django middlewares, DRF throttling, CORS allowlist, Twilio signature validation, environment variables and secrets.

10. Replacing TalkJS with Twilio
   - Q: What TalkJS features map to Twilio features and where are gaps?
   - Source: Diagram/description; prototype flows; Twilio docs.
   - Production: Define parity matrix (threads ↔ conversations, participants, typing, read receipts, attachments, moderation, roles).

## Code references to mine from prototype (snippet index targets)

- Frontend
  - `src/App.tsx` – Routing between auth and dashboard
  - `src/contexts/AuthContext.tsx` – Auth restore/validate pattern
  - `src/components/dashboard/Dashboard.tsx` – Conversations pagination strategy
  - `src/components/dashboard/*` – Inquiries UI, message views, acceptance modal
  - `src/utils/messageDisplay.ts` – Parsing `attributes.from` and style mapping
  - `src/services/twilio.ts` – Twilio token fetch + SDK init + event wiring
  - `src/services/twilioClient.ts` – Client lifecycle and `tokenExpired`
- Backend
  - `backend/server.js` – CORS/Helmet/rate limiting
  - `backend/routes/twilio.js` – Authenticated send with `attributes.from`
  - `backend/routes/external.js` – External send via REST JSON with `Attributes`
  - `backend/routes/conversations.js` + `services/twilioService.js` – Paginated lists and details
  - `backend/routes/inquiries.js` – Conversation creation, initial system message, DB record
  - `backend/routes/webhooks.js` – URL-encoded parsing and handlers
  - `backend/utils/messageUtils.js` – `generateFromAttribute`, parsing, display info

## External documentation to consult (and cite in final docs)

- Twilio Conversations
  - Access Tokens (Conversations grant)
  - REST API: Conversations, ConversationWithParticipants, Participants, Messages
  - Webhooks: event types, payloads, and signature validation
  - JS SDK (`@twilio/conversations`): client init, events, pagination, token refresh
- Angular 10
  - HttpClient, interceptors (auth), RxJS streams, CDK Overlay/Virtual Scroll for message lists
  - Lazy modules and route guards for admin/expert views
- Django / Django REST Framework
  - AuthN/AuthZ integration for token minting
  - ViewSets for conversations proxying and webhook endpoints
  - DRF throttling and CORS configuration

## Formatting and style standards for the documentation set

- Structure
  - Each doc begins with Purpose, Scope, and Prerequisites.
  - Include an at-a-glance diagram where useful (Mermaid diagrams in markdown).
  - Provide “Copy/paste” ready snippets (Angular service methods, Django views, Twilio curl examples).
- Referencing
  - Cross-link sections with relative links.
  - Quote prototype code via path+line citations and minimal excerpts.
- Conventions
  - Use explicit configuration blocks for env vars.
  - Use consistent role names: `admin`, `expert`, `bot`, `traveler`.
  - All webhook handlers must return HTTP 200 on success to prevent retries.

## Acceptance criteria

- Twilio
  - Conversations service configured; webhooks registered and verified; tokens minted from Django; roles applied.
  - Angular can list conversations via Django endpoints and receive real-time updates via SDK.
  - Messages sent by Admin/Expert include `attributes.from`; external messages received and displayed with correct identity.
- Docs
  - Each deliverable produced with working examples and references to prototype.
  - Migration guidance from TalkJS clearly outlines mapping and caveats.

## Risks and mitigations

- Token refresh and SDK reconnection
  - Plan: Implement Twilio token refresh endpoint and client-side handling in Angular; test `tokenExpired` path.
- Webhook delivery failures
  - Plan: Signature validation, idempotency keys, 200 OK responses, logging and retries.
- Role drift / permission denials
  - Plan: Centralize role assignment in Django services and on-demand checks before conversation joins.

## Next steps checklist

- [ ] Build docs/architecture.md scaffold and diagram
- [ ] Draft docs/twilio-setup.md with concrete service config
- [ ] Extract snippet references into docs/snippets-index.md
- [ ] Document Angular 10 services and components for conversations/messages
- [ ] Document Django endpoints and serializers for conversations/messages/webhooks
- [ ] Write migration-talkjs.md parity matrix
