const express = require('express');
const db = require('../config/database');
const twilioRoleService = require('../services/twilioRoleService');
const twilioService = require('../services/twilioService');

const router = express.Router();

// Middleware to parse Twilio webhook data
router.use(express.urlencoded({ extended: true }));

// Webhook for when a message is added to a conversation
router.post('/message-added', async (req, res) => {
  try {
    console.log('📨 Message-added webhook received:', {
      ConversationSid: req.body.ConversationSid,
      Author: req.body.Author,
      Body: req.body.Body?.substring(0, 50)
    });

    const {
      ConversationSid,
      MessageSid,
      Author,
      Body,
      DateCreated,
      ParticipantSid,
      Source
    } = req.body;

    // Step 1: Update inquiry status if this is a tracked conversation
    const inquiryResult = await db.query(
      'SELECT * FROM inquiries WHERE conversation_sid = $1',
      [ConversationSid]
    );

    if (inquiryResult.rows.length > 0) {
      const inquiry = inquiryResult.rows[0];
      
      if (inquiry.status === 'assigned' || inquiry.status === 'new') {
        await db.query(
          'UPDATE inquiries SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['in_progress', inquiry.id]
        );
        console.log(`✅ Updated inquiry ${inquiry.id} status to 'in_progress'`);
      }
    }

    // Step 2: Determine conversation type and route to appropriate webhook
    await routeMessageToExternalWebhook(ConversationSid, {
      MessageSid,
      Author,
      Body,
      DateCreated,
      ParticipantSid,
      Source
    });

    // Always respond with 200 to acknowledge webhook
    res.status(200).json({ 
      message: 'Message webhook processed successfully',
      conversationSid: ConversationSid,
      messageSid: MessageSid
    });

  } catch (error) {
    console.error('❌ Error processing message webhook:', error);
    // Still return 200 to prevent Twilio retries
    res.status(200).json({ 
      message: 'Webhook received but processing failed',
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

                 // Determine conversation type using the same logic as the main endpoint
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
            
            // Apply same logic as below
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

// Webhook for when a conversation state changes
router.post('/conversation-state-updated', async (req, res) => {
  try {
    console.log('🔄 Conversation-state-updated webhook received:', {
      ConversationSid: req.body.ConversationSid,
      ConversationState: req.body.ConversationState,
      FriendlyName: req.body.FriendlyName
    });

    const {
      ConversationSid,
      ConversationState,
      FriendlyName,
      UniqueName
    } = req.body;

    // Find the inquiry associated with this conversation
    const inquiryResult = await db.query(
      'SELECT * FROM inquiries WHERE conversation_sid = $1',
      [ConversationSid]
    );

    if (inquiryResult.rows.length > 0) {
      const inquiry = inquiryResult.rows[0];
      
      // Update inquiry status based on conversation state
      let newStatus = inquiry.status;
      
      switch (ConversationState) {
        case 'active':
          if (inquiry.status === 'new') {
            newStatus = 'assigned';
          }
          break;
        case 'closed':
          newStatus = 'resolved';
          break;
        case 'inactive':
          // Keep current status
          break;
      }

      if (newStatus !== inquiry.status) {
        await db.query(
          'UPDATE inquiries SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newStatus, inquiry.id]
        );
        console.log(`✅ Updated inquiry ${inquiry.id} status from ${inquiry.status} to ${newStatus}`);
      }
    } else {
      console.log('ℹ️ No inquiry found for conversation:', ConversationSid);
    }

    res.status(200).json({ 
      message: 'Conversation state webhook processed successfully',
      conversationSid: ConversationSid,
      state: ConversationState
    });

  } catch (error) {
    console.error('❌ Error processing conversation state webhook:', error);
    res.status(200).json({ 
      message: 'Webhook received but processing failed',
      error: error.message 
    });
  }
});

// Webhook for when a participant is added
router.post('/participant-added', async (req, res) => {
  try {
    console.log('👥 Participant-added webhook received:', {
      ConversationSid: req.body.ConversationSid,
      ParticipantSid: req.body.ParticipantSid,
      Identity: req.body.Identity
    });

    const {
      ConversationSid,
      ParticipantSid,
      Identity,
      MessagingBinding
    } = req.body;

    // If this is a chat participant (has Identity), check if they need role updates
    if (Identity) {
      try {
        // Add delay to ensure participant is fully registered
        setTimeout(async () => {
          try {
            const conversationRole = await twilioRoleService.getConversationRoleForUser(Identity);
            await twilioRoleService.updateParticipantRole(ConversationSid, Identity, conversationRole);
            console.log(`✅ Updated role for participant ${Identity} in conversation ${ConversationSid}`);
          } catch (delayedRoleError) {
            console.error('❌ Failed to update participant role (delayed):', delayedRoleError);
          }
        }, 3000); // Wait 3 seconds for participant to be fully registered
      } catch (roleError) {
        console.error('❌ Failed to update participant role:', roleError);
      }
    }
    res.status(200).json({ 
      message: 'Participant added webhook processed successfully',
      conversationSid: ConversationSid,
      participantSid: ParticipantSid
    });

  } catch (error) {
    console.error('❌ Error processing participant added webhook:', error);
    res.status(200).json({ 
      message: 'Webhook received but processing failed',
      error: error.message 
    });
  }
});

// Enhanced webhook for conversation added (when new conversations are created externally)
router.post('/conversation-added', async (req, res) => {
  try {
    console.log('🆕 Conversation-added webhook received:', {
      ConversationSid: req.body.ConversationSid,
      FriendlyName: req.body.FriendlyName,
      UniqueName: req.body.UniqueName,
      Attributes: req.body.Attributes
    });

    const {
      ConversationSid,
      FriendlyName,
      UniqueName,
      ConversationState,
      Attributes
    } = req.body;

    // Parse attributes to determine conversation type
    let attributes = {};
    try {
      attributes = Attributes ? JSON.parse(Attributes) : {};
    } catch (parseError) {
      console.warn('⚠️ Failed to parse conversation attributes:', parseError);
    }

    console.log('📝 Parsed conversation attributes:', attributes);

    // Check if this is an admin-traveler conversation created externally
    if (attributes.type === 'admin_traveler_dm' || attributes.typeOfChat === 'adminAndTraveler') {
      console.log('🔍 Admin-traveler DM conversation detected - processing for database storage...');
      
      // Try to find an existing inquiry to link this conversation to
      if (attributes.travelerEmail || attributes.traveler_email) {
        const travelerEmail = attributes.travelerEmail || attributes.traveler_email;
        try {
          const db = require('../config/database');
          
          // Look for an inquiry with this traveler email that doesn't have a DM conversation yet
          const inquiryResult = await db.query(
            `SELECT id, customer_name, customer_email, customer_phone 
             FROM inquiries 
             WHERE customer_email = $1 AND dm_conversation_sid IS NULL 
             ORDER BY created_at DESC LIMIT 1`,
            [travelerEmail]
          );

          if (inquiryResult.rows.length > 0) {
            const inquiry = inquiryResult.rows[0];
            
            // Update the inquiry with the new DM conversation SID
            await db.query(
              'UPDATE inquiries SET dm_conversation_sid = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [ConversationSid, inquiry.id]
            );
            
            console.log(`✅ Linked external admin-traveler conversation ${ConversationSid} to inquiry ${inquiry.id} for ${travelerEmail}`);
          } else {
            console.log(`⚠️ No matching inquiry found for traveler email: ${travelerEmail}`);
          }
        } catch (dbError) {
          console.error('❌ Error linking conversation to inquiry:', dbError);
        }
      }
    }

    console.log(`✅ New conversation processed: ${ConversationSid}`);

    res.status(200).json({ 
      message: 'Conversation added webhook processed successfully',
      conversationSid: ConversationSid,
      conversationType: attributes.type || attributes.typeOfChat || 'unknown'
    });

  } catch (error) {
    console.error('❌ Error processing conversation added webhook:', error);
    res.status(200).json({ 
      message: 'Webhook received but processing failed',
      error: error.message 
    });
  }
});

// Generic webhook handler for all Twilio events (main webhook endpoint)
router.post('/twilio-event', async (req, res) => {
  try {
    console.log('🔔 Generic Twilio webhook received:', {
      EventType: req.body.EventType,
      ConversationSid: req.body.ConversationSid,
      MessageSid: req.body.MessageSid,
      Author: req.body.Author
    });

    const { EventType } = req.body;

    // Handle different event types and route to appropriate handlers
    switch (EventType) {
      case 'onMessageAdded':
        console.log('➡️ Routing to message-added handler');
        // Call the message-added logic directly
        await handleMessageAdded(req.body);
        break;
      case 'onConversationStateUpdated':
        console.log('➡️ Routing to conversation-state-updated handler');
        await handleConversationStateUpdated(req.body);
        break;
      case 'onParticipantAdded':
        console.log('➡️ Routing to participant-added handler');
        await handleParticipantAdded(req.body);
        break;
      case 'onConversationAdded':
        console.log('➡️ New conversation added via external source');
        break;
      case 'onParticipantRemoved':
        console.log('👋 Participant removed from conversation');
        break;
      default:
        console.log(`❓ Unhandled event type: ${EventType}`);
    }

    res.status(200).json({ 
      message: 'Twilio webhook processed successfully',
      eventType: EventType
    });

  } catch (error) {
    console.error('❌ Error processing Twilio webhook:', error);
    // Still return 200 to prevent Twilio retries
    res.status(200).json({ 
      message: 'Webhook received but processing failed',
      error: error.message 
    });
  }
});

// Handler functions for different webhook events
async function handleMessageAdded(body) {
  const {
    ConversationSid,
    MessageSid,
    Author,
    Body,
    DateCreated,
    ParticipantSid,
    Source
  } = body;

  console.log('📨 Processing message-added event:', {
    ConversationSid,
    Author,
    Body: Body?.substring(0, 50)
  });

  // Step 1: Update inquiry status if this is a tracked conversation
  try {
    const inquiryResult = await db.query(
      'SELECT * FROM inquiries WHERE conversation_sid = $1',
      [ConversationSid]
    );

    if (inquiryResult.rows.length > 0) {
      const inquiry = inquiryResult.rows[0];
      
      if (inquiry.status === 'assigned' || inquiry.status === 'new') {
        await db.query(
          'UPDATE inquiries SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['in_progress', inquiry.id]
        );
        console.log(`✅ Updated inquiry ${inquiry.id} status to 'in_progress'`);
      }
    }
  } catch (dbError) {
    console.error('❌ Error updating inquiry status:', dbError);
  }

  // Step 2: Route to external webhooks
  await routeMessageToExternalWebhook(ConversationSid, {
    MessageSid,
    Author,
    Body,
    DateCreated,
    ParticipantSid,
    Source
  });
}

async function handleConversationStateUpdated(body) {
  const {
    ConversationSid,
    ConversationState,
    FriendlyName,
    UniqueName
  } = body;

  console.log('🔄 Processing conversation-state-updated event:', {
    ConversationSid,
    ConversationState,
    FriendlyName
  });

  try {
    const inquiryResult = await db.query(
      'SELECT * FROM inquiries WHERE conversation_sid = $1',
      [ConversationSid]
    );

    if (inquiryResult.rows.length > 0) {
      const inquiry = inquiryResult.rows[0];
      
      let newStatus = inquiry.status;
      
      switch (ConversationState) {
        case 'active':
          if (inquiry.status === 'new') {
            newStatus = 'assigned';
          }
          break;
        case 'closed':
          newStatus = 'resolved';
          break;
        case 'inactive':
          break;
      }

      if (newStatus !== inquiry.status) {
        await db.query(
          'UPDATE inquiries SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newStatus, inquiry.id]
        );
        console.log(`✅ Updated inquiry ${inquiry.id} status from ${inquiry.status} to ${newStatus}`);
      }
    }
  } catch (error) {
    console.error('❌ Error processing conversation state update:', error);
  }
}

async function handleParticipantAdded(body) {
  const {
    ConversationSid,
    ParticipantSid,
    Identity,
    MessagingBinding
  } = body;

  console.log('👥 Processing participant-added event:', {
    ConversationSid,
    ParticipantSid,
    Identity
  });

  if (Identity) {
    try {
      setTimeout(async () => {
        try {
          const conversationRole = await twilioRoleService.getConversationRoleForUser(Identity);
          await twilioRoleService.updateParticipantRole(ConversationSid, Identity, conversationRole);
          console.log(`✅ Updated role for participant ${Identity} in conversation ${ConversationSid}`);
        } catch (delayedRoleError) {
          console.error('❌ Failed to update participant role (delayed):', delayedRoleError);
        }
      }, 3000);
    } catch (roleError) {
      console.error('❌ Failed to update participant role:', roleError);
    }
  }
}

// Test endpoint to simulate webhook and test routing logic
router.post('/test-routing', async (req, res) => {
  try {
    const { conversationSid } = req.body;
    
    if (!conversationSid) {
      return res.status(400).json({ message: 'conversationSid is required' });
    }
    
    console.log(`🧪 TEST: Simulating webhook for conversation ${conversationSid}`);
    
    // Simulate message data
    const testMessageData = {
      MessageSid: 'IM_TEST_MESSAGE',
      Author: 'test@example.com',
      Body: 'Test message for webhook routing',
      DateCreated: new Date().toISOString(),
      ParticipantSid: 'MB_TEST_PARTICIPANT',
      Source: 'TEST'
    };
    
    // Call the same routing function
    await routeMessageToExternalWebhook(conversationSid, testMessageData);
    
    res.json({
      message: 'Test webhook routing completed',
      conversationSid,
      testMessageData,
      note: 'Check backend logs for detailed routing information'
    });
    
  } catch (error) {
    console.error('❌ Test webhook routing error:', error);
    res.status(500).json({
      message: 'Test webhook routing failed',
      error: error.message
    });
  }
});

module.exports = router;