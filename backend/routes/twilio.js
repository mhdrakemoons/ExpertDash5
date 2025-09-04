const express = require('express');
const twilio = require('twilio');
const { authenticateToken } = require('../middleware/auth');
const twilioService = require('../services/twilioService');
const { generateFromAttribute } = require('../utils/messageUtils');

const router = express.Router();

// Generate Twilio Conversations access token
router.post('/token', authenticateToken, async (req, res) => {
  try {
    const { identity } = req.body;
    
    // Use the user's email as identity if not provided
    const tokenIdentity = identity || req.user.email;
    
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(503).json({ message: 'Twilio credentials not configured' });
    }

    // Check if Conversations Service SID is configured
    if (!process.env.TWILIO_CONVERSATIONS_SERVICE_SID) {
      return res.status(503).json({ 
        message: 'Twilio Conversations Service not configured. Please set TWILIO_CONVERSATIONS_SERVICE_SID in your environment variables.' 
      });
    }

    // Create access token - use different import pattern for better compatibility
    const AccessToken = twilio.jwt.AccessToken;
    
    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY || process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_SECRET || process.env.TWILIO_AUTH_TOKEN,
      { identity: tokenIdentity }
    );

    // Try ConversationsGrant first, fallback to ChatGrant for older versions
    let conversationsGrant;
    try {
      const ConversationsGrant = AccessToken.ConversationsGrant;
      conversationsGrant = new ConversationsGrant({
        serviceSid: process.env.TWILIO_CONVERSATIONS_SERVICE_SID
      });
    } catch (error) {
      // Fallback to ChatGrant for older Twilio SDK versions
      console.log('ConversationsGrant not available, trying ChatGrant...');
      const ChatGrant = AccessToken.ChatGrant;
      conversationsGrant = new ChatGrant({
        serviceSid: process.env.TWILIO_CONVERSATIONS_SERVICE_SID
      });
    }

    accessToken.addGrant(conversationsGrant);

    res.json({
      token: accessToken.toJwt(),
      identity: tokenIdentity
    });
  } catch (error) {
    console.error('Error generating Twilio token:', error);
    res.status(500).json({ 
      message: 'Failed to generate Twilio token',
      error: error.message 
    });
  }
});

