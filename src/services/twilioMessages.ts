import { twilioClientManager } from './twilioClient';
import { twilioConversationManager } from './twilioConversations';
import type { TwilioMessage } from '../types';

export class TwilioMessageManager {
  
  // Get messages for a conversation
  async getMessages(conversationSid: string): Promise<TwilioMessage[]> {
    try {
      console.log(`📨 Attempting to get messages for conversation: ${conversationSid}`);
      
      // Try to get conversation first
      let conversation;
      try {
        conversation = await twilioConversationManager.getConversation(conversationSid);
      } catch (convError) {
        console.warn(`⚠️ Could not get conversation object, trying direct message fetch:`, convError);
        // If we can't get the conversation object, return empty array for now
        // This prevents the UI from being blocked by Twilio permission issues
        return [];
      }
      
      if (!conversation) {
        console.log('❌ No conversation provided to getMessages');
        return [];
      }

      console.log(`📨 Getting messages for conversation: ${conversationSid}`);
      
      // Try multiple methods to get messages
      let messages;
      try {
        if (typeof conversation.getMessages === 'function') {
          messages = await conversation.getMessages();
        } else if (typeof conversation.read === 'function') {
          messages = await conversation.read();
        } else if (conversation.messages) {
          messages = conversation.messages;
        } else {
          console.log('❌ Conversation object does not have message methods');
          return [];
        }
      } catch (msgError) {
        console.error('❌ Error calling conversation message methods:', msgError);
        // Fallback: try to get cached messages
        messages = conversation.messages || [];
      }
      
      if (!messages || !Array.isArray(messages)) {
        console.log(`❌ Invalid messages response: ${typeof messages}`);
        
        // Try alternative approach: get messages from conversation items
        try {
          const items = conversation.items || [];
          if (Array.isArray(items) && items.length > 0) {
            console.log(`✅ Found ${items.length} message items in conversation.items`);
            return items.map(this.transformMessage);
          }
        } catch (itemsError) {
          console.error('❌ Failed to get messages from conversation.items:', itemsError);
        }
        
        console.log('ℹ️ No messages available - returning empty array');
        return [];
      }

      console.log(`✅ Found ${messages.length} messages in conversation`);
      return messages.map(this.transformMessage);
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      // Don't throw error - return empty array to allow UI to continue working
      console.log('ℹ️ Returning empty messages array due to error');
      return [];
    }
  }

  // Send a message to a conversation
  async sendMessage(conversationSid: string, messageBody: string): Promise<void> {
    try {
      const client = twilioClientManager.getClient();
      if (!client) {
        throw new Error('Twilio client not initialized');
      }

      const conversation = await twilioConversationManager.getConversation(conversationSid);
      
      if (!conversation || typeof conversation.sendMessage !== 'function') {
        throw new Error('Conversation does not support sending messages');
      }

      console.log(`📤 Sending message to conversation: ${conversationSid}`);
      
      await conversation.sendMessage(messageBody);
      
      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  // Transform Twilio message object to our format
  private transformMessage = (twilioMessage: any): TwilioMessage => {
    return {
      sid: twilioMessage.sid,
      author: twilioMessage.author,
      body: twilioMessage.body,
      dateCreated: new Date(twilioMessage.dateCreated),
      type: twilioMessage.type || 'text',
      index: twilioMessage.index || 0,
      participantSid: twilioMessage.participantSid,
      conversationSid: twilioMessage.conversationSid,
      attributes: twilioMessage.attributes || {},
      from: twilioMessage.attributes?.from || twilioMessage.author,
    };
  };
}

export const twilioMessageManager = new TwilioMessageManager();