# SMS Dashboard Backend

A Node.js/Express backend API for the SMS Dashboard application with Twilio Conversations integration and webhook handling.

## Features

- User authentication (JWT-based)
- Twilio Conversations integration
- **Automatic Twilio Role Management** based on user database roles
- **Twilio Webhook Handlers** for real-time events
- Direct Twilio API calls for messaging
- External webhook support for Make.com
- Message history retrieval
- Inquiry management
- PostgreSQL database integration
- Security middleware (Helmet, Rate limiting, CORS)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. Set up your database and run migrations (if using Supabase, apply the SQL migrations)

4. **Configure Twilio Webhooks** (Important!)

5. Start the development server:
   ```bash
   npm run dev
   ```

## Twilio Integration Flow

### 1. **Direct API Calls to Twilio**

Send requests directly to Twilio's APIs:

#### Create Conversation:
```bash
# Default service
POST https://conversations.twilio.com/v1/ConversationWithParticipants

# With specific service
POST https://conversations.twilio.com/v1/Services/{ServiceSid}/ConversationWithParticipants
```

#### Send Message:
```bash
# Default service
POST https://conversations.twilio.com/v1/Conversations/{ConversationSid}/Messages

# With specific service  
POST https://conversations.twilio.com/v1/Services/{ServiceSid}/Conversations/{ConversationSid}/Messages
```

### 2. **Twilio Webhooks to Your App**

Configure these webhook URLs in your Twilio Console:

```
POST https://your-render-backend-url.onrender.com/api/webhooks/message-added
POST https://your-render-backend-url.onrender.com/api/webhooks/conversation-state-updated
POST https://your-render-backend-url.onrender.com/api/webhooks/participant-added
POST https://your-render-backend-url.onrender.com/api/webhooks/twilio-event
```

## Webhook Configuration

### In Twilio Console:

1. **Go to Conversations > Services > [Your Service] > Configuration**

2. **Set Webhook Configuration:**

   **Webhook URL:** `https://your-render-backend-url.onrender.com/api/webhooks/twilio-event`
   
   **OR configure specific event URLs:**
   
   - **Message Added:** `https://your-render-backend-url.onrender.com/api/webhooks/message-added`
   - **Conversation State Updated:** `https://your-render-backend-url.onrender.com/api/webhooks/conversation-state-updated`
   - **Participant Added:** `https://your-render-backend-url.onrender.com/api/webhooks/participant-added`

3. **Enable these webhook events:**
   - ✅ `onMessageAdded`
   - ✅ `onConversationStateUpdated`
   - ✅ `onParticipantAdded`
   - ✅ `onParticipantRemoved`

### Example Webhook Payloads:

**Message Added:**
```json
{
  "ConversationSid": "CHxxxxxxxxxxxxxxxxx",
  "MessageSid": "IMxxxxxxxxxxxxxxxxx", 
  "Author": "expert@company.com",
  "Body": "Hello, how can I help you?",
  "DateCreated": "2024-01-15T10:30:00Z",
  "Source": "SDK",
  "ParticipantSid": "MBxxxxxxxxxxxxxxxxx"
}
```

