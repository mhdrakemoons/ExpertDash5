const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Middleware to ensure user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Health check for webhook configuration
router.get('/webhook-status', authenticateToken, requireAdmin, (req, res) => {
  const status = {
    travelerWebhook: {
      configured: !!process.env.MAKE_TRAVELER_WEBHOOK_URL,
      url: process.env.MAKE_TRAVELER_WEBHOOK_URL ? 'Set' : 'Not set'
    },
    travelerDMWebhook: {
      configured: !!process.env.MAKE_TRAVELER_DM_WEBHOOK_URL,
      url: process.env.MAKE_TRAVELER_DM_WEBHOOK_URL ? 'Set' : 'Not set'
    },
    mainConversationWebhook: {
      configured: !!process.env.MAKE_MAIN_CONVERSATION_WEBHOOK_URL,
      url: process.env.MAKE_MAIN_CONVERSATION_WEBHOOK_URL ? 'Set' : 'Not set'
    },
    botSettingsWebhook: {
      configured: !!process.env.MAKE_BOT_SETTINGS_WEBHOOK_URL,
      url: process.env.MAKE_BOT_SETTINGS_WEBHOOK_URL ? 'Set' : 'Not set'
    },
    webhookSecret: {
      configured: !!process.env.MAKE_WEBHOOK_SECRET,
      status: process.env.MAKE_WEBHOOK_SECRET ? 'Set' : 'Not set'
    }
  };

  res.json({
    message: 'Webhook configuration status',
    status,
    allConfigured: status.travelerWebhook.configured && 
                   status.botSettingsWebhook.configured &&
                   status.travelerDMWebhook.configured &&
                   status.mainConversationWebhook.configured
  });
});

// Send message to traveler via Make.com webhook
router.post('/send-to-traveler', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { conversationSid, message, travelerName, adminName } = req.body;

    if (!conversationSid || !message) {
      return res.status(400).json({ 
        message: 'conversationSid and message are required' 
      });
    }

    if (!process.env.MAKE_TRAVELER_WEBHOOK_URL) {
      console.error('❌ MAKE_TRAVELER_WEBHOOK_URL not configured in environment');
      return res.status(503).json({ 
        message: 'Make.com traveler webhook not configured',
        details: 'Please set MAKE_TRAVELER_WEBHOOK_URL environment variable' 
      });
    }

    console.log('📤 Admin sending message to traveler via Make.com:', {
      conversationSid,
      message: message.substring(0, 50),
      travelerName,
      adminName
    });

    // Send to Make.com webhook for traveler communication
    const makeResponse = await fetch(process.env.MAKE_TRAVELER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.MAKE_WEBHOOK_SECRET ? `Bearer ${process.env.MAKE_WEBHOOK_SECRET}` : undefined,
      },
      body: JSON.stringify({
        conversationSid,
        message,
        travelerName,
        adminName,
        timestamp: new Date().toISOString(),
        source: 'admin_dashboard'
      })
    });

    if (!makeResponse.ok) {
      const errorText = await makeResponse.text();
      throw new Error(`Make.com webhook error: ${makeResponse.status} - ${errorText}`);
    }

    const makeResult = await makeResponse.json();

    console.log('✅ Message sent to traveler via Make.com successfully');

    res.json({
      message: 'Message sent to traveler successfully',
      data: {
        conversationSid,
        travelerName,
        messageLength: message.length,
        makeResult
      }
    });

  } catch (error) {
    console.error('❌ Error sending message to traveler:', error);
    res.status(500).json({ 
      message: 'Failed to send message to traveler',
      error: error.message 
    });
  }
});

