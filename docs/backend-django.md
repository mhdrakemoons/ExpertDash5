# Django Backend Integration (Baboo Travel Messaging)

This guide explains how to use Django (and Django REST Framework) to power the Angular 10 dashboard with Twilio Conversations. It mirrors patterns from the prototype and accommodates unknown-but-likely integrations in the existing Baboo stack (e.g., Make.com, Google Sheets, internal CRMs).

---

## Why Django here
- Single source of truth for users, roles, inquiries, and conversation metadata
- Security boundary for Twilio (token minting, role mapping, webhook validation)
- Aggregation layer: efficient conversation listing, pagination, and search (instead of heavy client-side SDK listing)
- Integration hub: Make.com, Sheets, CRM, analytics, notifications

---

## Core responsibilities
1) Authenticate users (session/JWT) and return profile/role
2) Mint Twilio Conversations Access Tokens with correct grants
3) Provide conversation list/detail endpoints (paginated, role-scoped)
4) Create conversations via Twilio REST JSON and add participants
5) Send messages (apply `attributes.from`), route outbound to Make.com when needed
6) Receive Twilio webhooks (message added, state updated, participant added)
7) Persist inquiry/conversation index and acceptance state for experts

---

## Suggested Django app structure
- `apps/accounts/` – users, roles, auth, Twilio identity mapping
- `apps/messaging/` – conversations, messages, webhooks, token view
- `apps/inquiries/` – inquiry model, creation flow, acceptance
- `apps/integrations/` – Make.com, Google Sheets, CRM, notifications

Use DRF viewsets for REST APIs, Celery/RQ for async webhook processing, and django-environ for env config.

---

## Environment variables
```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_API_KEY=SK...             # recommended for token minting
TWILIO_API_SECRET=...
TWILIO_CONVERSATIONS_SERVICE_SID=IS...
TWILIO_MESSAGING_SERVICE_SID=MG...     # optional
TWILIO_PHONE_NUMBER=+1...
FRONTEND_URL=https://your-angular.app
```

---

## Data models (example)
```python
# apps/inquiries/models.py
from django.db import models
from django.conf import settings

class Inquiry(models.Model):
    customer_name = models.CharField(max_length=200)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=32, blank=True)
    message = models.TextField()
    conversation_sid = models.CharField(max_length=64, unique=True)
    assigned_expert = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=32, default='assigned')  # assigned|active|closed
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ConversationIndex(models.Model):
    conversation_sid = models.CharField(max_length=64, unique=True)
    friendly_name = models.CharField(max_length=255, blank=True)
    unique_name = models.CharField(max_length=255, blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    last_message_preview = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
```

---

## Authentication and Twilio token view
```python
# apps/messaging/views.py
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import ChatGrant

@method_decorator(login_required, name='dispatch')
class TwilioTokenView(APIView):
    def post(self, request):
        identity = request.user.email  # keep stable mapping
        token = AccessToken(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_API_KEY,
            settings.TWILIO_API_SECRET,
            identity=identity,
        )
        grant = ChatGrant(service_sid=settings.TWILIO_CONVERSATIONS_SERVICE_SID)
        token.add_grant(grant)
        return Response({ 'token': token.to_jwt().decode('utf-8') })
```

---

## Conversations API (list and detail)
```python
# apps/messaging/views.py (additional)
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
import requests, base64

TWILIO_BASE = 'https://conversations.twilio.com/v1'

def _auth_header():
    from django.conf import settings
    b64 = base64.b64encode(f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}".encode()).decode()
    return { 'Authorization': f'Basic {b64}', 'Content-Type': 'application/json' }

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversations_list(request):
    page = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 15))
    # Strategy: query Twilio or cached index, scope by user role
    # For production scale, maintain ConversationIndex and join data as needed
    resp = requests.get(f"{TWILIO_BASE}/Services/{settings.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations", headers=_auth_header())
    data = resp.json()
    # TODO: filter/slice to page/limit, enrich from DB, return concise payload
    return Response({ 'conversations': data.get('conversations', []), 'pagination': { 'page': page, 'limit': limit } })
```

Notes:
- In production, prefer using a DB-backed `ConversationIndex` updated by webhooks for fast paging, mirroring our prototype’s backend aggregation.

---

