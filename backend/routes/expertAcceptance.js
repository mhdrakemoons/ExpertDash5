const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Middleware to ensure user is expert
const requireExpert = (req, res, next) => {
  if (req.user.role !== 'expert') {
    return res.status(403).json({ message: 'Expert access required' });
  }
  next();
};

// GET /api/expert-acceptance/pending - Get pending conversations for expert to accept
router.get('/pending', authenticateToken, requireExpert, async (req, res) => {
  try {
    const { user } = req;
    
    console.log(`🔍 Loading pending conversations for expert: ${user.email} (ID: ${user.id})`);
    
    // Get all inquiries assigned to this expert
    const result = await db.query(`
      SELECT 
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
      JOIN users u ON i.assigned_expert_id = u.id
      WHERE i.assigned_expert_id = $1
      AND i.conversation_sid IS NOT NULL
      ORDER BY i.created_at DESC
    `, [user.id]);

    const inquiries = result.rows.map(row => {
      const createdAt = new Date(row.created_at);
      const aug18_2025_utc = new Date('2025-08-18T00:00:00.000Z');
      
      // Auto-accept inquiries created before August 18, 2025 UTC
      const shouldAutoAccept = createdAt < aug18_2025_utc && row.status === 'assigned';
      const finalStatus = shouldAutoAccept ? 'in_progress' : row.status;
      
      return {
        id: row.id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        customer_phone: row.customer_phone,
        message: row.message,
        conversation_sid: row.conversation_sid,
        status: finalStatus,
        created_at: row.created_at,
        updated_at: row.updated_at,
        expert: {
          name: row.expert_name,
          email: row.expert_email
        },
        // Consider conversations "accepted" if status is 'in_progress' or 'resolved', or if auto-accepted
        expert_accepted: finalStatus === 'in_progress' || finalStatus === 'resolved',
        expert_accepted_at: (finalStatus === 'in_progress' || finalStatus === 'resolved') ? row.updated_at : null,
        auto_accepted: shouldAutoAccept
      };
    });

    // Update database for auto-accepted inquiries
    const autoAcceptedInquiries = inquiries.filter(i => i.auto_accepted);
    if (autoAcceptedInquiries.length > 0) {
      try {
        const autoAcceptedIds = autoAcceptedInquiries.map(i => i.id);
        await db.query(`
          UPDATE inquiries 
          SET status = 'in_progress', updated_at = NOW() 
          WHERE id = ANY($1) AND status = 'assigned'
        `, [autoAcceptedIds]);
        console.log(`✅ Auto-accepted ${autoAcceptedInquiries.length} inquiries created before Aug 18, 2025`);
      } catch (updateError) {
        console.error('❌ Failed to update auto-accepted inquiries in database:', updateError);
      }
    }

    console.log(`✅ Found ${inquiries.length} conversations for expert ${user.email}`);
    console.log(`📊 Acceptance status:`, {
      accepted: inquiries.filter(i => i.expert_accepted).length,
      pending: inquiries.filter(i => !i.expert_accepted).length
    });

    res.json({
      conversations: inquiries,
      total: inquiries.length,
      pending: inquiries.filter(i => !i.expert_accepted).length,
      accepted: inquiries.filter(i => i.expert_accepted).length
    });

  } catch (error) {
    console.error('❌ Error fetching pending conversations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/expert-acceptance/accept - Accept a conversation
router.post('/accept', authenticateToken, requireExpert, async (req, res) => {
  try {
    const { conversationId } = req.body;
    const { user } = req;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    console.log(`🤝 Expert ${user.email} accepting conversation: ${conversationId}`);

    // Verify the conversation is assigned to this expert
    const inquiryResult = await db.query(`
      SELECT 
        i.*,
        u.name as expert_name,
        u.email as expert_email
      FROM inquiries i
      JOIN users u ON i.assigned_expert_id = u.id
      WHERE i.id = $1 AND i.assigned_expert_id = $2
    `, [conversationId, user.id]);

    if (inquiryResult.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found or not assigned to you' });
    }

    const inquiry = inquiryResult.rows[0];

    // Check if already accepted (status is in_progress or resolved)
    if (inquiry.status === 'in_progress' || inquiry.status === 'resolved') {
      return res.json({
        success: true,
        message: 'Conversation already accepted',
        data: {
          conversation_sid: inquiry.conversation_sid,
          status: inquiry.status
        }
      });
    }

    // Update status to indicate acceptance
    await db.query(`
      UPDATE inquiries 
      SET status = 'in_progress', updated_at = NOW()
      WHERE id = $1
    `, [conversationId]);

    console.log(`✅ Conversation ${conversationId} accepted by expert ${user.email}`);

    // Send webhook to Make.com to notify about acceptance
    try {
      const webhookUrl = 'https://hook.us2.make.com/5k58o56cbm75sew9bbxt9ui049g6xy8b';
      
      const webhookPayload = {
        event_type: 'expert_conversation_accepted',
        conversation_id: conversationId,
        conversation_sid: inquiry.conversation_sid,
        expert: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        customer: {
          name: inquiry.customer_name,
          email: inquiry.customer_email,
          phone: inquiry.customer_phone
        },
        inquiry: {
          id: inquiry.id,
          message: inquiry.message,
          status: 'in_progress'
        },
        acceptance_timestamp: new Date().toISOString(),
        acceptance_method: 'expert_dashboard',
        timestamp: new Date().toISOString()
      };

      console.log(`📡 Sending acceptance webhook to Make.com:`, {
        event_type: webhookPayload.event_type,
        conversation_sid: webhookPayload.conversation_sid,
        expert_email: webhookPayload.expert.email,
        customer_name: webhookPayload.customer.name
      });

      // Set a timeout for the webhook request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log(`📊 Webhook response status:`, webhookResponse.status);
      
      if (webhookResponse.ok) {
        // Don't await response.text() as Make.com might not return text
        console.log(`✅ Acceptance webhook sent successfully to Make.com (status: ${webhookResponse.status})`);
      } else {
        console.error(`❌ Acceptance webhook failed with status: ${webhookResponse.status}`);
      }

    } catch (webhookError) {
      console.error('❌ Failed to send acceptance webhook:', webhookError);
      // Don't fail the acceptance if webhook fails
    }

    res.json({
      success: true,
      message: 'Conversation accepted successfully',
      data: {
        conversation_sid: inquiry.conversation_sid,
        status: 'in_progress',
        accepted_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error accepting conversation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/expert-acceptance/conversation/:id - Get conversation details for acceptance preview
router.get('/conversation/:id', authenticateToken, requireExpert, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    console.log(`🔍 Loading conversation details for expert acceptance: ${id}`);

    // Get conversation details with expert verification
    const result = await db.query(`
      SELECT 
        i.*,
        u.name as expert_name,
        u.email as expert_email
      FROM inquiries i
      JOIN users u ON i.assigned_expert_id = u.id
      WHERE i.id = $1 AND i.assigned_expert_id = $2
    `, [id, user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found or not assigned to you' });
    }

    const inquiry = result.rows[0];
    
    const conversationDetails = {
      id: inquiry.id,
      customer_name: inquiry.customer_name,
      customer_email: inquiry.customer_email,
      customer_phone: inquiry.customer_phone,
      message: inquiry.message,
      conversation_sid: inquiry.conversation_sid,
      status: inquiry.status,
      created_at: inquiry.created_at,
      updated_at: inquiry.updated_at,
      expert: {
        name: inquiry.expert_name,
        email: inquiry.expert_email
      },
      expert_accepted: inquiry.status === 'in_progress' || inquiry.status === 'resolved',
      expert_accepted_at: inquiry.status === 'in_progress' || inquiry.status === 'resolved' ? inquiry.updated_at : null
    };

    console.log(`✅ Conversation details loaded for ${id}`);

    res.json({
      success: true,
      data: conversationDetails
    });

  } catch (error) {
    console.error('❌ Error fetching conversation details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/expert-acceptance/check/:conversationSid - Check if conversation is accepted by expert
router.get('/check/:conversationSid', authenticateToken, requireExpert, async (req, res) => {
  try {
    const { conversationSid } = req.params;
    const { user } = req;

    console.log(`🔍 Checking acceptance for conversation: ${conversationSid} by expert: ${user.email}`);

    // Check if conversation is accepted by this expert
    const result = await db.query(`
      SELECT 
        i.id,
        i.status,
        i.created_at,
        i.updated_at
      FROM inquiries i
      WHERE i.conversation_sid = $1 AND i.assigned_expert_id = $2
    `, [conversationSid, user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Conversation not found or not assigned to you',
        accepted: false 
      });
    }

    const inquiry = result.rows[0];
    const createdAt = new Date(inquiry.created_at);
    const aug18_2025_utc = new Date('2025-08-18T00:00:00.000Z');
    
    // Auto-accept inquiries created before August 18, 2025 UTC
    const shouldAutoAccept = createdAt < aug18_2025_utc && inquiry.status === 'assigned';
    const finalStatus = shouldAutoAccept ? 'in_progress' : inquiry.status;
    const isAccepted = finalStatus === 'in_progress' || finalStatus === 'resolved';

    // Update database if auto-accepting
    if (shouldAutoAccept) {
      try {
        await db.query(`
          UPDATE inquiries 
          SET status = 'in_progress', updated_at = NOW() 
          WHERE id = $1
        `, [inquiry.id]);
        console.log(`✅ Auto-accepted inquiry ${inquiry.id} created before Aug 18, 2025`);
      } catch (updateError) {
        console.error('❌ Failed to auto-accept inquiry:', updateError);
      }
    }

    res.json({
      accepted: isAccepted,
      status: finalStatus,
      auto_accepted: shouldAutoAccept,
      inquiry_id: inquiry.id
    });

  } catch (error) {
    console.error('❌ Error checking conversation acceptance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/expert-acceptance/accept-by-sid - Accept conversation by SID
router.post('/accept-by-sid', authenticateToken, requireExpert, async (req, res) => {
  try {
    const { conversationSid } = req.body;
    const { user } = req;

    if (!conversationSid) {
      return res.status(400).json({ message: 'conversationSid is required' });
    }

    console.log(`🤝 Expert ${user.email} accepting conversation by SID: ${conversationSid}`);

    // Find the inquiry by conversation SID
    const inquiryResult = await db.query(`
      SELECT 
        i.*,
        u.name as expert_name,
        u.email as expert_email
      FROM inquiries i
      JOIN users u ON i.assigned_expert_id = u.id
      WHERE i.conversation_sid = $1 AND i.assigned_expert_id = $2
    `, [conversationSid, user.id]);

    if (inquiryResult.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found or not assigned to you' });
    }

    const inquiry = inquiryResult.rows[0];

    // Check if already accepted
    if (inquiry.status === 'in_progress' || inquiry.status === 'resolved') {
      return res.json({
        success: true,
        message: 'Conversation already accepted',
        data: {
          conversation_sid: inquiry.conversation_sid,
          status: inquiry.status
        }
      });
    }

    // Update status to indicate acceptance
    await db.query(`
      UPDATE inquiries 
      SET status = 'in_progress', updated_at = NOW()
      WHERE id = $1
    `, [inquiry.id]);

    console.log(`✅ Conversation ${conversationSid} accepted by expert ${user.email}`);

    // Send webhook to Make.com
    try {
      const webhookUrl = 'https://hook.us2.make.com/5k58o56cbm75sew9bbxt9ui049g6xy8b';
      
      const webhookPayload = {
        event_type: 'expert_conversation_accepted',
        conversation_sid: conversationSid,
        expert: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        customer: {
          name: inquiry.customer_name,
          email: inquiry.customer_email,
          phone: inquiry.customer_phone
        },
        inquiry: {
          id: inquiry.id,
          message: inquiry.message,
          status: 'in_progress'
        },
        timestamp: new Date().toISOString()
      };

      console.log(`📡 Sending acceptance webhook to Make.com:`, webhookPayload);

      // Set a timeout for the webhook request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log(`📊 Webhook response status:`, webhookResponse.status);
      
      if (webhookResponse.ok) {
        console.log(`✅ Acceptance webhook sent successfully to Make.com (status: ${webhookResponse.status})`);
      } else {
        console.error(`❌ Acceptance webhook failed with status: ${webhookResponse.status}`);
      }

    } catch (webhookError) {
      console.error('❌ Failed to send acceptance webhook:', webhookError);
      // Don't fail the acceptance if webhook fails
    }

    res.json({
      success: true,
      message: 'Conversation accepted successfully',
      data: {
        conversation_sid: conversationSid,
        status: 'in_progress',
        accepted_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error accepting conversation by SID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/expert-acceptance/conversation-by-sid/:conversationSid - Get conversation details by SID
router.get('/conversation-by-sid/:conversationSid', authenticateToken, requireExpert, async (req, res) => {
  try {
    const { conversationSid } = req.params;
    const { user } = req;

    console.log(`🔍 Loading conversation details by SID: ${conversationSid} for expert: ${user.email}`);

    // Get conversation details by SID
    const result = await db.query(`
      SELECT 
        i.*,
        u.name as expert_name,
        u.email as expert_email
      FROM inquiries i
      JOIN users u ON i.assigned_expert_id = u.id
      WHERE i.conversation_sid = $1 AND i.assigned_expert_id = $2
    `, [conversationSid, user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found or not assigned to you' });
    }

    const inquiry = result.rows[0];
    
    const conversationDetails = {
      id: inquiry.id,
      customer_name: inquiry.customer_name,
      customer_email: inquiry.customer_email,
      customer_phone: inquiry.customer_phone,
      message: inquiry.message,
      conversation_sid: inquiry.conversation_sid,
      status: inquiry.status,
      created_at: inquiry.created_at,
      updated_at: inquiry.updated_at,
      expert: {
        name: inquiry.expert_name,
        email: inquiry.expert_email
      },
      expert_accepted: inquiry.status === 'in_progress' || inquiry.status === 'resolved',
      expert_accepted_at: inquiry.status === 'in_progress' || inquiry.status === 'resolved' ? inquiry.updated_at : null
    };

    console.log(`✅ Conversation details loaded by SID for ${conversationSid}`);

    res.json({
      success: true,
      data: conversationDetails
    });

  } catch (error) {
    console.error('❌ Error fetching conversation details by SID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;