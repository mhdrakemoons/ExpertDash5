const db = require('../config/database');

// Twilio Role SIDs from your configuration
const TWILIO_ROLES = {
  SERVICE_ADMIN: 'RL62752934547f446ca1d2fc433aa0760a',
  SERVICE_USER: 'RL1ebe0bc48b3c45bb96e538fe4bb22d25',
  CHANNEL_ADMIN: 'RL3feaf2506fd544a4a464fc012fec2e7',
  CHANNEL_USER: 'RL32339bbb55b045218f07bc8736df4773'
};

// Bot identity that should get admin roles
const BOT_IDENTITY = 'support_bot_17855040062';

class TwilioRoleService {
  constructor() {
    this.roles = TWILIO_ROLES;
    this.botIdentity = BOT_IDENTITY;
  }

  /**
   * Determine what Twilio service role a user should have based on their database role
   */
  async getServiceRoleForUser(userIdentity) {
    try {
      // Check if it's the bot
      if (userIdentity === this.botIdentity || userIdentity.includes('support_bot_')) {
        console.log(`🤖 Bot identity detected: ${userIdentity} -> Service Admin`);
        return this.roles.SERVICE_ADMIN;
      }

      // Query database to get user role
      const userResult = await db.query(
        'SELECT role FROM users WHERE email = $1',
        [userIdentity]
      );

      if (userResult.rows.length > 0) {
        const userRole = userResult.rows[0].role;
        
        if (userRole === 'admin') {
          console.log(`👑 Admin user detected: ${userIdentity} -> Service Admin`);
          return this.roles.SERVICE_ADMIN;
        } else {
          console.log(`👤 Regular user detected: ${userIdentity} -> Service User`);
          return this.roles.SERVICE_USER;
        }
      } else {
        console.log(`❓ User not found in database: ${userIdentity} -> Service User (default)`);
        return this.roles.SERVICE_USER;
      }
    } catch (error) {
      console.error('❌ Error determining service role:', error);
      return this.roles.SERVICE_USER; // Default to service user on error
    }
  }

  /**
   * Determine what Twilio conversation role a user should have
   */
  async getConversationRoleForUser(userIdentity) {
    try {
      // Check if it's the bot
      if (userIdentity === this.botIdentity || userIdentity.includes('support_bot_')) {
        console.log(`🤖 Bot identity detected: ${userIdentity} -> Channel Admin`);
        return this.roles.CHANNEL_ADMIN;
      }

      // Query database to get user role
      const userResult = await db.query(
        'SELECT role FROM users WHERE email = $1',
        [userIdentity]
      );

      if (userResult.rows.length > 0) {
        const userRole = userResult.rows[0].role;
        
        if (userRole === 'admin') {
          console.log(`👑 Admin user detected: ${userIdentity} -> Channel Admin`);
          return this.roles.CHANNEL_ADMIN;
        } else {
          console.log(`👤 Regular user detected: ${userIdentity} -> Channel User`);
          return this.roles.CHANNEL_USER;
        }
      } else {
        console.log(`❓ User not found in database: ${userIdentity} -> Channel User (default)`);
        return this.roles.CHANNEL_USER;
      }
    } catch (error) {
      console.error('❌ Error determining conversation role:', error);
      return this.roles.CHANNEL_USER; // Default to channel user on error
    }
  }

  /**
   * Create a Twilio user with appropriate service role
   */
  async createTwilioUserWithRole(userIdentity) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    try {
      const serviceRole = await this.getServiceRoleForUser(userIdentity);
      
      // Create user in Twilio Conversations Service
      const userUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
        ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Users`
        : `https://conversations.twilio.com/v1/Users`;

      const userPayload = new URLSearchParams();
      userPayload.append('Identity', userIdentity);
      userPayload.append('RoleSid', serviceRole);

      console.log(`🔧 Creating Twilio user with role:`, {
        identity: userIdentity,
        roleSid: serviceRole,
        roleType: serviceRole === this.roles.SERVICE_ADMIN ? 'Service Admin' : 'Service User'
      });

      const response = await fetch(userUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: userPayload
      });

      if (!response.ok) {
        const errorText = await response.text();
        // If user already exists, that's okay - we'll update their role
        if (response.status === 409 || errorText.includes('already exists')) {
          console.log(`ℹ️ User ${userIdentity} already exists in Twilio, will update role if needed`);
          return await this.updateTwilioUserRole(userIdentity, serviceRole);
        } else {
          throw new Error(`Twilio User API error: ${response.status} - ${errorText}`);
        }
      }

