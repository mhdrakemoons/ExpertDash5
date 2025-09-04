import { API_BASE_URL, handleResponse, retryRequest } from './core';

export const conversationsApi = {
  async getMainConversations(token: string, page: number = 1, limit: number = 15) {
    try {
      console.log(`⚡ FAST: Loading conversations page ${page} (limit: ${limit})`);
      
      const response = await fetch(`${API_BASE_URL}/api/conversations/main?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await handleResponse(response);
      console.log(`⚡ FAST: Loaded ${data.conversations?.length || 0} conversations`);
      return data;
    } catch (error) {
      console.error('Failed to fetch main conversations:', error);
      throw error;
    }
  },

  async getConversationParticipants(token: string, conversationSid: string) {
    try {
      console.log(`👥 Loading participants for: ${conversationSid}`);
      
      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationSid}/participants`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await handleResponse(response);
      console.log(`👥 Loaded ${data.participants?.length || 0} participants for ${conversationSid}`);
      return data;
    } catch (error) {
      console.error(`Failed to fetch participants for ${conversationSid}:`, error);
      throw error;
    }
  },

  async getConversationMessages(conversationSid: string, token: string) {
    console.log(`📨 Fetching messages from backend for conversation: ${conversationSid}`);
    
    const response = await retryRequest(() =>
      fetch(`${API_BASE_URL}/api/conversations/${conversationSid}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
    );

    const data = await handleResponse(response);
    console.log(`✅ Backend returned ${data.messages?.length || 0} messages for ${conversationSid}`);
    
    // Safe date parsing for frontend - using the working old approach
    if (data.messages) {
      data.messages = data.messages.map((msg: any) => {
        // Simple date handling - if it fails, use current date
        let dateCreated;
        try {
          // Handle both ISO strings and Twilio date formats
          if (msg.dateCreated) {
            dateCreated = new Date(msg.dateCreated);
            if (isNaN(dateCreated.getTime())) {
              console.warn(`⚠️ Invalid date for message ${msg.sid}, using current date`);
              dateCreated = new Date();
            }
          } else {
            dateCreated = new Date();
          }
        } catch {
          dateCreated = new Date();
        }
        
        return {
          ...msg,
          dateCreated
        };
      });
    }
    
    return data;
  },

  async getExpertAdminDMs(token: string, page: number = 1, limit: number = 50) {
    try {
      console.log(`🔗 Fetching expert-admin DMs`);
      const response = await fetch(`${API_BASE_URL}/api/conversations/expert-admin-dms?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await handleResponse(response);
      console.log('✅ Expert-admin DMs loaded successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to fetch expert-admin DMs:', error);
      throw error;
    }
  },

  async getAdminTravelerDMs(token: string) {
    try {
      console.log('🔗 Fetching admin-traveler DMs');
      const response = await fetch(`${API_BASE_URL}/api/conversations/admin-traveler-dms`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await handleResponse(response);
      console.log('✅ Admin-traveler DMs loaded successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to fetch admin-traveler DMs:', error);
      throw error;
    }
  },
};