# Webhooks: Twilio Conversations → Django

Use this guide to wire Twilio Conversations events to your backend. It explains what Twilio sends, when it sends it, and what to do. This follows Twilio’s docs and mirrors our prototype.

References:
- Twilio Conversations Webhooks: [Webhooks guide](https://www.twilio.com/docs/conversations/webhooks)
- Conversations REST (Message): [Message resource](https://www.twilio.com/docs/conversations/api/message-resource)
- Conversations REST (Conversation): [Conversation resource](https://www.twilio.com/docs/conversations/api/conversation-resource)

---

## 1) What webhooks are and how they work
- Twilio sends HTTP POST requests to your public URL when events occur in your Conversations Service.
- Payloads use `application/x-www-form-urlencoded` (key-value pairs).
- You respond with HTTP 200 quickly. Do heavy processing asynchronously.
- Verify requests with `X-Twilio-Signature` to ensure the call is from Twilio.

We recommend a single generic endpoint for most events plus optional specific endpoints for critical flows.

---

## 2) Endpoints to expose (Django)
- `POST /api/webhooks/twilio-event` (generic – receives all enabled events)
- `POST /api/webhooks/message-added` (specific – new message)
- `POST /api/webhooks/conversation-state-updated` (specific – status changes)
- `POST /api/webhooks/participant-added` (specific – participant joins)

Configure these URLs in the Conversations Service Webhook settings (see `docs/twilio-setup.md`).

---

## 3) Events you should enable
- **onMessageAdded** – fired when a message is created in a conversation (SDK, API, or external channel).
- **onConversationStateUpdated** – fired when a conversation state changes (e.g., `active`, `inactive`, `closed`).
- **onParticipantAdded** – fired when a participant is added (identity or messaging binding). 
- **onParticipantRemoved** – optional, to track departures/cleanup.

These match our conversation lifecycle and inbox updates.

---

## 4) Payloads: what Twilio sends
Payloads are simple form fields. The exact set varies by event. The most useful fields for us:

onMessageAdded (subset):
- `ConversationSid` – e.g., `CHxxxxxxxx...`
- `MessageSid` – e.g., `IMxxxxxxxx...`
- `Author` – usually the sender identity (email/identifier) or `system`
- `Body` – text message content
- `ParticipantSid` – sender participant SID
- `DateCreated` – ISO timestamp
- `Attributes` – JSON string of attributes (when provided), e.g., `{ "from": "Baboo Team" }`

onConversationStateUpdated (subset):
- `ConversationSid`
- `ConversationState` – `active`, `inactive`, `closed`
- `FriendlyName`, `UniqueName` – if set when created

onParticipantAdded (subset):
- `ConversationSid`
- `ParticipantSid`
- `Identity` – if added by identity (experts/admins)
- `MessagingBinding.Address` / `MessagingBinding.ProxyAddress` – if added by external channel (traveler via SMS/WhatsApp)

Note: Many payloads also include a generic `EventType` when using a single generic endpoint.

---

## 5) Minimal Django handlers
Parse URL-encoded data, optionally validate signature, ACK quickly.

```python
# urls.py
from django.urls import path
from . import views
urlpatterns = [
    path('api/webhooks/twilio-event', views.twilio_event),
    path('api/webhooks/message-added', views.message_added),
    path('api/webhooks/conversation-state-updated', views.conversation_state_updated),
    path('api/webhooks/participant-added', views.participant_added),
]
```

```python
# views.py
import json
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from twilio.request_validator import RequestValidator


def _is_valid_twilio_request(request):
    # Optional but recommended
    validator = RequestValidator(getattr(settings, 'TWILIO_AUTH_TOKEN', ''))
    url = request.build_absolute_uri()
    post = request.POST.dict()
    signature = request.META.get('HTTP_X_TWILIO_SIGNATURE', '')
    return validator.validate(url, post, signature)


def _ok():
    return HttpResponse('OK')


@csrf_exempt
def twilio_event(request):
    # if not _is_valid_twilio_request(request):
    #     return HttpResponse(status=403)
    event_type = request.POST.get('EventType', 'unknown')
    conversation_sid = request.POST.get('ConversationSid')
    # TODO: enqueue processing by event type; keep this handler fast
    return _ok()


@csrf_exempt
def message_added(request):
    # if not _is_valid_twilio_request(request):
    #     return HttpResponse(status=403)
    convo = request.POST.get('ConversationSid')
    msg = request.POST.get('MessageSid')
    author = request.POST.get('Author')
    body = request.POST.get('Body')
    attributes_raw = request.POST.get('Attributes')
    from_label = None
    if attributes_raw:
        try:
            from_label = json.loads(attributes_raw).get('from')
        except Exception:
            pass
    # TODO: persist to DB, broadcast to UI, update unread counters
    return _ok()


@csrf_exempt
def conversation_state_updated(request):
    # if not _is_valid_twilio_request(request):
    #     return HttpResponse(status=403)
    convo = request.POST.get('ConversationSid')
    state = request.POST.get('ConversationState')
    # TODO: update status in DB
    return _ok()


@csrf_exempt
def participant_added(request):
    # if not _is_valid_twilio_request(request):
    #     return HttpResponse(status=403)
    convo = request.POST.get('ConversationSid')
    participant = request.POST.get('ParticipantSid')
    identity = request.POST.get('Identity')
    # MessagingBinding fields come as flat keys
    address = request.POST.get('MessagingBinding.Address')
    proxy = request.POST.get('MessagingBinding.ProxyAddress')
    # TODO: attach participant to internal records
    return _ok()
```

Notes:
- Uncomment signature validation in production.
- Use idempotency: ignore duplicates (Twilio may retry on non-200 responses).
- Log important fields; avoid logging message bodies if sensitive.

---

## 6) What to do when each event fires (Baboo flows)
- **onMessageAdded**
  - Update conversation’s last message, bump it in lists.
  - If `attributes.from` is present, store it; otherwise derive display identity from author/role.
  - If the message is from an Admin/Expert (inside the dashboard), optionally trigger Make.com to deliver to the traveler’s channel (WhatsApp/SMS/Email) – this is how our prototype routes outbound.
- **onConversationStateUpdated**
  - Track status (`active`/`inactive`/`closed`) to control filtering and archiving.
- **onParticipantAdded**
  - If participant is an expert identity, check/assign roles.
  - If participant is a traveler (messaging binding), associate their contact with the inquiry.

---

## 7) Testing webhooks locally
Use `ngrok` or similar to expose Django, then send sample payloads (mirrors our prototype testing).

```bash
# Message Added
curl -X POST https://your-api.example.com/api/webhooks/message-added \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "ConversationSid=CHtest123&MessageSid=IMtest123&Author=test&Body=Hello&DateCreated=2024-01-15T10:30:00Z&Attributes=%7B%22from%22%3A%22Bot%22%7D"

# Conversation State Updated
curl -X POST https://your-api.example.com/api/webhooks/conversation-state-updated \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "ConversationSid=CHtest123&ConversationState=active&FriendlyName=Test"
```

---

## 8) Operational guidance
- Always return 200 quickly; queue/async heavy work (e.g., message enrichment, analytics).
- Rate limit publicly exposed endpoints except Twilio webhook paths.
- Use HTTPS and verify signatures in production.
- Monitor Twilio Console → Monitor → Logs for delivery status.

---

## 9) Prototype file references
- Backend webhook routes: `backend/routes/webhooks.js`
- External send (bot messages): `backend/routes/external.js`
- Authenticated send (adds `attributes.from`): `backend/routes/twilio.js`
- “From” attribute utilities: `backend/utils/messageUtils.js`

This setup ensures your app stays in sync with Twilio in real time, supports Baboo’s triad/main conversations, and enables clean sender labeling in the UI.