      const userData = await response.json();
      console.log(`✅ Created Twilio user successfully:`, {
        identity: userData.identity,
        roleSid: userData.role_sid
      });

      return userData;
    } catch (error) {
      console.error('❌ Failed to create Twilio user with role:', error);
      throw error;
    }
  }

  /**
   * Update existing Twilio user's service role
   */
  async updateTwilioUserRole(userIdentity, newRoleSid) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    try {
      const userUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
        ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Users/${encodeURIComponent(userIdentity)}`
        : `https://conversations.twilio.com/v1/Users/${encodeURIComponent(userIdentity)}`;

      const userPayload = new URLSearchParams();
      userPayload.append('RoleSid', newRoleSid);

      console.log(`🔧 Updating Twilio user role:`, {
        identity: userIdentity,
        newRoleSid: newRoleSid,
        roleType: newRoleSid === this.roles.SERVICE_ADMIN ? 'Service Admin' : 'Service User'
      });

      const response = await fetch(userUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: userPayload
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twilio User Update API error: ${response.status} - ${errorText}`);
      }

      const userData = await response.json();
      console.log(`✅ Updated Twilio user role successfully:`, {
        identity: userData.identity,
        roleSid: userData.role_sid
      });

      return userData;
    } catch (error) {
      console.error('❌ Failed to update Twilio user role:', error);
      throw error;
    }
  }

  /**
   * Ensure bot has proper roles in Twilio
   */
  async ensureBotRoles() {
    try {
      console.log(`🤖 Ensuring bot has proper roles: ${this.botIdentity}`);
      await this.createTwilioUserWithRole(this.botIdentity);
    } catch (error) {
      console.error('❌ Failed to ensure bot roles:', error);
    }
  }

  /**
   * Process all participants in a conversation and assign appropriate roles
   * NOTE: This should only be called from webhooks, not immediately after conversation creation
   */
  async processConversationParticipants(conversationSid, participants) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.warn('⚠️ Twilio credentials not configured - skipping role assignment');
      return;
    }

    // Add delay to ensure participants are fully registered in Twilio
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      console.log(`🔧 Processing participant roles for conversation: ${conversationSid}`);
      
      for (const participant of participants) {
        // Skip SMS participants (customers)
        if (!participant.Identity) {
          console.log(`📱 Skipping SMS participant (customer)`);
          continue;
        }

        const conversationRole = await this.getConversationRoleForUser(participant.Identity);
        
        // Update participant role in the conversation
        await this.updateParticipantRole(conversationSid, participant.Identity, conversationRole);
      }
      
      console.log(`✅ Processed participant roles for conversation: ${conversationSid}`);
    } catch (error) {
      console.error('❌ Error processing conversation participants:', error);
    }
  }

  /**
   * Update a participant's role in a specific conversation
   */
  async updateParticipantRole(conversationSid, participantIdentity, roleSid) {
    try {
      // First get the participant SID
      const participantUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
        ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversationSid}/Participants`
        : `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Participants`;

      const participantsResponse = await fetch(participantUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`
        }
      });

      if (!participantsResponse.ok) {
        throw new Error(`Failed to get participants: ${participantsResponse.status}`);
      }

      const participantsData = await participantsResponse.json();
      const participant = participantsData.participants?.find(p => p.identity === participantIdentity);

      if (!participant) {
        console.log(`⚠️ Participant ${participantIdentity} not found in conversation ${conversationSid}`);
        return;
      }

      // Update the participant's role
      const updateUrl = process.env.TWILIO_CONVERSATIONS_SERVICE_SID 
        ? `https://conversations.twilio.com/v1/Services/${process.env.TWILIO_CONVERSATIONS_SERVICE_SID}/Conversations/${conversationSid}/Participants/${participant.sid}`
        : `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Participants/${participant.sid}`;

      const updatePayload = new URLSearchParams();
      updatePayload.append('RoleSid', roleSid);

      console.log(`🔧 Updating participant role:`, {
        conversationSid,
        participantIdentity,
        participantSid: participant.sid,
        newRoleSid: roleSid,
        roleType: roleSid === this.roles.CHANNEL_ADMIN ? 'Channel Admin' : 'Channel User'
      });

      const updateResponse = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: updatePayload
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update participant role: ${updateResponse.status} - ${errorText}`);
      }

      const updatedParticipant = await updateResponse.json();
      console.log(`✅ Updated participant role successfully:`, {
        identity: updatedParticipant.identity,
        roleSid: updatedParticipant.role_sid
      });

    } catch (error) {
      console.error(`❌ Failed to update participant role for ${participantIdentity}:`, error);
    }
  }
}

module.exports = new TwilioRoleService();