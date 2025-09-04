# Twilio Conversations Expert Dashboard

A production-ready React dashboard for local experts to manage customer conversations through Twilio Conversations API with real-time messaging and Make.com integration.

## Features

- **Real Authentication**: Login/registration with backend validation
- **Live Twilio Integration**: Real-time conversations using Twilio Conversations API
- **Professional UI**: Modern, responsive dashboard design
- **Real-time Messaging**: Live message sending/receiving
- **Make.com Integration**: Webhook integration for automated workflows
- **Production Ready**: No mock data, all real API connections

## Setup Instructions

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure your backend API URL:

```bash
cp .env.example .env
```

Update the `VITE_API_BASE_URL` with your actual backend API URL.

### 2. Backend Requirements

Your backend must provide these endpoints:

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

#### Twilio Integration
- `POST /api/twilio/token` - Get Twilio Conversations access token
- `POST /api/twilio/message` - Send external messages to conversations

#### Inquiries
- `POST /api/inquiries` - Create new customer inquiries

### 3. Twilio Configuration

Configure your Twilio Conversations service with:

1. **Webhook URL**: Point to your Make.com webhook for `onMessageAdded` events
2. **Service Configuration**: Enable auto-creation of conversations
3. **Access Tokens**: Backend should generate tokens with appropriate grants

### 4. Make.com Webhook

Set up Make.com webhook to handle:
- New message notifications
- Conversation routing
- Expert assignment logic

### 5. Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

### Authentication Flow
1. Expert logs in via frontend
2. Backend validates credentials
3. Backend returns JWT + user data
4. Frontend requests Twilio token using JWT
5. Twilio client initializes with real token

### Message Flow
1. Expert sends message via dashboard
2. Message sent directly to Twilio Conversations
3. Twilio triggers webhook to Make.com
4. Make.com processes and routes message
5. Real-time updates via Twilio listeners

### New Inquiry Flow
1. Customer submits inquiry (external form)
2. Backend creates new inquiry record
3. Backend/Make.com creates Twilio conversation
4. Assigned expert gets real-time notification
5. Expert can immediately respond

## Production Deployment

1. Build the application: `npm run build`
2. Deploy `dist/` folder to your hosting provider
3. Configure environment variables on hosting platform
4. Ensure backend API is accessible from production domain
5. Test all integrations with production Twilio credentials

## Error Handling

The application implements strict error handling:
- All API failures result in user-visible errors
- No fallback to mock data or offline mode
- Real-time connection failures are reported immediately
- Authentication failures redirect to login

## Security Considerations

- All sensitive operations go through authenticated backend
- Twilio tokens have appropriate scope limitations
- No Twilio credentials stored in frontend
- JWT tokens used for backend authentication
- All API calls use HTTPS in production

## Support

This dashboard requires:
- Active Twilio Conversations service
- Configured backend API
- Make.com webhook setup
- Production-ready hosting environment

No mock data or offline functionality is provided - all features require live service connections.