import { API_BASE_URL, handleResponse } from './core';

export const adminApi = {
  async sendMessageToTraveler(data: {
    conversationSid: string;
    message: string;
    travelerName: string;
    adminName: string;
  }, token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/send-to-traveler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        // Handle specific error cases
        if (response.status === 503) {
          throw new Error(`Service unavailable: ${errorData.message}. Please configure Make.com webhooks.`);
        }
        
        throw new Error(errorData.message || 'Failed to send message to traveler');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error: Failed to send message to traveler');
    }
  },

  async updateBotSettings(data: {
    action: 'enable' | 'disable';
    type: 'Expert Bot' | 'Traveler Bot';
    conversationSid?: string;
  }, token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/bot-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        // Handle specific error cases
        if (response.status === 503) {
          throw new Error(`Service unavailable: ${errorData.message}. Please configure Make.com webhooks.`);
        }
        
        throw new Error(errorData.message || 'Failed to update bot settings');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error: Failed to update bot settings');
    }
  },

  async getBotSettings(conversationSid: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/admin/bot-settings/${conversationSid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return handleResponse(response);
  },

  async getWebhookStatus(token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/webhook-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return handleResponse(response);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error: Failed to fetch webhook status');
    }
  },

  async sendMessageToTravelerDM(data: {
    conversationSid: string;
    message: string;
    travelerEmail: string;
    travelerPhone: string;
    travelerName: string;
    adminName: string;
  }, token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/send-to-traveler-dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send DM message to traveler');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error: Failed to send DM message to traveler');
    }
  },
};