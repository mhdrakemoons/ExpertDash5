const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
const conversationsServiceSid = process.env.TWILIO_CONVERSATIONS_SERVICE_SID;

const isConfigured = !!(accountSid && authToken);
const conversationsConfigured = !!(accountSid && authToken && conversationsServiceSid);

console.log('🔧 Twilio service configuration:', {
  isConfigured,
  conversationsConfigured,
  phoneNumber: phoneNumber ? 'SET' : 'NOT SET',
  serviceConfigured: !!conversationsServiceSid
});

const client = isConfigured ? twilio(accountSid, authToken) : null;

class TwilioService {
  constructor() {
    this.client = client;
    this.phoneNumber = phoneNumber;
    this.isConfigured = isConfigured;
    this.conversationsConfigured = conversationsConfigured;
  }

  // Send SMS
  async sendSMS(to, body) {
    if (!this.isConfigured) {
      throw new Error('Twilio is not configured');
    }

    if (!this.phoneNumber) {
      throw new Error('Twilio phone number is not configured');
    }

    try {
      const message = await this.client.messages.create({
        body,
        from: this.phoneNumber,
        to,
      });

      return {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateCreated: message.dateCreated,
      };
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  // Get messages
  async getMessages(limit = 50) {
    if (!this.isConfigured) {
      throw new Error('Twilio is not configured');
    }

    try {
      const messages = await this.client.messages.list({ limit });

      return messages.map(message => ({
        sid: message.sid,
        body: message.body,
        from: message.from,
        to: message.to,
        status: message.status,
        direction: message.direction,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        price: message.price,
        priceUnit: message.priceUnit,
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  // Get message details
  async getMessageDetails(messageSid) {
    if (!this.isConfigured) {
      throw new Error('Twilio is not configured');
    }

    try {
      const message = await this.client.messages(messageSid).fetch();

      return {
        sid: message.sid,
        body: message.body,
        from: message.from,
        to: message.to,
        status: message.status,
        direction: message.direction,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        price: message.price,
        priceUnit: message.priceUnit,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      console.error('Error fetching message details:', error);
      throw new Error(`Failed to fetch message details: ${error.message}`);
    }
  }

  // FAST: Fetch conversations with improved pagination
  async fetchConversationsPaginated(limit = 15, offset = 0) {
    if (!conversationsConfigured) {
      throw new Error('Twilio Conversations not configured');
    }

    try {
      console.log(`⚡ FAST MODE: Fetching ${limit + 1} conversations to check hasMore (offset: ${offset})...`);
      
      // Fetch one more than requested to determine if there are more pages
      const conversations = await this.client.conversations.v1.services(conversationsServiceSid)
        .conversations
        .list({ 
          limit: limit + 1,
          pageSize: limit + 1
        });

      // Sort by date updated (most recent first) and apply offset
      const sortedConversations = conversations
        .sort((a, b) => new Date(b.dateUpdated) - new Date(a.dateUpdated))
        .slice(offset, offset + limit + 1);

      // Determine if there are more conversations
      const hasMore = sortedConversations.length > limit;
      const returnConversations = hasMore ? sortedConversations.slice(0, limit) : sortedConversations;
      
      console.log(`⚡ FAST: Fetched ${returnConversations.length} conversations (hasMore: ${hasMore})`);
      
      // Transform to lightweight format - NO participant fetching here!
      const transformedConversations = returnConversations.map(conversation => ({
        sid: conversation.sid,
        friendlyName: conversation.friendlyName,
        uniqueName: conversation.uniqueName,
        attributes: conversation.attributes ? JSON.parse(conversation.attributes) : {},
        state: conversation.state,
        dateCreated: conversation.dateCreated,
        dateUpdated: conversation.dateUpdated,
        url: conversation.url,
        // These will be loaded on-demand when needed
        participants: [],
        participantCount: 0,
        conversationType: 'unknown' // Will be determined when participants are loaded
      }));
      
      return {
        conversations: transformedConversations,
        hasMore
      };

    } catch (error) {
      console.error('❌ Error fetching paginated conversations:', error);
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }
  }

  // Fetch all conversations (for webhook processing)
  async fetchAllConversations() {
    if (!conversationsConfigured) {
      throw new Error('Twilio Conversations not configured');
    }

    try {
      console.log('📋 Fetching all conversations for webhook processing...');
      
      const conversations = await this.client.conversations.v1.services(conversationsServiceSid)
        .conversations
        .list({ limit: 1000 }); // Large limit to get all conversations

      console.log(`📋 Fetched ${conversations.length} total conversations`);
      
      return conversations.map(conversation => ({
        sid: conversation.sid,
        friendlyName: conversation.friendlyName,
        uniqueName: conversation.uniqueName,
        attributes: conversation.attributes ? JSON.parse(conversation.attributes) : {},
        state: conversation.state,
        dateCreated: conversation.dateCreated,
        dateUpdated: conversation.dateUpdated
      }));

    } catch (error) {
      console.error('❌ Error fetching all conversations:', error);
      throw new Error(`Failed to fetch all conversations: ${error.message}`);
    }
  }

  // Fetch participants for a specific conversation
  async fetchConversationParticipants(conversationSid) {
    if (!conversationsConfigured) {
      throw new Error('Twilio Conversations not configured');
    }

    try {
      console.log(`👥 Fetching participants for conversation: ${conversationSid}`);
      
      const participants = await this.client.conversations.v1.services(conversationsServiceSid)
        .conversations(conversationSid)
        .participants
        .list();

      console.log(`👥 Fetched ${participants.length} participants for conversation ${conversationSid}`);
      
      return participants.map(participant => ({
        sid: participant.sid,
        identity: participant.identity,
        type: participant.messagingBinding ? 'sms' : 'chat',
        isCustomer: !participant.identity, // SMS participants don't have identity
        displayName: participant.identity || 'SMS Customer',
        roleSid: participant.roleSid,
        dateCreated: participant.dateCreated,
        dateUpdated: participant.dateUpdated
      }));

    } catch (error) {
      console.error(`❌ Error fetching participants for ${conversationSid}:`, error);
      throw new Error(`Failed to fetch participants: ${error.message}`);
    }
  }

  // Determine conversation type based on attributes and participants
  determineConversationType(conversation, participants = []) {
    const attributes = conversation.attributes || {};
    
    // Check explicit type in attributes first
    if (attributes.type === 'admin_traveler_dm' || attributes.typeOfChat === 'adminAndTraveler') {
      return 'admin_traveler_dm';
    }
    if (attributes.type === 'expert_admin_dm' || attributes.typeOfChat === 'expertAndAdmin') {
      return 'expert_admin_dm';
    }
    if (attributes.type === 'main_conversation' || attributes.typeOfChat === 'customerExpertAdmin') {
      return 'main_conversation';
    }
    
    // Fallback: analyze participants if provided
    if (participants && participants.length > 0) {
      const identities = participants.map(p => p.identity).filter(Boolean);
      const botIdentities = identities.filter(id => 
        id && (id.includes('bot') || id.includes('support_bot_'))
      );
      const nonBotIdentities = identities.filter(id => 
        id && !id.includes('bot') && !id.includes('support_bot_')
      );
      
      console.log(`🔍 Participant analysis for ${conversation.sid}:`, {
        totalParticipants: identities.length,
        botCount: botIdentities.length,
        nonBotCount: nonBotIdentities.length
      });
      
      // Admin + Bot only = admin_traveler_dm
      if (nonBotIdentities.length === 1 && botIdentities.length >= 1) {
        return 'admin_traveler_dm';
      }
      // Admin + Expert (no bot) = expert_admin_dm
      else if (nonBotIdentities.length === 2 && botIdentities.length === 0) {
        return 'expert_admin_dm';
      }
      // Admin + Expert + Bot or more = main_conversation
      else if (nonBotIdentities.length >= 2 && botIdentities.length >= 1) {
        return 'main_conversation';
      }
    }
    
    // Default fallback
    return 'main_conversation';
  }
}

module.exports = new TwilioService();