**Conversation State Updated:**
```json
{
  "ConversationSid": "CHxxxxxxxxxxxxxxxxx",
  "ConversationState": "active",
  "FriendlyName": "John Doe - Expert",
  "UniqueName": "inquiry_123456789"
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout user

### Twilio/SMS
- `POST /api/twilio/token` - Get Twilio Conversations access token
- `POST /api/twilio/message` - Send external messages to conversations
- `GET /api/twilio/status` - Check Twilio configuration status

### Inquiries/Conversations
- `GET /api/inquiries` - Get all inquiries (paginated)
- `GET /api/inquiries/:id` - Get specific inquiry
- `POST /api/inquiries` - Create new conversation with participants
- `POST /api/inquiries/message` - Send message to conversation
- `PATCH /api/inquiries/:id/status` - Update inquiry status
- `DELETE /api/inquiries/:id` - Delete inquiry
- `GET /api/inquiries/experts/list` - Get all experts

### **Twilio Webhooks** (Receive from Twilio)
- `POST /api/webhooks/message-added` - Handle new messages
- `POST /api/webhooks/conversation-state-updated` - Handle conversation state changes
- `POST /api/webhooks/participant-added` - Handle participant events
- `POST /api/webhooks/twilio-event` - Generic Twilio event handler

### External Integrations (Make.com)
- `POST /api/external/send-message` - Send message to conversation (external)
- `POST /api/external/create-conversation` - Create conversation (external)

### Health Check
- `GET /api/health` - Server health status

## Make.com Integration Examples

### 1. **Create Conversation via Direct Twilio API**

```bash
POST https://conversations.twilio.com/v1/ConversationWithParticipants
Authorization: Basic {base64(ACCOUNT_SID:AUTH_TOKEN)}
Content-Type: application/x-www-form-urlencoded

FriendlyName=John Doe - Expert Support
UniqueName=inquiry_1234567890
Participant={"identity": "expert@company.com"}
Participant={"messaging_binding": {"address": "+1234567890", "proxy_address": "+1987654321"}}
```

### 2. **Send Message via Direct Twilio API**

```bash
POST https://conversations.twilio.com/v1/Conversations/{ConversationSid}/Messages
Authorization: Basic {base64(ACCOUNT_SID:AUTH_TOKEN)}
Content-Type: application/x-www-form-urlencoded

Body=Hello! How can I help you today?
Author=bot
```

### 3. **Your App Receives Webhook**

When Twilio processes the above, it will send webhooks to your endpoints:

```bash
POST https://your-render-backend-url.onrender.com/api/webhooks/message-added
Content-Type: application/x-www-form-urlencoded

ConversationSid=CHxxxxxxxxxxxxxxxxx
MessageSid=IMxxxxxxxxxxxxxxxxx
Author=bot
Body=Hello! How can I help you today?
DateCreated=2024-01-15T10:30:00Z
```

## Environment Variables

Required environment variables:

```
# Database
DATABASE_URL=your_database_url

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_CONVERSATIONS_SERVICE_SID=your_conversation_service_sid
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://calm-heliotrope-f996ab.netlify.app

# Optional
WEBHOOK_SECRET=your_webhook_secret

# Twilio Role SIDs (automatically configured)
TWILIO_SERVICE_ADMIN_ROLE=RL62752934547f446ca1d2fc433aa0760a
TWILIO_SERVICE_USER_ROLE=RL1ebe0bc48b3c45bb96e538fe4bb22d25
TWILIO_CHANNEL_ADMIN_ROLE=RL3feaf2506fd544a4a464fc012fec2e7
TWILIO_CHANNEL_USER_ROLE=RL32339bbb55b045218f07bc8736df4773
```

## Important Notes

1. **Automatic Role Assignment**: Users are automatically assigned Twilio roles based on their database role:
   - `admin` users → `Service Admin` and `Channel Admin` roles
   - `expert` users → `Service User` and `Channel User` roles
   - `support_bot_17855040062` → `Service Admin` and `Channel Admin` roles
1. **Always send requests directly to Twilio APIs**, not to localhost endpoints
2. **Configure webhooks** in Twilio Console to point to your app
3. **Use HTTPS** for production webhook URLs
4. **Webhook responses** should always return 200 status to prevent retries
5. **Twilio automatically handles** conversation management and participant addition

## Security Features

- Automatic Twilio role assignment based on database user roles
- JWT token authentication
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes per IP)
- Helmet security headers
- CORS protection
- Webhook secret verification (optional)
- Input validation
- Error handling middleware

## Production Deployment

1. Set `NODE_ENV=production`
2. **Configure Twilio webhooks** to point to your production domain
3. Use HTTPS for all webhook URLs
4. Set up reverse proxy (nginx)
5. Configure SSL/TLS certificates
6. Set up database backups
7. Monitor webhook delivery in Twilio Console
8. Set up logging for webhook events