// Helper function to route messages to external webhooks based on conversation type
async function routeMessageToExternalWebhook(conversationSid, messageData) {
  try {
    console.log(`🔍 Determining conversation type for ${conversationSid}...`);
    console.log(`📩 Message data:`, { 
      author: messageData.Author, 
      bodyPreview: messageData.Body?.substring(0, 50),
      source: messageData.Source 
    });
    
    let conversationType = 'unknown';
    let conversationDetails = {};

    try {
      // Fetch conversation details from Twilio
      console.log(`🔍 Fetching all conversations to find ${conversationSid}...`);
      const conversations = await twilioService.fetchAllConversations();
      console.log(`📋 Total conversations found: ${conversations.length}`);
      
      const conversation = conversations.find(c => c.sid === conversationSid);
      console.log(`🎯 Target conversation found:`, !!conversation);
      
      if (conversation) {
        console.log(`🔍 Fetching participants for ${conversationSid}...`);
        const participants = await twilioService.fetchConversationParticipants(conversationSid);
        console.log(`👥 Participants fetched: ${participants.length}`);
        
        const attributes = conversation.attributes || {};
        console.log(`📝 Raw attributes:`, conversation.attributes);
        console.log(`📝 Parsed attributes:`, attributes);
        
        console.log(`📊 Conversation ${conversationSid} analysis:`, {
          friendlyName: conversation.friendlyName,
          attributes,
          participantCount: participants.length,
          participants: participants.map(p => ({ identity: p.identity, type: p.type }))
        });

        // Determine conversation type using the same logic as the old code
        if (attributes.type === 'admin_traveler_dm' || attributes.typeOfChat === 'adminAndTraveler') {
          conversationType = 'admin_traveler_dm';
        } else if (attributes.type === 'expert_admin_dm' || attributes.typeOfChat === 'expertAndAdmin') {
          conversationType = 'expert_admin_dm'; // This should NOT send webhooks
        } else if (attributes.type === 'main_conversation' || attributes.typeOfChat === 'customerExpertAdmin') {
          conversationType = 'main_conversation';
        } else {
          // Analyze participants to determine type
          const identities = participants.map(p => p.identity).filter(Boolean);
          const botIdentities = identities.filter(id => 
            id.includes('bot') || id.includes('support_bot_')
          );
          const nonBotIdentities = identities.filter(id => 
            !id.includes('bot') && !id.includes('support_bot_')
          );
          
          console.log(`🔍 Participant analysis for ${conversationSid}:`, {
            totalParticipants: identities.length,
            botCount: botIdentities.length,
            nonBotCount: nonBotIdentities.length,
            bots: botIdentities,
            nonBots: nonBotIdentities
          });
          
          // Admin + Bot only = admin_traveler_dm (WEBHOOK)
          if (nonBotIdentities.length === 1 && botIdentities.length >= 1) {
            conversationType = 'admin_traveler_dm';
          }
          // Admin + Expert (no bot) = expert_admin_dm (NO WEBHOOK)
          else if (nonBotIdentities.length === 2 && botIdentities.length === 0) {
            conversationType = 'expert_admin_dm';
          }
          // Admin + Expert + Bot or more = main_conversation (WEBHOOK)
          else if (nonBotIdentities.length >= 2 && botIdentities.length >= 1) {
            conversationType = 'main_conversation';
          }
          // SMS participants or other complex scenarios = main_conversation
          else {
            conversationType = 'main_conversation';
          }
        }

        conversationDetails = {
          attributes,
          participants,
          friendlyName: conversation.friendlyName
        };
      } else {
        console.error(`❌ Conversation ${conversationSid} not found in Twilio conversations list`);
        // Try to fetch conversation directly
        try {
          console.log(`🔍 Attempting direct conversation fetch for ${conversationSid}...`);
          const participants = await twilioService.fetchConversationParticipants(conversationSid);
          console.log(`👥 Direct fetch participants: ${participants.length}`);
          
          if (participants.length > 0) {
            console.log(`📊 Using participant analysis for categorization`);
            conversationDetails = { participants };
            
            // Analyze participants to determine type
            const identities = participants.map(p => p.identity).filter(Boolean);
            const botIdentities = identities.filter(id => 
              id.includes('bot') || id.includes('support_bot_')
            );
            const nonBotIdentities = identities.filter(id => 
              !id.includes('bot') && !id.includes('support_bot_')
            );
            
            console.log(`🔍 Direct participant analysis:`, {
              totalParticipants: identities.length,
              botCount: botIdentities.length,
              nonBotCount: nonBotIdentities.length,
              bots: botIdentities,
              nonBots: nonBotIdentities
            });
            
            // Apply same logic as above
            if (nonBotIdentities.length === 1 && botIdentities.length >= 1) {
              conversationType = 'admin_traveler_dm';
            } else if (nonBotIdentities.length === 2 && botIdentities.length === 0) {
              conversationType = 'expert_admin_dm';
            } else if (nonBotIdentities.length >= 2 && botIdentities.length >= 1) {
              conversationType = 'main_conversation';
            } else {
              conversationType = 'main_conversation';
            }
          }
        } catch (directFetchError) {
          console.error(`❌ Direct conversation fetch also failed:`, directFetchError);
        }
      }
    } catch (twilioError) {
      console.error('❌ Failed to fetch conversation details from Twilio:', twilioError);
    }

    console.log(`📋 Conversation ${conversationSid} categorized as: ${conversationType}`);

    // Route to appropriate webhook based on conversation type
    if (conversationType === 'admin_traveler_dm') {
      console.log('📤 Routing to traveler DM webhook (Admin + Bot)');
      await sendToTravelerDMWebhook(conversationSid, messageData, conversationDetails);
    } else if (conversationType === 'main_conversation') {
      console.log('📤 Routing to main conversation webhook (Admin + Expert + Bot)');
      await sendToMainConversationWebhook(conversationSid, messageData, conversationDetails);
    } else if (conversationType === 'expert_admin_dm') {
      console.log('🚫 Expert-Admin DM detected - NO webhook sent (Admin + Expert only)');
    } else {
      console.log(`⚠️ Unknown conversation type ${conversationType} - no webhook sent`);
      console.log(`🔍 Debug info:`, {
        conversationType,
        conversationDetails: JSON.stringify(conversationDetails, null, 2)
      });
    }

  } catch (error) {
    console.error('❌ Failed to route message to external webhook:', error);
  }
}

