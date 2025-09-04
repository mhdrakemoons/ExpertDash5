const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const twilioService = require('../services/twilioService');
const db = require('../config/database');

const router = express.Router();

// Get main conversations with fast pagination
router.get('/main', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    console.log(`📋 Loading conversations page ${page} (limit: ${limit}, offset: ${offset}) for user: ${user.email}`);
    
    // Fetch conversations with improved pagination
    let conversationData;
    try {
      conversationData = await twilioService.fetchConversationsPaginated(limit, offset);
    } catch (twilioError) {
      console.error('❌ Twilio service error:', twilioError);
      return res.status(500).json({ 
        message: 'Failed to fetch conversations from Twilio', 
        details: twilioError.message,
        service: 'twilio'
      });
    }
    
    const twilioConversations = conversationData.conversations;
    const hasMore = conversationData.hasMore;
    
    let filteredConversations = [];
    
    // Helper function to categorize conversation type based on attributes
    const categorizeConversationType = (conversation) => {
      const attributes = conversation.attributes || {};
      
      if (attributes.type === 'admin_traveler_dm' || attributes.typeOfChat === 'adminAndTraveler') {
        return 'admin_traveler_dm';
      }
      if (attributes.type === 'expert_admin_dm' || attributes.typeOfChat === 'expertAndAdmin') {
        return 'expert_admin_dm';
      }
      if (attributes.type === 'main_conversation' || attributes.typeOfChat === 'customerExpertAdmin') {
        return 'main_conversation';
      }
      
      // Default to main conversation if type is unclear
      return 'main_conversation';
    };

    // FAST MODE: Apply basic categorization without expensive participant checks
    const conversationsWithBasicInfo = twilioConversations.map(conversation => ({
      ...conversation,
      conversationType: categorizeConversationType(conversation)
    }));

    const conversationStats = {
      main: 0,
      expertAdmin: 0,
      adminTraveler: 0,
      unknown: 0
    };

    // Clear and repopulate the existing filteredConversations array
    filteredConversations = [];
    
    for (const conversation of conversationsWithBasicInfo) {
      const conversationType = conversation.conversationType;
        
      console.log(`📊 Conversation ${conversation.sid} categorized as: ${conversationType}`);
      
      // FAST MODE: Basic filtering without expensive participant checks
      if (user.role === 'expert') {
        // For experts, include conversations that could be relevant
        // Participant checks will happen on-demand when conversation is selected
        if (conversationType === 'expert_admin_dm' || conversationType === 'main_conversation') {
          filteredConversations.push(conversation);
          console.log(`⚡ Expert conversation included (fast): ${conversation.sid} (${conversationType})`);
        }
      } else if (user.role === 'admin') {
        // Admins can see all conversation types initially
        // Detailed filtering happens on-demand
        filteredConversations.push(conversation);
        console.log(`⚡ Admin conversation included (fast): ${conversation.sid} (${conversationType})`);
      } else {
        // Other roles - include main conversations by default
        // Detailed checks happen on-demand
        if (conversationType === 'main_conversation') {
          filteredConversations.push(conversation);
          console.log(`⚡ User conversation included (fast): ${conversation.sid} (${conversationType})`);
        }
      }
      
      // Update stats
      if (conversationType === 'main_conversation') conversationStats.main++;
      else if (conversationType === 'expert_admin_dm') conversationStats.expertAdmin++;
      else if (conversationType === 'admin_traveler_dm') conversationStats.adminTraveler++;
      else conversationStats.unknown++;
    }

    console.log(`⚡ FAST: Returning ${filteredConversations.length} conversations for ${user.role} ${user.name} (page ${page}):`, conversationStats);
    
    res.json({
      conversations: filteredConversations,
      total: filteredConversations.length,
      categorization: conversationStats,
      pagination: {
        page,
        limit,
        hasMore: hasMore, // Pass through the hasMore from Twilio service
        isPartialLoad: true // Indicates participants need to be loaded on-demand
      }
    });

  } catch (error) {
    console.error('❌ Error in main conversations endpoint:', error);
    
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

// Get participants for a specific conversation (on-demand loading)
router.get('/:conversationSid/participants', authenticateToken, async (req, res) => {
  try {
    const { conversationSid } = req.params;
    const user = req.user;

    console.log(`👥 Loading participants for conversation: ${conversationSid} (requested by: ${user.email})`);

    if (!twilioService.conversationsConfigured) {
      return res.status(503).json({ 
        message: 'Twilio Conversations not configured',
        error: 'SERVICE_NOT_CONFIGURED'
      });
    }

    // Fetch participants from Twilio
    const participants = await twilioService.fetchConversationParticipants(conversationSid);
    
    // Get conversation details to determine type
    const conversation = await twilioService.client.conversations.v1.services(process.env.TWILIO_CONVERSATIONS_SERVICE_SID)
      .conversations(conversationSid)
      .fetch();

    const conversationType = twilioService.determineConversationType(conversation, participants);
    
    console.log(`👥 Loaded ${participants.length} participants for ${conversationSid} (type: ${conversationType})`);

    res.json({
      participants,
      participantCount: participants.length,
      conversationType,
      conversationSid
    });

  } catch (error) {
    console.error(`❌ Error loading participants for ${req.params.conversationSid}:`, error);
    res.status(500).json({ 
      message: 'Failed to load participants',
      error: error.message 
    });
  }
});

// Get messages for a specific conversation
router.get('/:conversationSid/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationSid } = req.params;
    const user = req.user;

    console.log(`📨 Loading messages for conversation: ${conversationSid} (requested by: ${user.email})`);

    if (!twilioService.conversationsConfigured) {
      return res.status(503).json({ 
        message: 'Twilio Conversations not configured',
        error: 'SERVICE_NOT_CONFIGURED'
      });
    }

    // Fetch messages from Twilio using backend credentials
    const messagesUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
      ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversationSid}/Messages`
      : `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`;

    console.log(`📡 Fetching messages from Twilio REST API: ${messagesUrl}`);

    const response = await fetch(messagesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Twilio REST API error:`, response.status, errorText);
      throw new Error(`Failed to fetch messages from Twilio: ${response.status} - ${errorText}`);
    }

    const twilioData = await response.json();
    const twilioMessages = twilioData.messages || [];
    
    // Transform Twilio messages to our format with safe date parsing
    const messages = twilioMessages.map(msg => {
      // Safe date parsing with fallbacks
      let dateCreated;
      try {
        if (msg.date_created) {
          dateCreated = new Date(msg.date_created);
          // Validate the date
          if (isNaN(dateCreated.getTime())) {
            console.warn(`⚠️ Invalid date_created for message ${msg.sid}: ${msg.date_created}`);
            dateCreated = new Date(); // Use current date as fallback
          }
        } else {
          console.warn(`⚠️ Missing date_created for message ${msg.sid}`);
          dateCreated = new Date(); // Use current date as fallback
        }
      } catch (dateError) {
        console.error(`❌ Date parsing error for message ${msg.sid}:`, dateError);
        dateCreated = new Date(); // Use current date as fallback
      }
      
      // Safe attributes parsing
      let attributes = {};
      let from = msg.author;
      try {
        if (msg.attributes) {
          attributes = JSON.parse(msg.attributes);
          from = attributes.from || msg.author;
        }
      } catch (attrError) {
        console.warn(`⚠️ Failed to parse attributes for message ${msg.sid}:`, attrError);
      }
      
      return {
        sid: msg.sid || `msg_${Date.now()}`,
        author: msg.author || 'Unknown',
        body: msg.body || '',
        dateCreated: dateCreated.toISOString(), // Convert to ISO string for safe transport
        type: msg.type || 'text',
        index: msg.index || 0,
        participantSid: msg.participant_sid || null,
        conversationSid: msg.conversation_sid || conversationSid,
        attributes,
        from,
      };
    }).sort((a, b) => a.index - b.index); // Sort by index
    
    console.log(`✅ Backend fetched ${messages.length} messages for ${conversationSid}`);

    res.json({
      messages,
      messageCount: messages.length,
      conversationSid
    });

  } catch (error) {
    console.error(`❌ Error loading messages for ${req.params.conversationSid}:`, error);
    res.status(500).json({ 
      message: 'Failed to load messages',
      error: error.message 
    });
  }
});

