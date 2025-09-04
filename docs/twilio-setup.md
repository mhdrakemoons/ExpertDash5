# Twilio Conversations Setup (Production)

Purpose: configure Twilio so an Angular 10 + Django app can power Baboo Travel’s messaging (replace TalkJS) using Twilio Conversations. This guide is practical, sequential, and mirrors how the current prototype works.

References:
- Twilio Conversations docs: https://www.twilio.com/docs/conversations
- Conversations Webhooks: https://www.twilio.com/docs/conversations/webhooks
- Conversations REST (Conversation): https://www.twilio.com/docs/conversations/api/conversation-resource
- Messages REST: https://www.twilio.com/docs/conversations/api/message-resource
- Participants REST: https://www.twilio.com/docs/conversations/api/participant-resource
- JS SDK Overview: https://www.twilio.com/docs/conversations/javascript/overview
- JS SDK Events: https://www.twilio.com/docs/conversations/javascript/event-handling

---

## 0) Prerequisites
- Twilio account with Conversations enabled
- One verified phone number or a Messaging Service (for SMS/WhatsApp relaying)
- Domains for Django API and Angular app (staging/production)
- Make.com scenario URLs (if you will relay messages to WhatsApp/SMS/Email)
- Twilio CLI installed (optional): https://twil.io/cli

---

## 1) Create or locate a Conversations Service
A Service is the top-level container for conversations, roles, and webhooks.

CLI (optional):
```bash
# Create a Service (returns an ISxxxxxxxx SID)
twilio api:conversations:v1:services:create --friendly-name "Baboo Service"

# List Services
twilio api:conversations:v1:services:list
```

Record the Service SID as `TWILIO_CONVERSATIONS_SERVICE_SID`.

---

## 2) Environment variables (Django)
Configure in your backend environment (e.g., `.env`, Docker secrets, or hosting env):

```bash
# Core account
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token

# Conversations service
TWILIO_CONVERSATIONS_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# (Optional) Messaging service / phone number used by Make.com relays
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# (Optional) Known role SIDs if you choose to lock specific roles
TWILIO_SERVICE_ADMIN_ROLE=RLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_SERVICE_USER_ROLE=RLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CHANNEL_ADMIN_ROLE=RLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CHANNEL_USER_ROLE=RLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Notes:
- Use Twilio API Key/Secret for minting tokens in production (more secure than Auth Token).
- Mapping we use: admin → Service/Channel Admin; expert → Service/Channel User; bot → admin-level for automation.

---

## 3) Webhooks (Twilio → Django)
Conversations will POST events to your Django endpoints. In Twilio Console:

Conversations → Services → [Your Service] → Configuration
- Webhook URL (single): `https://your-api.example.com/api/webhooks/twilio-event`
- Or configure specific event URLs:
  - Message Added: `https://your-api.example.com/api/webhooks/message-added`
  - Conversation State Updated: `https://your-api.example.com/api/webhooks/conversation-state-updated`
  - Participant Added: `https://your-api.example.com/api/webhooks/participant-added`
- Enable events:
  - onMessageAdded
  - onConversationStateUpdated
  - onParticipantAdded
  - onParticipantRemoved

Important:
- Payload is `application/x-www-form-urlencoded`.
- Validate `X-Twilio-Signature` (see docs). Always return HTTP 200 to prevent retries.

Mirror of prototype endpoints (Django versions):
- `POST /api/webhooks/message-added`
- `POST /api/webhooks/conversation-state-updated`
- `POST /api/webhooks/participant-added`
- `POST /api/webhooks/twilio-event` (generic)

---

## 4) Access Tokens (minted by Django)
Frontend never holds Twilio credentials. Django issues short-lived Access Tokens with the Conversations grant.

Python example (Django view):
```python
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import ChatGrant  # Conversations uses ChatGrant
from django.http import JsonResponse
from django.conf import settings

# POST /api/twilio/token { "identity": "user@example.com" }
def create_conversations_token(request):
    identity = request.POST.get("identity") or request.GET.get("identity")
    if not identity:
        return JsonResponse({"message": "identity required"}, status=400)

    token = AccessToken(
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_API_KEY,
        settings.TWILIO_API_SECRET,
        identity=identity,
    )

    grant = ChatGrant(service_sid=settings.TWILIO_CONVERSATIONS_SERVICE_SID)
    token.add_grant(grant)

    return JsonResponse({"token": token.to_jwt().decode("utf-8")})
```

