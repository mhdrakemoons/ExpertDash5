# Twilio Integration Setup Guide

This guide explains how to configure Twilio to work with your application using **direct API calls** and **webhooks**.

## Overview

The flow works like this:
1. **External systems** (Make.com, other apps) send POST requests **directly to Twilio APIs**
2. **Twilio processes** the requests and manages conversations/messages
3. **Twilio sends webhooks** to your application when events occur
4. **Your app processes** the webhooks and updates the database

## Step 1: Configure Twilio Environment Variables

Add these to your `.env` file:

```bash
# Required
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_from_twilio_console

# For SMS support (optional)
TWILIO_PHONE_NUMBER=+1234567890

# For specific Conversation Service (optional but recommended)
TWILIO_CONVERSATIONS_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# For Messaging Service (optional)
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Step 2: Configure Twilio Webhooks

### In Twilio Console:

1. **Go to Conversations > Services > [Your Service] > Configuration**

2. **Set Webhook Configuration:**

   **Webhook URL:** `https://your-domain.com/api/webhooks/twilio-event`
   
   **OR configure specific event URLs:**
   
   - **Message Added:** `https://your-domain.com/api/webhooks/message-added`
   - **Conversation State Updated:** `https://your-domain.com/api/webhooks/conversation-state-updated`
   - **Participant Added:** `https://your-domain.com/api/webhooks/participant-added`

3. **Enable these webhook events:**
   - ✅ `onMessageAdded`
   - ✅ `onConversationStateUpdated`
   - ✅ `onParticipantAdded`
   - ✅ `onParticipantRemoved`

## Step 3: Create Conversations via Direct API

### From Make.com or external systems:

```bash
POST https://conversations.twilio.com/v1/ConversationWithParticipants
Authorization: Basic {base64(TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN)}
Content-Type: application/x-www-form-urlencoded

FriendlyName=Customer Support - John Doe
UniqueName=support_1234567890
Participant={"identity": "expert@company.com"}
Participant={"messaging_binding": {"address": "+1234567890", "proxy_address": "+1987654321"}}
```

### With specific Conversation Service:

```bash
POST https://conversations.twilio.com/v1/Services/ISxxxxxxxxx/ConversationWithParticipants
```

## Step 4: Send Messages via Direct API

```bash
POST https://conversations.twilio.com/v1/Conversations/{ConversationSid}/Messages
Authorization: Basic {base64(TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN)}
Content-Type: application/x-www-form-urlencoded

Body=Hello! How can I help you today?
Author=support_bot
```

## Step 5: Your App Receives Webhooks

When Twilio processes messages/conversations, it will automatically send webhooks to your configured URLs.

### Example Webhook Payloads:

**Message Added Webhook:**
```json
{
  "ConversationSid": "CHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "MessageSid": "IMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "Author": "expert@company.com",
  "Body": "Hello! How can I help you?",
  "DateCreated": "2024-01-15T10:30:00Z",
  "Source": "API",
  "ParticipantSid": "MBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Conversation State Updated Webhook:**
```json
{
  "ConversationSid": "CHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "ConversationState": "active",
  "FriendlyName": "Customer Support - John Doe",
  "UniqueName": "support_1234567890"
}
```

## Step 6: Testing

### Test Webhook Endpoints:

```bash
# Test message webhook
curl -X POST http://localhost:3001/api/webhooks/message-added \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "ConversationSid=CHtest123&MessageSid=IMtest123&Author=test&Body=Hello&DateCreated=2024-01-15T10:30:00Z"

# Test conversation state webhook  
curl -X POST http://localhost:3001/api/webhooks/conversation-state-updated \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "ConversationSid=CHtest123&ConversationState=active&FriendlyName=Test"
```

## Step 7: Make.com Integration

### Make.com Scenario Setup:

1. **HTTP Module:** Send POST to Twilio API
   ```
   URL: https://conversations.twilio.com/v1/ConversationWithParticipants
   Method: POST
   Headers:
     Authorization: Basic {base64(TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN)}
     Content-Type: application/x-www-form-urlencoded
   Body:
     FriendlyName={{customer.name}} - {{expert.name}}
     Participant={"identity": "{{expert.email}}"}
     Participant={"messaging_binding": {"address": "{{customer.phone}}", "proxy_address": "{{twilio.phone}}"}}
   ```

2. **Webhook Trigger:** Listen for webhooks from your app
   ```
   URL: https://your-domain.com/api/webhooks/twilio-event
   ```

3. **Your app automatically processes** the webhook and updates the database

## Security Notes

1. **Use HTTPS** for all webhook URLs in production
2. **Verify webhook authenticity** using Twilio's signature validation (optional)
3. **Store Twilio credentials securely** in environment variables
4. **Rate limit** webhook endpoints to prevent abuse
5. **Always return 200** from webhook handlers to prevent retries

## Troubleshooting

### Common Issues:

1. **Webhooks not received:**
   - Check webhook URL is publicly accessible
   - Verify webhook configuration in Twilio Console
   - Check server logs for errors

2. **Authentication errors:**
   - Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
   - Ensure credentials are base64 encoded for Basic Auth

3. **Conversation creation fails:**
   - Check participant format (must be valid JSON strings)
   - Verify phone numbers include country codes
   - Ensure TWILIO_PHONE_NUMBER is configured for SMS

### Debug Webhook Delivery:

- Check **Twilio Console > Monitor > Logs** for webhook delivery status
- Use **ngrok** for local development: `ngrok http 3001`
- Test webhooks with **Postman** or **curl**

## Production Checklist

- [ ] Environment variables configured
- [ ] Webhook URLs use HTTPS
- [ ] Database migrations applied
- [ ] Webhook endpoints tested
- [ ] Error logging configured
- [ ] Twilio Console webhook settings verified
- [ ] Make.com scenarios configured
- [ ] End-to-end flow tested