// Get expert-admin DM conversations
router.get('/expert-admin-dms', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    console.log(`🔗 Loading expert-admin DMs for user: ${user.email} (role: ${user.role})`);

    // Get DM conversations from database
    let query;
    let params;

    if (user.role === 'admin') {
      // Admins can see all expert-admin DMs
      query = `
        SELECT 
          dm.id,
          dm.conversation_sid as sid,
          dm.created_at,
          dm.updated_at,
          expert.name as expert_name,
          expert.email as expert_email,
          admin.name as admin_name,
          admin.email as admin_email
        FROM expert_admin_dms dm
        JOIN users expert ON dm.expert_id = expert.id
        JOIN users admin ON dm.admin_id = admin.id
        ORDER BY dm.updated_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [limit, (page - 1) * limit];
    } else if (user.role === 'expert') {
      // Experts can only see their own DMs with admins
      query = `
        SELECT 
          dm.id,
          dm.conversation_sid as sid,
          dm.created_at,
          dm.updated_at,
          expert.name as expert_name,
          expert.email as expert_email,
          admin.name as admin_name,
          admin.email as admin_email
        FROM expert_admin_dms dm
        JOIN users expert ON dm.expert_id = expert.id
        JOIN users admin ON dm.admin_id = admin.id
        WHERE dm.expert_id = $1
        ORDER BY dm.updated_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [user.id, limit, (page - 1) * limit];
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await db.query(query, params);
    
    // Transform to conversation format
    const conversations = result.rows.map(row => ({
      id: row.id,
      sid: row.sid,
      friendlyName: `${row.expert_name} ↔ ${row.admin_name}`,
      uniqueName: `expert_admin_${row.id}`,
      dateCreated: row.created_at,
      dateUpdated: row.updated_at,
      state: 'active',
      conversationType: 'expert_admin_dm',
      participants: [
        {
          identity: row.expert_email,
          displayName: row.expert_name,
          type: 'chat',
          isCustomer: false
        },
        {
          identity: row.admin_email,
          displayName: row.admin_name,
          type: 'chat',
          isCustomer: false
        }
      ],
      expert: {
        id: row.expert_id,
        name: row.expert_name,
        email: row.expert_email
      },
      admin: {
        id: row.admin_id,
        name: row.admin_name,
        email: row.admin_email
      }
    }));

    console.log(`✅ Loaded ${conversations.length} expert-admin DM conversations`);

    res.json({
      conversations,
      total: conversations.length,
      pagination: {
        page,
        limit,
        hasMore: conversations.length === limit
      }
    });

  } catch (error) {
    console.error('❌ Error loading expert-admin DMs:', error);
    res.status(500).json({ 
      message: 'Failed to load expert-admin DMs',
      error: error.message 
    });
  }
});