## Creating conversations and participants
```python
# apps/inquiries/views.py
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
import requests, base64, json
from .models import Inquiry

class InquiryCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        customer_name = request.data.get('customerName')
        customer_email = request.data.get('customerEmail')
        customer_phone = request.data.get('customerPhone')
        message = request.data.get('message')
        expert_id = request.data.get('assignedExpertId')

        # 1) Create conversation
        headers = _auth_header()
        conv = requests.post(
            f"{TWILIO_BASE}/Services/{settings.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations",
            headers=headers,
            data=json.dumps({ 'FriendlyName': f"{customer_name}", 'UniqueName': f"inquiry_{request.user.id}_{request.data.get('timestamp','')}" })
        ).json()

        conv_sid = conv['sid']

        # 2) Add expert by identity
        requests.post(
            f"{TWILIO_BASE}/Services/{settings.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/{conv_sid}/Participants",
            headers=headers,
            data=json.dumps({ 'Identity': request.user.email })
        )

        # 3) Add traveler by messaging binding (optional)
        if customer_phone:
            requests.post(
                f"{TWILIO_BASE}/Services/{settings.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/{conv_sid}/Participants",
                headers=headers,
                data=json.dumps({ 'MessagingBinding': { 'Address': customer_phone, 'ProxyAddress': settings.TWILIO_PHONE_NUMBER } })
            )

        # 4) Initial system message
        requests.post(
            f"{TWILIO_BASE}/Services/{settings.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/{conv_sid}/Messages",
            headers=headers,
            data=json.dumps({ 'Body': f"New inquiry from {customer_name} ({customer_email}): {message}", 'Author': 'system' })
        )

        # 5) Save inquiry
        inquiry = Inquiry.objects.create(
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone or '',
            message=message,
            conversation_sid=conv_sid,
            assigned_expert=request.user,
        )

        return Response({ 'id': inquiry.id, 'conversationSid': conv_sid })
```

---

## Sending messages (with `from` attribute)
```python
# apps/messaging/views.py (send message)
class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        conv_sid = request.data.get('conversationSid')
        body = request.data.get('message')
        author = request.user.email
        # Determine display identity
        from_label = 'Baboo Team' if request.user.is_staff else f"{request.user.get_full_name()} - Local Expert"
        payload = { 'Body': body, 'Author': author, 'Attributes': { 'from': from_label } }
        r = requests.post(
            f"{TWILIO_BASE}/Services/{settings.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/{conv_sid}/Messages",
            headers=_auth_header(),
            data=json.dumps(payload)
        )
        return Response(r.json())
```

---

## Webhooks (see docs/webhooks.md)
- Implement views for: `message-added`, `conversation-state-updated`, `participant-added`, and a generic `twilio-event`.
- Parse URL-encoded forms; validate signatures; ACK quickly; enqueue processing.
- Update `ConversationIndex` (last message, preview, timestamps) for fast lists.

---

## Integrations (Make.com, Sheets, CRM)
- Outbound: When admin/expert sends a message, Django can call a Make.com webhook to deliver to the traveler’s external channel (WhatsApp/SMS/Email). Keep message `Author`/`Attributes.from` consistent.
- Inbound: Make.com posts directly to Twilio Conversations (REST); Twilio fires `onMessageAdded`; Django processes the webhook and updates the index.
- Google Sheets: proxy read-only endpoints similar to the prototype if operations needs spreadsheets.
- CRM: Use webhooks to keep CRM timelines updated (e.g., on first message or state changes).

---

## Security and operations
- CORS allowlist for Angular domains; CSRF exempt only for Twilio webhooks
- Validate Twilio signatures; HTTPS-only
- Throttle public endpoints but skip Twilio webhooks and authenticated chat routes
- Use Celery/RQ for async processing; add structured logging

---

## Mapping from prototype
- Token minting parity: `src/services/twilio.ts` ↔ `TwilioTokenView`
- Conversation creation flow: `backend/routes/inquiries.js` ↔ `InquiryCreateView`
- Message send with `from`: `backend/routes/twilio.js` ↔ `SendMessageView`
- Webhooks: `backend/routes/webhooks.js` ↔ Django webhook views
- Aggregated listing: `backend/services/twilioService.js` ↔ `ConversationIndex` + list view

This gives you a secure, extensible Django core that mirrors the prototype and fits the current live Baboo dashboard architecture. Move business-specific logic (routing, assignment, notifications) into services so they can evolve without touching Twilio basics.