Notes:
- Use API Key/Secret for signing. Identity must uniquely map to your user.

---

## 5) Initialize the Conversations JS SDK (Angular)
In the browser, connect with the token and listen for token/connection events.

TypeScript (service outline):
```ts
import { Client } from "@twilio/conversations";

export class TwilioClientService {
  private client?: Client;

  async init(getToken: () => Promise<string>) {
    const token = await getToken();
    this.client = new Client(token);

    this.client.on("connectionStateChanged", state => {
      console.log("Conversations connection:", state);
    });

    this.client.on("tokenAboutToExpire", async () => {
      const newToken = await getToken();
      await this.client?.updateToken(newToken);
    });

    this.client.on("tokenExpired", async () => {
      const newToken = await getToken();
      await this.client?.updateToken(newToken);
    });

    return this.client;
  }
}
```

Prototype parity:
- See `src/services/twilio.ts` and `src/services/twilioClient.ts`.

---

## 6) Creating conversations and participants (server-side)
Use REST to create a conversation, then add participants:
- Expert by `Identity`
- Traveler by `MessagingBinding` (Address, ProxyAddress)

cURL (JSON):
```bash
SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH=$(printf "%s:%s" "$TWILIO_ACCOUNT_SID" "$TWILIO_AUTH_TOKEN" | base64)

# Create conversation
curl -s -X POST \
  https://conversations.twilio.com/v1/Services/$SERVICE_SID/Conversations \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"FriendlyName":"Traveler X - Expert Y","UniqueName":"inquiry_123456789"}'

# Add expert by identity
curl -s -X POST \
  https://conversations.twilio.com/v1/Services/$SERVICE_SID/Conversations/$CONV_SID/Participants \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"Identity":"expert@example.com"}'

# Add traveler via messaging binding
curl -s -X POST \
  https://conversations.twilio.com/v1/Services/$SERVICE_SID/Conversations/$CONV_SID/Participants \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"MessagingBinding":{"Address":"+1234567890","ProxyAddress":"+1YOUR_TWILIO"}}'
```

Prototype parity: `backend/routes/inquiries.js`.

---

## 7) Sending messages (server-side)
Include `Attributes` to standardize sender identity (`{"from":"..."}`).

```bash
curl -s -X POST \
  https://conversations.twilio.com/v1/Services/$SERVICE_SID/Conversations/$CONV_SID/Messages \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"Body":"Hello from the expert!","Author":"expert@example.com","Attributes":{"from":"Alice Expert - Local Expert"}}'
```

Prototype parity:
- Authenticated send: `backend/routes/twilio.js`
- External send (Make.com): `backend/routes/external.js`

---

## 8) Webhook handling (Django)
- Parse `application/x-www-form-urlencoded`
- Validate `X-Twilio-Signature` if required
- Return HTTP 200 quickly; queue heavy work

```python
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse

@csrf_exempt
def message_added(request):
    # request.POST: ConversationSid, MessageSid, Author, Body, ...
    return HttpResponse("OK")
```

Events to start with: onMessageAdded, onConversationStateUpdated, onParticipantAdded.

---

## 9) Frontend display – the `from` attribute
Use `message.attributes.from` to render sender labels/colors:
- Bot, Baboo Team (admin), [Name] - Local Expert, [Name] - Traveler

Prototype parity: `src/utils/messageDisplay.ts` (frontend) and `backend/utils/messageUtils.js` (backend generation).

---

## 10) Testing checklist
- Token generation + SDK init reaches `connected`
- Conversation + participants created and visible in Console
- Message send triggers webhook and shows correct `from` in UI
- Token refresh on `tokenAboutToExpire`/`tokenExpired`

---

## Troubleshooting
- 403 / empty lists: ensure roles and list via backend, not only SDK
- Webhooks missing: verify HTTPS URL, check Twilio Console delivery logs, return 200
- Identity mismatches: Angular identity for token must match Conversations identity
- SMS/WhatsApp: ensure Messaging Service/number is configured; WhatsApp templates for new sessions

---

## What maps from the prototype
- Token/SDK init: `src/services/twilio.ts`, `src/services/twilioClient.ts`
- Listing via backend: `backend/routes/conversations.js`, `backend/services/twilioService.js`
- Creation & initial message: `backend/routes/inquiries.js`
- Message send with `from`: `backend/routes/twilio.js`, `backend/routes/external.js`
- Webhooks: `backend/routes/webhooks.js`
