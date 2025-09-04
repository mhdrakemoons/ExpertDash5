# Message "From" Attribute System

This guide explains the new "from" attribute system that allows messages to be properly categorized and displayed with specific sender identities.

## Overview

The system uses Twilio's Conversations API `attributes` field to store a `from` attribute that specifies who sent the message. This enables proper differentiation between different types of senders.

## Predefined "From" Values

### 1. Bot Messages
- **Value**: `"Bot"`
- **Display**: "Bot" with green styling and bot icon
- **Usage**: System messages, automated responses, webhooks from external systems

### 2. Admin Messages  
- **Value**: `"Baboo Team"`
- **Display**: "Baboo Team" with blue styling and shield icon
- **Usage**: Messages from admin users

### 3. Local Expert Messages
- **Value**: `"[name] - Local Expert"`
- **Example**: `"Albert Testerson - Local Expert"`
- **Display**: Name with "Local Expert" suffix, purple styling and expert icon
- **Usage**: Messages from expert users

### 4. Traveler Messages
- **Value**: `"[name] - Traveler"`
- **Example**: `"Albert Testerson - Traveler"`
- **Display**: Name with "Traveler" suffix, orange styling and traveler icon
- **Usage**: Messages from travelers/customers

## Implementation

### Backend API Endpoints

All message sending endpoints now support an optional `from` parameter:

#### 1. External Message Endpoint
```javascript
POST /api/external/send-message
{
  "conversationSid": "CHxxxxxxxxx",
  "body": "Hello from the traveler!",
  "author": "customer_bot",
  "from": "John Doe - Traveler"  // Optional
}
```

#### 2. Twilio Message Endpoint (Authenticated)
```javascript
POST /api/twilio/message
{
  "conversationSid": "CHxxxxxxxxx", 
  "message": "Admin response",
  "from": "Baboo Team"  // Optional - auto-generated if not provided
}
```

#### 3. Inquiry Message Endpoint
```javascript
POST /api/inquiries/message
{
  "conversationSid": "CHxxxxxxxxx",
  "body": "System notification",
  "author": "system",
  "from": "Bot"  // Optional
}
```

### Auto-Generation Logic

When `from` is not explicitly provided, the system automatically generates it:

#### For Authenticated Users (via JWT)
- **Admin role** → `"Baboo Team"`
- **Expert role** → `"[user.name] - Local Expert"`
- **Bot role** → `"Bot"`

#### For External Messages
- **Bot/System authors** → `"Bot"`
- **Unknown authors** → `"Bot"` (default fallback)

### Message Attributes Structure

Messages are stored in Twilio with the following attributes:

```json
{
  "from": "Albert Testerson - Local Expert"
}
```

## Frontend Display

### Message Components

Both `MessageView.tsx` and `AdminMessageView.tsx` now use the new display system:

1. **Display Name**: Shows the `from` attribute value
2. **Styling**: Color-coded based on sender type
3. **Icons**: Appropriate icons for each sender type
4. **Labels**: Descriptive labels like "(automated)", "(admin)", etc.

### Styling Colors

- **Bot**: Green background, green text
- **Admin (Baboo Team)**: Blue background, blue text  
- **Expert**: Purple background, purple text
- **Traveler**: Orange background, orange text
- **Current User**: Blue background, white text

## Usage Examples

### 1. External System Sending Traveler Message

```bash
curl -X POST https://your-api.com/api/external/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "conversationSid": "CHxxxxxxxxx",
    "body": "Thank you for the recommendation!",
    "author": "traveler_bot",
    "from": "Sarah Johnson - Traveler"
  }'
```

### 2. Make.com Webhook Sending Bot Message

```bash
curl -X POST https://your-api.com/api/external/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "conversationSid": "CHxxxxxxxxx", 
    "body": "Flight prices have been updated.",
    "author": "system",
    "from": "Bot"
  }'
```

### 3. Admin Sending Message (Auto-Generated)

When an admin user sends a message through the dashboard, the `from` attribute is automatically set to `"Baboo Team"`.

### 4. Expert Sending Message (Auto-Generated)

When an expert user sends a message, the `from` attribute is automatically set to `"[Expert Name] - Local Expert"`.

## Migration Notes

### Existing Messages

- Messages without the `from` attribute will fall back to the existing author-based logic
- The system is backward compatible with existing conversations
- New messages will automatically include the `from` attribute

### External Integrations

To take advantage of the new system, external integrations should:

1. **Update webhook payloads** to include the `from` parameter
2. **Use predefined values** for consistent display
3. **Include traveler names** when available for personalized display

## Troubleshooting

### Common Issues

1. **Messages showing as "Unknown User"**
   - Ensure the `from` attribute is included in the message
   - Check that the value matches one of the predefined formats

2. **Incorrect styling/colors**
   - Verify the `from` value matches expected patterns
   - Check console logs for parsing errors

3. **Auto-generation not working**
   - Ensure user authentication is working properly
   - Check that user roles are set correctly in the database

### Debug Information

Enable console logging to see `from` attribute processing:

```javascript
console.log(`📝 Adding 'from' attribute to message: ${fromAttribute}`);
```

## Best Practices

1. **Consistent Naming**: Always use the exact format for predefined values
2. **Include Names**: When possible, include actual names for travelers and experts
3. **Fallback Handling**: Always provide fallback logic for missing attributes
4. **Testing**: Test message display with all sender types
5. **Documentation**: Keep external system documentation updated with new parameters

## Future Enhancements

Potential improvements to consider:

1. **Custom Roles**: Support for additional user roles beyond the current four
2. **Profile Pictures**: Integration with user profile images
3. **Status Indicators**: Online/offline status for users
4. **Message Threading**: Grouping messages by sender for better readability
5. **Internationalization**: Multi-language support for role labels
