import { apiService } from './api';
import { twilioClientManager } from './twilioClient';
import { twilioConversationManager } from './twilioConversations';
import { twilioMessageManager } from './twilioMessages';
import { twilioEventManager } from './twilioEvents';
import { twilioPollingManager } from './twilioPolling';
import { isBotUser, getDebugInfo } from './twilioUtils';
import type { TwilioConversation, TwilioMessage, User } from '../types';

class TwilioService {
  private token: string | null = null;
  private identity: string | null = null;

  // Initialize Twilio service
  async initialize(authToken: string, userIdentity?: string): Promise<void> {
    try {
      console.log('🚀 Initializing Twilio service...');

      // Get Twilio token from backend
      const identity = userIdentity || 'user';
      const twilioToken = await apiService.getTwilioToken(identity, authToken);
      
      this.token = twilioToken;
      this.identity = identity;

      // Initialize client
      await twilioClientManager.initialize(twilioToken, identity);
      
      // Set up event listeners
      twilioEventManager.setupEventListeners();
      
      // Start polling for updates
      twilioPollingManager.startPolling();
      
      console.log('✅ Twilio service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Twilio service:', error);
      throw error;
    }
  }

  // Disconnect from Twilio
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting Twilio service...');
    
    // Stop polling
    twilioPollingManager.stopPolling();
    
    // Remove event listeners
    twilioEventManager.removeEventListeners();
    
    // Disconnect client
    twilioClientManager.disconnect();
    
    this.token = null;
    this.identity = null;
    
    console.log('✅ Twilio service disconnected');
  }

  // Get connection state
  getConnectionState(): string {
    return twilioClientManager.getConnectionState();
  }

  // Check if service is initialized and connected
  isConnected(): boolean {
    return twilioClientManager.isConnected();
  }

  // Get conversations
  async getConversations(): Promise<TwilioConversation[]> {
    return twilioConversationManager.getConversations();
  }

  // Get specific conversation
  async getConversation(conversationSid: string): Promise<any> {
    return twilioConversationManager.getConversation(conversationSid);
  }

  // Get messages for a conversation
  async getMessages(conversationOrSid: any): Promise<TwilioMessage[]> {
    let conversationSid: string;
    
    if (typeof conversationOrSid === 'string') {
      conversationSid = conversationOrSid;
    } else if (conversationOrSid && conversationOrSid.sid) {
      conversationSid = conversationOrSid.sid;
    } else {
      throw new Error('Invalid conversation parameter');
    }
    
    return twilioMessageManager.getMessages(conversationSid);
  }

  // Send message
  async sendMessage(conversationSid: string, messageBody: string, user?: User): Promise<void> {
    // Check if user is a bot and should be blocked
    if (user && isBotUser(user)) {
      console.log('🚫 BLOCKED: Bot/system message prevented from reaching Twilio API:', {
        identity: user.email,
        messageBody: messageBody.substring(0, 50),
        userRole: user.role
      });
      // Don't throw error, just log and return
      return;
    }
    
    return twilioMessageManager.sendMessage(conversationSid, messageBody);
  }

  // Trigger manual polling
  async triggerPoll(): Promise<void> {
    twilioPollingManager.triggerPoll();
  }

  // Event system
  on(event: string, handler: Function): void {
    twilioEventManager.on(event as any, handler);
  }

  off(event: string, handler: Function): void {
    twilioEventManager.off(event as any, handler);
  }

  // Get debug information
  getDebugInfo(): any {
    return {
      ...getDebugInfo(),
      hasClient: !!twilioClientManager.getClient(),
      connectionState: twilioClientManager.getConnectionState(),
      userIdentity: twilioClientManager.getIdentity() || 'unknown',
      isInitializing: twilioClientManager.isInitializing(),
      pollingActive: twilioPollingManager.isPolling(),
      pollCount: twilioPollingManager.getPollCount(),
    };
  }
}

// Export singleton instance
export const twilioService = new TwilioService();