// Send message to main conversation webhook (Admin + Expert + Bot)
async function sendToMainConversationWebhook(conversationSid, messageData, conversationDetails) {
  const webhookUrl = process.env.MAKE_MAIN_CONVERSATION_WEBHOOK_URL || 'https://hook.us2.make.com/5k58o56cbm75sew9bbxt9ui049g6xy8b';
  
  console.log(`🔍 Main conversation webhook check:`, {
    envVarExists: !!process.env.MAKE_MAIN_CONVERSATION_WEBHOOK_URL,
    envVarValue: process.env.MAKE_MAIN_CONVERSATION_WEBHOOK_URL ? 'SET' : 'NOT SET',
    actualUrl: webhookUrl,
    fallbackUsed: !process.env.MAKE_MAIN_CONVERSATION_WEBHOOK_URL
  });
  
  if (!webhookUrl) {
    console.error('❌ No webhook URL available - MESSAGE WEBHOOK WILL NOT BE SENT!');
    return;
  }

  try {
    const payload = {
      conversationSid,
      messageData,
      conversationDetails,
      type: 'main_conversation',
      timestamp: new Date().toISOString()
    };

    console.log('📤 Sending message to Make.com main webhook:', {
      url: webhookUrl,
      conversationSid,
      author: messageData.Author,
      bodyPreview: messageData.Body?.substring(0, 50),
      messageData: messageData
    });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.MAKE_WEBHOOK_SECRET ? `Bearer ${process.env.MAKE_WEBHOOK_SECRET}` : undefined,
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const responseText = await response.text();
      console.log('✅ Main conversation webhook sent successfully to Make.com:', {
        status: response.status,
        response: responseText.substring(0, 100)
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Main conversation webhook failed:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Error sending main conversation webhook:', error);
  }
}

// Send message to traveler DM webhook
async function sendToTravelerDMWebhook(conversationSid, messageData, conversationDetails) {
  console.log(`🔍 Traveler DM webhook check:`, {
    envVarExists: !!process.env.MAKE_TRAVELER_DM_WEBHOOK_URL,
    envVarValue: process.env.MAKE_TRAVELER_DM_WEBHOOK_URL ? 'SET' : 'NOT SET'
  });
  
  if (!process.env.MAKE_TRAVELER_DM_WEBHOOK_URL) {
    console.log('⚠️ MAKE_TRAVELER_DM_WEBHOOK_URL not configured - skipping traveler DM webhook');
    return;
  }

  try {
    const payload = {
      conversationSid,
      messageData,
      conversationDetails,
      type: 'admin_traveler_dm',
      timestamp: new Date().toISOString()
    };

    console.log('📤 Sending to traveler DM webhook:', {
      url: process.env.MAKE_TRAVELER_DM_WEBHOOK_URL,
      conversationSid,
      author: messageData.Author,
      bodyPreview: messageData.Body?.substring(0, 50)
    });

    const response = await fetch(process.env.MAKE_TRAVELER_DM_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.MAKE_WEBHOOK_SECRET ? `Bearer ${process.env.MAKE_WEBHOOK_SECRET}` : undefined,
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Traveler DM webhook sent successfully');
    } else {
      console.error('❌ Traveler DM webhook failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Error sending traveler DM webhook:', error);
  }
}

// Send message to conversation - INTEGRATED WITH WEBHOOK LOGIC FROM OLD CODE
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const { conversationSid, message, author, from } = req.body;

    if (!conversationSid || !message) {
      return res.status(400).json({ message: 'Conversation SID and message are required' });
    }

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(503).json({ message: 'Twilio not configured' });
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Prepare message data
    const messageData = {
      body: message,
      author: author || req.user.email
    };

    // Add 'from' attribute - either provided or auto-generated based on user role
    let fromAttribute = from;
    
    if (!fromAttribute) {
      fromAttribute = generateFromAttribute(req.user, 'user');
    }
    
    if (fromAttribute) {
      messageData.attributes = JSON.stringify({ from: fromAttribute });
      console.log(`📝 Adding 'from' attribute to message: ${fromAttribute} (user: ${req.user.name}, role: ${req.user.role})`);
    }

    // Send message to Twilio first
    const messageResult = await client.conversations.v1
      .conversations(conversationSid)
      .messages
      .create(messageData);

    console.log('✅ Message sent to Twilio successfully:', {
      messageSid: messageResult.sid,
      conversationSid: messageResult.conversationSid,
      author: messageResult.author
    });

    // IMMEDIATELY trigger webhook logic after sending message (copied from old webhook code)
    console.log('🚨 IMMEDIATELY TRIGGERING WEBHOOK LOGIC AFTER MESSAGE SENT...');
    
    try {
      // Create webhook message data in the format expected by the old routing function
      const webhookMessageData = {
        MessageSid: messageResult.sid,
        Author: messageResult.author,
        Body: messageResult.body,
        DateCreated: new Date().toISOString(),
        Source: 'dashboard'
      };

      // Call the same routing function from the old webhook code
      await routeMessageToExternalWebhook(conversationSid, webhookMessageData);
      
      console.log('✅ Webhook routing completed successfully');
    } catch (webhookError) {
      console.error('❌ Webhook routing failed:', webhookError);
      // Don't fail the message sending if webhook fails
    }

    res.json({
      message: 'Message sent successfully',
      data: {
        sid: messageResult.sid,
        conversationSid: messageResult.conversationSid,
        author: messageResult.author,
        body: messageResult.body,
        attributes: messageResult.attributes
      }
    });
  } catch (error) {
    console.error('Error sending message to conversation:', error);
    res.status(500).json({ 
      message: 'Failed to send message',
      error: error.message 
    });
  }
});

