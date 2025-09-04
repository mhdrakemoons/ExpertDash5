# Data Model and `from` Attribute Strategy

This document formalizes the storage model and the message identity convention used across Django, Twilio Conversations, and Angular.

---

## 1) Why `from` exists
Twilio messages have `Author` (technical identity) and `Attributes` (custom JSON). We use `attributes.from` to present a clear human-readable sender label in the UI, independent of the transport or author string.

Advantages:
- Stable UX labels across channels and systems
- Role-based styling (admin/expert/traveler/bot)
- Backward compatible (falls back to `Author` if missing)

---

## 2) Standard values for `attributes.from`
- Bot: `"Bot"`
- Admin: `"Baboo Team"`
- Expert: `"{Expert Name} - Local Expert"`
- Traveler: `"{Traveler Name} - Traveler"`

Rules:
- If frontend doesn’t pass a `from`, Django generates one from the user role.
- External messages (via Make.com) should set `from` (default to `"Bot"` if not known).

---

## 3) Backend generation and parsing
- Generation in Django when sending messages:
  - Admin user → `"Baboo Team"`
  - Expert user → `"{full_name} - Local Expert"`
  - System/bot → `"Bot"`
- Parsing in webhook handlers:
  - If `Attributes` present, parse and store `from` alongside message metadata
  - If missing, derive a display value from `Author` and known role mapping

Prototype references: `backend/utils/messageUtils.js`, `backend/routes/twilio.js`, `backend/routes/external.js`.

---

## 4) Frontend usage (Angular)
- Use `message.attributes.from` when available
- Map to colors/icons: bot (green), admin (blue), expert (purple), traveler (orange), current user (highlight)
- Helper is provided in `docs/frontend-angular.md` (`getDisplayFrom`)

---

## 5) Recommended database schema (Django models)
This schema captures inquiries, conversation index (for fast lists), and minimal message metadata to power the dashboard. It deliberately avoids duplicating full Twilio message history unless needed.

```python
# apps/inquiries/models.py (already shown in backend guide)
class Inquiry(models.Model):
    customer_name = models.CharField(max_length=200)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=32, blank=True)
    message = models.TextField()
    conversation_sid = models.CharField(max_length=64, unique=True)
    assigned_expert = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=32, default='assigned')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

# apps/messaging/models.py
class ConversationIndex(models.Model):
    conversation_sid = models.CharField(max_length=64, unique=True)
    friendly_name = models.CharField(max_length=255, blank=True)
    unique_name = models.CharField(max_length=255, blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    last_message_preview = models.TextField(blank=True)
    last_message_from = models.CharField(max_length=255, blank=True)  # attributes.from snapshot
    updated_at = models.DateTimeField(auto_now=True)

class MessageAudit(models.Model):
    conversation_sid = models.CharField(max_length=64)
    message_sid = models.CharField(max_length=64, unique=True)
    author = models.CharField(max_length=255, blank=True)
    from_label = models.CharField(max_length=255, blank=True)  # parsed attributes.from
    body_preview = models.TextField(blank=True)
    created_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=["conversation_sid", "created_at"]),
        ]
```

Notes:
- `ConversationIndex` is updated by webhooks (message added/state updated). It powers paginated lists quickly.
- `MessageAudit` optional: useful for analytics, moderation, or quick previews without fetching Twilio every time.

---

## 6) Webhook-driven updates
- onMessageAdded:
  - Parse `Attributes` (JSON) and extract `from`
  - Update `ConversationIndex.last_message_at`, `last_message_preview`, `last_message_from`
  - Optionally insert a row in `MessageAudit` (with `created_at` from payload)
- onConversationStateUpdated:
  - Track archive/close for filtering
- onParticipantAdded:
  - Link phone/email to inquiry if missing

These mirror the prototype’s webhook practices.

---

## 7) API responses for Angular
Make list/detail endpoints return only what the UI needs. Suggested shape:

```json
{
  "conversations": [
    {
      "sid": "CH...",
      "friendlyName": "Alice Traveler - Bob Expert",
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "lastMessagePreview": "Hello, do you have availability?",
      "lastMessageFrom": "Alice Traveler - Traveler"
    }
  ],
  "pagination": { "page": 1, "limit": 15, "hasMore": true }
}
```

Angular maps `lastMessageFrom` to colors/icons via the helper.

---

## 8) Migration and compatibility
- If older messages lack `attributes.from`, fallback logic derives a label from `Author` and roles
- As new messages are sent, always set `Attributes: { "from": "..." }`
- External systems (Make.com) should include a best-effort traveler name in `from` when available

---

## 9) Validation and monitoring
- Validate that every outbound message from Django includes `from`
- Add assertions in tests for `from` values by role
- Dashboard metrics: count of messages by `from` type to catch regressions

---

## 10) Mapping to prototype code
- Backend `from` generation: `backend/utils/messageUtils.js`
- Backend send (auth): `backend/routes/twilio.js`
- Backend send (external): `backend/routes/external.js`
- Frontend display: `src/utils/messageDisplay.ts`
- Docs: `FROM_ATTRIBUTE_GUIDE.md`

This strategy guarantees a consistent, human-readable identity across channels and systems and keeps listing fast via a small, durable index in Django.
