import { API_BASE_URL, handleResponse } from './core';

export const expertAcceptanceApi = {
  async getPendingConversations(token: string) {
    try {
      console.log('🔍 Fetching pending conversations for expert...');
      const response = await fetch(`${API_BASE_URL}/api/expert-acceptance/pending`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch pending conversations');
      }

      const data = await response.json();
      console.log('✅ Pending conversations loaded:', data);
      return data;
    } catch (error) {
      console.error('Failed to fetch pending conversations:', error);
      throw error;
    }
  },

  async acceptConversation(conversationId: string, token: string) {
    try {
      console.log(`🤝 Accepting conversation: ${conversationId}`);
      const response = await fetch(`${API_BASE_URL}/api/expert-acceptance/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept conversation');
      }

      const data = await response.json();
      console.log('✅ Conversation accepted successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to accept conversation:', error);
      throw error;
    }
  },

  async getConversationDetails(conversationId: string, token: string) {
    try {
      console.log(`🔍 Fetching conversation details: ${conversationId}`);
      const response = await fetch(`${API_BASE_URL}/api/expert-acceptance/conversation/${conversationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch conversation details');
      }

      const data = await response.json();
      console.log('✅ Conversation details loaded:', data);
      return data;
    } catch (error) {
      console.error('Failed to fetch conversation details:', error);
      throw error;
    }
  },

  async checkConversationAcceptance(conversationSid: string, token: string) {
    try {
      console.log(`🔍 Checking conversation acceptance: ${conversationSid}`);
      const response = await fetch(`${API_BASE_URL}/api/expert-acceptance/check/${conversationSid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to check conversation acceptance');
      }

      const data = await response.json();
      console.log('✅ Conversation acceptance checked:', data);
      return data;
    } catch (error) {
      console.error('Failed to check conversation acceptance:', error);
      throw error;
    }
  },

  async acceptConversationBySid(conversationSid: string, token: string) {
    try {
      console.log(`🤝 Accepting conversation by SID: ${conversationSid}`);
      const response = await fetch(`${API_BASE_URL}/api/expert-acceptance/accept-by-sid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationSid }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept conversation');
      }

      const data = await response.json();
      console.log('✅ Conversation accepted by SID successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to accept conversation by SID:', error);
      throw error;
    }
  },

  async getConversationDetailsBySid(conversationSid: string, token: string) {
    try {
      console.log(`🔍 Fetching conversation details by SID: ${conversationSid}`);
      const response = await fetch(`${API_BASE_URL}/api/expert-acceptance/details/${conversationSid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch conversation details');
      }

      const data = await response.json();
      console.log('✅ Conversation details fetched by SID:', data);
      return data;
    } catch (error) {
      console.error('Failed to fetch conversation details by SID:', error);
      throw error;
    }
  },
};