// Send SMS
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ message: 'To and message are required' });
    }

    if (!twilioService.isConfigured) {
      return res.status(503).json({ message: 'SMS service is not configured' });
    }

    const result = await twilioService.sendSMS(to, message);

    res.json({
      message: 'SMS sent successfully',
      data: result
    });
  } catch (error) {
    console.error('SMS sending error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get messages
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    if (!twilioService.isConfigured) {
      return res.status(503).json({ message: 'SMS service is not configured' });
    }

    const messages = await twilioService.getMessages(limit);

    res.json({
      message: 'Messages retrieved successfully',
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get message details
router.get('/messages/:messageSid', authenticateToken, async (req, res) => {
  try {
    const { messageSid } = req.params;

    if (!twilioService.isConfigured) {
      return res.status(503).json({ message: 'SMS service is not configured' });
    }

    const message = await twilioService.getMessageDetails(messageSid);

    res.json({
      message: 'Message details retrieved successfully',
      data: message
    });
  } catch (error) {
    console.error('Error fetching message details:', error);
    res.status(500).json({ message: error.message });
  }
});

// Health check for Twilio service
router.get('/status', authenticateToken, (req, res) => {
  res.json({
    configured: twilioService.isConfigured,
    phoneNumber: twilioService.isConfigured ? twilioService.phoneNumber : null,
    conversationsConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_CONVERSATIONS_SERVICE_SID)
  });
});

module.exports = router;