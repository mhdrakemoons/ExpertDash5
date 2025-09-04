# Architecture Overview: Baboo Travel Production Messaging

## Purpose
Provide a concise, implementation-oriented view of how to rebuild the current prototype as a production system using Angular 10 (frontend), Django (backend), and Twilio Conversations (messaging), replacing TalkJS.

## Actors and roles
- Admin: Manages all conversations, can DM traveler and expert.
- Local Expert: Handles assigned traveler conversations, accepts conversations before viewing.
- Traveler: Communicates via WhatsApp/SMS/Email; messages are proxied by Make.com as bot messages into Twilio.
- Bot (Automation): Middleman identity used by Make.com to append traveler messages and trigger outbound delivery.

## Core components
- Angular 10 Frontend
  - Auth guard and JWT storage
  - Conversations UI (list/detail), message composer, inquiries UI
  - Twilio JS SDK client for live updates and events
  - REST calls to Django for listing, pagination, participants, inquiries, and token minting
- Django Backend (DRF)
  - Auth endpoints and Twilio Conversations Access Token minting
  - Conversations proxy endpoints (list/paginate/participants)
  - Inquiries creation (creates Twilio conversation via REST JSON + participants)
  - Messaging endpoints (authenticated send with `attributes.from`)
  - Webhook endpoints for Twilio events (URL-encoded payload) and generic handler
  - Role management mapping (admin/expert/bot) to Twilio service/channel roles
- Twilio Conversations
  - Service, users, roles, conversations, participants, messages
  - Webhook delivery to Django
- Make.com
  - Sends traveler messages directly to Twilio (REST)
  - Receives admin/expert outbound intents (Django → Make webhook → traveler channel)

## Conversation types
- Main conversation (Admin + Expert + Bot; traveler proxied by bot)
- Admin ↔ Traveler DM (expert excluded)
- Admin ↔ Expert DM (internal only; not routed to traveler)

## Identity and display
- Standardize sender identity via Twilio message `attributes.from`:
  - Admin → "Baboo Team"
  - Expert → "[Name] - Local Expert"
  - Traveler → "[Name] - Traveler" (when available via context)
  - Bot → "Bot"

## High-level flow (diagram)

```mermaid
flowchart LR
  subgraph UI[User Interface (Angular 10)]
    A[Admin Dashboard]
    E[Expert Dashboard]
  end

  subgraph Core[Core System (Django)]
    API[REST API]
    AUTH[Authentication]
    DB[(Database)]
  end

  subgraph Twilio[Twilio Integration]
    TSDK[JS SDK (browser)]
    TAPI[(Conversations REST)]
    TWH[Twilio Webhooks]
  end

  subgraph Ext[External]
    MAKE[Make.com]
  end

  A -- JWT --> AUTH
  E -- JWT --> AUTH
  AUTH -- Access Token --> A
  AUTH -- Access Token --> E

  A <-- list/paginate --> API
  E <-- list/paginate --> API
  API <-- DB models --> DB

  A -- live events --> TSDK
  E -- live events --> TSDK
  TSDK --- TAPI

  API <--> TAPI
  TWH --> API

  MAKE --> TAPI
  API --> MAKE
```

## Backend endpoints (Django parity)
- Auth
  - POST `/api/auth/login`
  - GET `/api/auth/me`
  - POST `/api/twilio/token` – mint Conversations token with grants
- Conversations
  - GET `/api/conversations?page=&limit=` – backend-aggregated list
  - GET `/api/conversations/{sid}` – details and participants
  - GET `/api/conversations/{sid}/messages` – paginated messages (optional)
- Messaging
  - POST `/api/twilio/message` – send message with optional `from`, default by role
- Inquiries
  - POST `/api/inquiries` – create Twilio conversation (REST JSON), add participants, send initial system message, persist record
  - GET `/api/inquiries` – list (admin all, expert assigned)
- Webhooks (Twilio → Django)
  - POST `/api/webhooks/message-added`
  - POST `/api/webhooks/conversation-state-updated`
  - POST `/api/webhooks/participant-added`
  - POST `/api/webhooks/twilio-event` (generic)

## Angular services (outline)
- AuthService: login, token storage, `getTwilioToken()`
- ConversationsService: list/paginate conversations via Django
- TwilioClientService: initialize JS SDK with token, handle `tokenExpired` and connection events
- MessagesService: send messages via Django; parse/display `attributes.from`
- InquiriesService: create/list inquiries; handle acceptance flows

## Twilio specifics to implement
- Conversations Service SID and Messaging Service (optional)
- Roles mapping and user provisioning (admin/expert/bot)
- Webhooks enabled: `onMessageAdded`, `onConversationStateUpdated`, `onParticipantAdded`, `onParticipantRemoved`
- Token minting with Conversations grant
- REST JSON usage for ConversationWithParticipants and Messages
- Signature validation for webhooks; 200 OK responses

## Security and operations
- CORS allowlist for Angular app domain(s)
- Throttling for public endpoints; exemptions for webhooks and authenticated chat routes
- Structured logging for webhook processing
- Environment variables for secrets and Twilio credentials

## References to prototype (for snippet extraction)
- See `docs/snippets-index.md` to map to:
  - Frontend: `src/services/twilio.ts`, `src/utils/messageDisplay.ts`, dashboard components
  - Backend: `backend/routes/twilio.js`, `backend/routes/inquiries.js`, `backend/routes/conversations.js`, `backend/utils/messageUtils.js`, `backend/server.js`
