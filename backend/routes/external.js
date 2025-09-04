const express = require('express');
const twilioRoleService = require('../services/twilioRoleService');
const { generateFromAttribute, determineMessageType } = require('../utils/messageUtils');

const router = express.Router();

// Webhook endpoint for Make.com or other external services to send messages
router.post('/send-message', async (req, res) => {
  try {
    const { conversationSid, body, author, webhook_secret, from } = req.body;

    // Optional: Verify webhook secret for security
    if (process.env.WEBHOOK_SECRET && webhook_secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!conversationSid || !body) {
      return res.status(400).json({ 
        message: 'conversationSid and body are required' 
      });
    }

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(503).json({ 
        message: 'Twilio not configured' 
      });
    }

    // Determine the correct endpoint URL
    const messageUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
      ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversationSid}/Messages`
      : `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`;

    // Prepare the JSON payload
    const messagePayload = {
      Body: body
    };

    if (author) {
      messagePayload.Author = author;
    }

    // Add 'from' attribute - either provided or auto-generated
    let fromAttribute = from;
    
    if (!fromAttribute) {
      // Auto-generate 'from' attribute based on author and message type
      const messageType = determineMessageType(author || 'system');
      
      if (messageType === 'bot' || messageType === 'system') {
        fromAttribute = 'Bot';
      } else if (messageType === 'external') {
        // Check if this looks like a traveler message
        if (body && (body.toLowerCase().includes('traveler') || body.toLowerCase().includes('customer'))) {
          fromAttribute = 'Bot'; // Default for now, can be enhanced with traveler name extraction
        } else {
          fromAttribute = 'Bot';
        }
      } else {
        fromAttribute = 'Bot'; // Default fallback
      }
    }
    
    if (fromAttribute) {
      messagePayload.Attributes = JSON.stringify({ from: fromAttribute });
      console.log(`📝 Adding 'from' attribute to message: ${fromAttribute}`);
    }

    // Send the message via direct API call with JSON
    const response = await fetch(messageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error: ${response.status} - ${errorText}`);
    }

    const messageData = await response.json();

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        sid: messageData.sid,
        conversationSid: messageData.conversation_sid,
        author: messageData.author,
        body: messageData.body,
        attributes: messageData.attributes
      }
    });

  } catch (error) {
    console.error('Error sending external message:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send message',
      error: error.message 
    });
  }
});

// Create conversation directly via external API (for Make.com integrations)
router.post('/create-conversation', async (req, res) => {
  try {
    const { 
      customerName, 
      customerEmail, 
      customerPhone,
      expertEmail,
      message,
      webhook_secret 
    } = req.body;

    // Optional: Verify webhook secret for security
    if (process.env.WEBHOOK_SECRET && webhook_secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!customerName || !customerEmail || !expertEmail || !message) {
      return res.status(400).json({ 
        message: 'customerName, customerEmail, expertEmail, and message are required' 
      });
    }

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(503).json({ 
        message: 'Twilio not configured' 
      });
    }

    // Prepare participants array
    const participants = [];

    // Ensure expert has proper Twilio user role before adding to conversation
    try {
      await twilioRoleService.createTwilioUserWithRole(expertEmail);
      console.log(`✅ Ensured Twilio user role for expert: ${expertEmail}`);
    } catch (twilioError) {
      console.error('❌ Failed to ensure expert Twilio role:', twilioError);
      // Continue anyway
    }

    // Ensure bot has proper roles
    try {
      await twilioRoleService.ensureBotRoles();
      console.log(`✅ Ensured bot roles in Twilio`);
    } catch (twilioError) {
      console.error('❌ Failed to ensure bot roles:', twilioError);
    }
    // Add expert as chat participant (identity-based)
    participants.push({
      Identity: expertEmail
    });

    // Add bot as chat participant (always include bot in conversations)
    participants.push({
      Identity: 'support_bot_17855040062'
    });

    // Add customer as SMS participant if phone is provided
    if (customerPhone && process.env.TWILIO_PHONE_NUMBER) {
      participants.push({
        MessagingBinding: {
          Address: customerPhone,
          ProxyAddress: process.env.TWILIO_PHONE_NUMBER
        }
      });
    }

    // Determine the correct endpoint URL
    const conversationUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
      ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/ConversationWithParticipants`
      : `https://conversations.twilio.com/v1/ConversationWithParticipants`;

    // Build form-encoded body
    const formPayload = new URLSearchParams();
    formPayload.append('FriendlyName', `${customerName} - ${expertEmail}`);
    formPayload.append(
      'UniqueName',
      `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
    formPayload.append('Attributes', JSON.stringify({
      type: 'main_conversation',
      typeOfChat: 'customerExpertAdmin',
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      expert_email: expertEmail,
      created_by: 'external_api'
    }));
    for (const participant of participants) {
      formPayload.append('Participant', JSON.stringify(participant));
    }
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      formPayload.append('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
    }

    // Create the conversation
    const response = await fetch(conversationUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formPayload
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error: ${response.status} - ${errorText}`);
    }

    const conversationData = await response.json();
    // Send initial message after a delay
    setTimeout(async () => {
      try {
        const messageUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
          ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversationData.sid}/Messages`
          : `https://conversations.twilio.com/v1/Conversations/${conversationData.sid}/Messages`;

        const messagePayload = {
          Body: `New inquiry from ${customerName} (${customerEmail}): ${message}`,
          Author: 'system',
          Attributes: JSON.stringify({ from: 'Bot' })
        };

        await fetch(messageUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messagePayload)
        });
      } catch (msgError) {
        console.error('Failed to send initial message:', msgError);
      }
    }, 2000);

    res.json({
      success: true,
      message: 'Conversation created successfully',
      data: {
        sid: conversationData.sid,
        friendlyName: conversationData.friendly_name,
        state: conversationData.state,
        endpoints: {
          conversation_url: process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
            ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversationData.sid}`
            : `https://conversations.twilio.com/v1/Conversations/${conversationData.sid}`,
          messages_url: process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
            ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversationData.sid}/Messages`
            : `https://conversations.twilio.com/v1/Conversations/${conversationData.sid}/Messages`
        }
      }
    });

  } catch (error) {
    console.error('Error creating external conversation:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create conversation',
      error: error.message 
    });
  }
});

module.exports = router;