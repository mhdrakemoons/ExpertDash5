import { twilioClientManager } from './twilioClient';
import type { TwilioConversation, TwilioParticipant } from '../types';

export class TwilioConversationManager {
  
  // Get a specific conversation by SID
  async getConversation(conversationSid: string): Promise<any> {
    try {
      const client = twilioClientManager.getClient();
      if (!client) {
        console.log('❌ Twilio client not initialized');
        return null;
      }

      console.log(`🔍 Getting conversation: ${conversationSid}`);
      
      // Try multiple methods to get conversation
      let conversation;
      try {
        if (typeof client.getConversationBySid === 'function') {
          conversation = await client.getConversationBySid(conversationSid);
        } else if (typeof client.getConversation === 'function') {
          conversation = await client.getConversation(conversationSid);
        } else if (client.conversations && typeof client.conversations.get === 'function') {
          conversation = await client.conversations.get(conversationSid);
        } else {
          console.log('❌ No conversation access method available on client');
          return null;
        }
      } catch (accessError) {
        console.warn(`⚠️ Conversation access failed (likely permission issue):`, accessError);
        return null;
      }
      
      if (!conversation) {
        console.log('❌ No conversation found in Twilio client');
        return null;
      }
      
      return conversation;
    } catch (error) {
      console.error('❌ Failed to get conversation:', error);
      return null;
    }
  }

  // Get all conversations for the current user
  async getConversations(): Promise<TwilioConversation[]> {
    try {
      const client = twilioClientManager.getClient();
      if (!client) {
        throw new Error('Twilio client not initialized');
      }

      console.log('📋 Getting all conversations...');
      
      const conversations = await client.getSubscribedConversations();
      
      if (!conversations || !Array.isArray(conversations.items)) {
        console.log('❌ No conversations found');
        return [];
      }

      console.log(`✅ Found ${conversations.items.length} conversations`);
      
      return conversations.items.map(this.transformConversation);
    } catch (error) {
      console.error('❌ Failed to get conversations:', error);
      return [];
    }
  }

  // Transform Twilio conversation object to our format
  private transformConversation = (twilioConv: any): TwilioConversation => {
    return {
      sid: twilioConv.sid,
      uniqueName: twilioConv.uniqueName,
      friendlyName: twilioConv.friendlyName,
      dateCreated: new Date(twilioConv.dateCreated),
      dateUpdated: new Date(twilioConv.dateUpdated),
      participants: [], // Will be loaded separately
      state: twilioConv.state,
      attributes: twilioConv.attributes || {},
    };
  };

  // Get participants for a conversation
  async getParticipants(conversationSid: string): Promise<TwilioParticipant[]> {
    try {
      const conversation = await this.getConversation(conversationSid);
      
      if (!conversation || typeof conversation.getParticipants !== 'function') {
        console.log('❌ Conversation does not support getParticipants');
        return [];
      }

      const participants = await conversation.getParticipants();
      
      if (!participants || !Array.isArray(participants)) {
        console.log('❌ No participants found');
        return [];
      }

      console.log(`✅ Found ${participants.length} participants in conversation`);
      
      return participants.map(this.transformParticipant);
    } catch (error) {
      console.error('❌ Failed to get participants:', error);
      return [];
    }
  }

  // Transform Twilio participant object to our format
  private transformParticipant = (twilioParticipant: any): TwilioParticipant => {
    return {
      sid: twilioParticipant.sid,
      identity: twilioParticipant.identity,
      type: twilioParticipant.type || 'unknown',
      displayName: twilioParticipant.identity || 'Unknown User',
      isCustomer: !twilioParticipant.identity, // SMS participants don't have identity
      roleSid: twilioParticipant.roleSid,
      dateCreated: twilioParticipant.dateCreated,
      dateUpdated: twilioParticipant.dateUpdated,
    };
  };
}

export const twilioConversationManager = new TwilioConversationManager();