// Get admin-traveler DM conversations
router.get('/admin-traveler-dms', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    console.log(`📞 Loading admin-traveler DMs for user: ${user.email} (role: ${user.role})`);

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Get inquiries that have DM conversation SIDs
    const result = await db.query(`
      SELECT 
        i.id,
        i.dm_conversation_sid as sid,
        i.customer_name,
        i.customer_email,
        i.customer_phone,
        i.message,
        i.status,
        i.created_at,
        i.updated_at
      FROM inquiries i
      WHERE i.dm_conversation_sid IS NOT NULL
      ORDER BY i.updated_at DESC
    `);

    // Transform to conversation format
    const conversations = result.rows.map(row => ({
      id: row.id,
      sid: row.sid, // This is the dm_conversation_sid
      friendlyName: `DM: ${row.customer_name}`,
      uniqueName: `admin_traveler_${row.id}`,
      dateCreated: row.created_at,
      dateUpdated: row.updated_at,
      state: 'active',
      conversationType: 'admin_traveler_dm',
      source: 'database',
      participants: [
        {
          identity: 'support_bot_17855040062',
          displayName: 'Support Bot',
          type: 'chat',
          isCustomer: false
        },
        {
          identity: user.email,
          displayName: user.name,
          type: 'chat',
          isCustomer: false
        }
      ],
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      customer_phone: row.customer_phone,
      initial_message: row.message,
      inquiry_status: row.status
    }));

    console.log(`✅ Loaded ${conversations.length} admin-traveler DM conversations from database`);

    res.json({
      conversations,
      total: conversations.length,
      pagination: {
        page: 1,
        limit: conversations.length,
        hasMore: false
      }
    });

  } catch (error) {
    console.error('❌ Error loading admin-traveler DMs:', error);
    res.status(500).json({ 
      message: 'Failed to load admin-traveler DMs',
      error: error.message 
    });
  }
});

// Create expert-admin DM conversation
router.post('/create-expert-admin-dm', authenticateToken, async (req, res) => {
  try {
    const { expertId, adminId } = req.body;
    const user = req.user;

    if (!expertId || !adminId) {
      return res.status(400).json({ message: 'expertId and adminId are required' });
    }

    // Verify both users exist
    const usersResult = await db.query(
      'SELECT id, name, email, role FROM users WHERE id IN ($1, $2)',
      [expertId, adminId]
    );

    if (usersResult.rows.length !== 2) {
      return res.status(400).json({ message: 'One or both users not found' });
    }

    const expert = usersResult.rows.find(u => u.id === expertId);
    const admin = usersResult.rows.find(u => u.id === adminId);

    if (!expert || !admin) {
      return res.status(400).json({ message: 'Expert or admin not found' });
    }

    // Check if DM already exists
    const existingDM = await db.query(
      'SELECT conversation_sid FROM expert_admin_dms WHERE expert_id = $1 AND admin_id = $2',
      [expertId, adminId]
    );

    if (existingDM.rows.length > 0) {
      return res.json({
        message: 'DM already exists',
        conversationSid: existingDM.rows[0].conversation_sid
      });
    }

    // Create Twilio conversation for DM
    // Implementation here...

    res.json({
      message: 'Expert-admin DM created successfully',
      // conversationSid: newConversation.sid
    });

  } catch (error) {
    console.error('❌ Error creating expert-admin DM:', error);
    res.status(500).json({ 
      message: 'Failed to create expert-admin DM',
      error: error.message 
    });
  }
});

// Get list of admins (for expert use)
router.get('/admins', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email FROM users WHERE role = $1 ORDER BY name',
      ['admin']
    );

    res.json({
      admins: result.rows
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: 'Failed to fetch admins' });
  }
});

// Get list of experts (for admin use)
router.get('/experts', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email FROM users WHERE role = $1 ORDER BY name',
      ['expert']
    );

    res.json({
      experts: result.rows
    });
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ message: 'Failed to fetch experts' });
  }
});

module.exports = router;