// Update bot settings via Make.com webhook
router.post('/bot-settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, type, conversationSid } = req.body;

    if (!action || !type) {
      return res.status(400).json({ 
        message: 'action and type are required' 
      });
    }

    if (!['enable', 'disable'].includes(action)) {
      return res.status(400).json({ 
        message: 'action must be either "enable" or "disable"' 
      });
    }

    if (!['Expert Bot', 'Traveler Bot'].includes(type)) {
      return res.status(400).json({ 
        message: 'type must be either "Expert Bot" or "Traveler Bot"' 
      });
    }

    if (!process.env.MAKE_BOT_SETTINGS_WEBHOOK_URL) {
      console.error('❌ MAKE_BOT_SETTINGS_WEBHOOK_URL not configured in environment');
      return res.status(503).json({ 
        message: 'Make.com bot settings webhook not configured',
        details: 'Please set MAKE_BOT_SETTINGS_WEBHOOK_URL environment variable' 
      });
    }

    console.log('🤖 Admin updating bot settings via Make.com:', {
      action,
      type,
      conversationSid,
      admin: req.user.email
    });

    // Send to Make.com webhook for bot settings
    const makeResponse = await fetch(process.env.MAKE_BOT_SETTINGS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.MAKE_WEBHOOK_SECRET ? `Bearer ${process.env.MAKE_WEBHOOK_SECRET}` : undefined,
      },
      body: JSON.stringify({
        action,
        type,
        conversationSid,
        adminEmail: req.user.email,
        adminName: req.user.name,
        timestamp: new Date().toISOString()
      })
    });

    if (!makeResponse.ok) {
      const errorText = await makeResponse.text();
      throw new Error(`Make.com webhook error: ${makeResponse.status} - ${errorText}`);
    }

    const makeResult = await makeResponse.json();

    console.log(`✅ ${type} ${action}d via Make.com successfully`);

    res.json({
      message: `${type} ${action}d successfully`,
      data: {
        action,
        type,
        conversationSid,
        makeResult
      }
    });

  } catch (error) {
    console.error('❌ Error updating bot settings:', error);
    res.status(500).json({ 
      message: 'Failed to update bot settings',
      error: error.message 
    });
  }
});

// Get current bot settings for a conversation
router.get('/bot-settings/:conversationSid', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { conversationSid } = req.params;

    // For now, return default settings
    // In a real implementation, you might store these in your database
    // or query them from Make.com
    res.json({
      conversationSid,
      settings: {
        expertBot: true,  // Default enabled
        travelerBot: true // Default enabled
      }
    });

  } catch (error) {
    console.error('❌ Error fetching bot settings:', error);
    res.status(500).json({ 
      message: 'Failed to fetch bot settings',
      error: error.message 
    });
  }
});

// Send message to traveler via DM (different webhook)
router.post('/send-to-traveler-dm', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { conversationSid, message, travelerEmail, travelerPhone, travelerName, adminName } = req.body;

    if (!conversationSid || !message || !travelerEmail || !travelerName || !adminName) {
      return res.status(400).json({ 
        message: 'Missing required fields: conversationSid, message, travelerEmail, travelerName, adminName' 
      });
    }

    if (!process.env.MAKE_TRAVELER_DM_WEBHOOK_URL) {
      console.error('❌ MAKE_TRAVELER_DM_WEBHOOK_URL not configured in environment');
      return res.status(503).json({ 
        message: 'Make.com traveler DM webhook not configured',
        details: 'Please set MAKE_TRAVELER_DM_WEBHOOK_URL environment variable' 
      });
    }

    console.log(`📤 Sending DM to traveler ${travelerName} via Make.com...`);

    const webhookPayload = {
      conversationSid,
      message,
      travelerEmail,
      travelerPhone,
      travelerName,
      adminName,
      timestamp: new Date().toISOString(),
      type: 'admin_traveler_dm'
    };

    console.log('🔄 Webhook payload:', {
      ...webhookPayload,
      message: `"${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`
    });

    const response = await fetch(process.env.MAKE_TRAVELER_DM_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    const responseText = await response.text();
    console.log('📥 Make.com response:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 200)
    });

    if (!response.ok) {
      console.error('❌ Make.com webhook failed:', response.status, responseText);
      return res.status(500).json({ 
        message: 'Failed to send message via webhook',
        details: `Webhook returned ${response.status}: ${response.statusText}`
      });
    }

    console.log(`✅ DM message sent to traveler ${travelerName} successfully`);

    res.json({ 
      message: 'Message sent to traveler via DM webhook successfully',
      conversationSid,
      travelerName
    });

  } catch (error) {
    console.error('❌ Error sending traveler DM message:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      details: error.message 
    });
  }
});

module.exports = router; 