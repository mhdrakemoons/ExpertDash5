const express = require('express');
const twilio = require('twilio');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const twilioRoleService = require('../services/twilioRoleService');

const router = express.Router();

// Phone number validation helper
const validatePhoneNumber = (phone) => {
  if (!phone) return true; // Optional field
  
  // Remove all non-digit characters except +
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  
  // Must start with + and have at least 10 digits
  const phoneRegex = /^\+[1-9]\d{8,14}$/;
  return phoneRegex.test(cleanPhone);
};

// Get all inquiries (for experts to see their assigned inquiries)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get inquiries assigned to the current expert
    const result = await db.query(
      `SELECT 
         i.id, 
         i.customer_name, 
         i.customer_email, 
         i.customer_phone,
         i.message, 
         i.conversation_sid,
         i.status, 
         i.created_at, 
         i.updated_at,
         u.name as expert_name,
         u.email as expert_email
       FROM inquiries i
       LEFT JOIN users u ON i.assigned_expert_id = u.id
       WHERE i.assigned_expert_id = $1 OR $2 = 'admin'
       ORDER BY i.created_at DESC 
       LIMIT $3 OFFSET $4`,
      [req.user.id, req.user.role || 'expert', limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM inquiries 
       WHERE assigned_expert_id = $1 OR $2 = 'admin'`,
      [req.user.id, req.user.role || 'expert']
    );
    
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    
    if (error.message.includes('Database unavailable')) {
      return res.status(503).json({ 
        message: 'Database connection failed - Supabase project may be paused. Please check your Supabase dashboard.',
        error: 'SERVICE_UNAVAILABLE'
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single inquiry
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
         i.id, 
         i.customer_name, 
         i.customer_email, 
         i.customer_phone,
         i.message, 
         i.conversation_sid,
         i.status, 
         i.created_at, 
         i.updated_at,
         u.name as expert_name,
         u.email as expert_email
       FROM inquiries i
       LEFT JOIN users u ON i.assigned_expert_id = u.id
       WHERE i.id = $1 AND (i.assigned_expert_id = $2 OR $3 = 'admin')`,
      [id, req.user.id, req.user.role || 'expert']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching inquiry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new conversation using direct Twilio REST API with JSON
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      customerName, 
      customerEmail, 
      customerPhone,
      message, 
      assignedExpertId
    } = req.body;

    if (!customerName || !customerEmail || !message) {
      return res.status(400).json({ 
        message: 'Customer name, email, and message are required' 
      });
    }

    if (!assignedExpertId) {
      return res.status(400).json({ 
        message: 'Assigned expert ID is required' 
      });
    }

    // Validate phone number format if provided
    if (customerPhone && !validatePhoneNumber(customerPhone)) {
      return res.status(400).json({ 
        message: 'Invalid phone number format. Please use international format (e.g., +1234567890)' 
      });
    }

    // Verify the assigned expert exists
    const expertResult = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [assignedExpertId]
    );

    if (expertResult.rows.length === 0) {
      return res.status(400).json({ message: 'Assigned expert not found' });
    }

    const expert = expertResult.rows[0];

    // Check if Twilio is configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(503).json({ 
        message: 'Twilio not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.' 
      });
    }

    console.log('🔄 Creating Twilio conversation via REST API with JSON...');

    // Create conversation using direct REST API call with JSON format
    const uniqueName = `inquiry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const friendlyName = `${customerName} - ${expert.name}`;

    // Prepare participants array
    const participants = [];

    // Ensure expert has proper Twilio user role before adding to conversation
    try {
      await twilioRoleService.createTwilioUserWithRole(expert.email);
      console.log(`✅ Ensured Twilio user role for expert: ${expert.email}`);
    } catch (twilioError) {
      console.error('❌ Failed to ensure expert Twilio role:', twilioError);
      // Continue anyway - conversation creation might still work
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
      Identity: expert.email
    });

    // Add bot as chat participant (always include bot in conversations)
    participants.push({
      Identity: 'support_bot_17855040062'
    });

    // Add customer as SMS participant if phone is provided and valid
    if (customerPhone && process.env.TWILIO_PHONE_NUMBER && validatePhoneNumber(customerPhone)) {
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

    console.log('📡 Using endpoint:', conversationUrl);
    console.log('👥 Participants:', participants);

    // Prepare the JSON payload
    const jsonPayload = {
      FriendlyName: friendlyName,
      UniqueName: uniqueName,
      Participants: participants,
      Attributes: JSON.stringify({
        type: 'main_conversation',
        typeOfChat: 'customerExpertAdmin',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        expert_id: assignedExpertId,
        expert_name: expert.name,
        expert_email: expert.email,
        inquiry_id: null, // Will be set after inquiry is created
        created_by: 'dashboard'
      })
    };

    // Add messaging service if configured
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      jsonPayload.MessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    }

    console.log('📤 JSON Request payload:', JSON.stringify(jsonPayload, null, 2));

    // Create the conversation via REST API with JSON
    const response = await fetch(conversationUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jsonPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Twilio API error:', response.status, errorText);
      
      // Parse error details if possible
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.code === 50407) {
          return res.status(400).json({ 
            message: 'Invalid phone number for SMS. Please check the phone number format and ensure it can receive SMS.',
            error: 'INVALID_PHONE_NUMBER',
            details: errorJson
          });
        }
      } catch (parseError) {
        // Error text is not JSON
      }
      
      throw new Error(`Twilio API error: ${response.status} - ${errorText}`);
    }

    const conversation = await response.json();
    console.log('✅ Created Twilio conversation:', conversation.sid);
    // Send initial message after a delay
    setTimeout(async () => {
      try {
        const messageUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
          ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversation.sid}/Messages`
          : `https://conversations.twilio.com/v1/Conversations/${conversation.sid}/Messages`;

        const messagePayload = {
          Body: `New inquiry from ${customerName} (${customerEmail}): ${message}`,
          Author: 'system'
        };

        const messageResponse = await fetch(messageUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messagePayload)
        });

        if (messageResponse.ok) {
          console.log('✅ Sent initial message to conversation');
        } else {
          console.error('❌ Failed to send initial message:', await messageResponse.text());
        }
      } catch (msgError) {
        console.error('❌ Failed to send initial message:', msgError);
      }
    }, 2000); // Wait 2 seconds for conversation to be ready

    // Create inquiry record in database
    const inquiryResult = await db.query(
      `INSERT INTO inquiries (customer_name, customer_email, customer_phone, message, conversation_sid, assigned_expert_id, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'assigned') 
       RETURNING id, customer_name, customer_email, customer_phone, message, conversation_sid, assigned_expert_id, status, created_at`,
      [customerName, customerEmail, customerPhone, message, conversation.sid, assignedExpertId]
    );

    const inquiry = inquiryResult.rows[0];

    res.status(201).json({
      message: 'Conversation created successfully with participants',
      data: {
        ...inquiry,
        expert_name: expert.name,
        expert_email: expert.email,
        twilio_conversation_sid: conversation.sid,
        twilio_conversation_state: conversation.state,
        endpoints: {
          conversation_url: process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
            ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversation.sid}`
            : `https://conversations.twilio.com/v1/Conversations/${conversation.sid}`,
          messages_url: process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
            ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversation.sid}/Messages`
            : `https://conversations.twilio.com/v1/Conversations/${conversation.sid}/Messages`
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating conversation:', error);
    
    if (error.message.includes('Database unavailable')) {
      return res.status(503).json({ 
        message: 'Database connection failed - Supabase project may be paused. Please check your Supabase dashboard.',
        error: 'SERVICE_UNAVAILABLE'
      });
    }

    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Send message to conversation (for external integrations like Make.com)
router.post('/message', async (req, res) => {
  try {
    const { conversationSid, body, author, from } = req.body;

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

    // Add 'from' attribute if provided
    if (from) {
      messagePayload.Attributes = JSON.stringify({ from });
      console.log(`📝 Adding 'from' attribute to message: ${from}`);
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
      message: 'Message sent successfully',
      data: {
        sid: messageData.sid,
        conversationSid: messageData.conversation_sid,
        author: messageData.author,
        body: messageData.body,
        dateCreated: messageData.date_created,
        attributes: messageData.attributes
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      message: 'Failed to send message',
      error: error.message 
    });
  }
});

// Update inquiry status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'assigned', 'in_progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
    }

    const result = await db.query(
      `UPDATE inquiries 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND (assigned_expert_id = $3 OR $4 = 'admin')
       RETURNING id, customer_name, customer_email, customer_phone, message, conversation_sid, status, created_at, updated_at`,
      [status, id, req.user.id, req.user.role || 'expert']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Inquiry not found or not accessible' });
    }

    res.json({
      message: 'Inquiry status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating inquiry status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete inquiry (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await db.query('DELETE FROM inquiries WHERE id = $1 RETURNING id, conversation_sid', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    res.json({ message: 'Inquiry deleted successfully' });
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all experts (for assigning inquiries)
router.get('/experts/list', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email FROM users WHERE role = $1 ORDER BY name',
      ['expert']
    );

    res.json({
      message: 'Experts retrieved successfully',
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;