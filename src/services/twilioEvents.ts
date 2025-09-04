import { twilioClientManager } from './twilioClient';

export type TwilioEventType = 
  | 'connectionStateChanged'
  | 'messageAdded' 
  | 'conversationAdded'
  | 'conversationUpdated'
  | 'participantJoined'
  | 'participantLeft'
  | 'tokenExpired';

export class TwilioEventManager {
  private eventHandlers: Map<string, Function[]> = new Map();
  private isListening: boolean = false;

  // Set up event listeners for real-time updates
  setupEventListeners(): void {
    const client = twilioClientManager.getClient();
    if (!client || this.isListening) {
      return;
    }

    console.log('🎧 Setting up Twilio event listeners...');

    // Message events
    client.on('messageAdded', (message: any) => {
      console.log('📨 New message received:', {
        conversationSid: message.conversation?.sid,
        author: message.author,
        body: message.body?.substring(0, 50)
      });
      this.emit('messageAdded', message);
    });

    // Conversation events
    client.on('conversationAdded', (conversation: any) => {
      console.log('🆕 New conversation added:', conversation.sid);
      this.emit('conversationAdded', conversation);
    });

    client.on('conversationUpdated', (conversation: any) => {
      console.log('🔄 Conversation updated:', conversation.sid);
      this.emit('conversationUpdated', conversation);
    });

    // Participant events
    client.on('participantJoined', (participant: any) => {
      console.log('👋 Participant joined:', {
        conversationSid: participant.conversation?.sid,
        identity: participant.identity
      });
      this.emit('participantJoined', participant);
    });

    client.on('participantLeft', (participant: any) => {
      console.log('👋 Participant left:', {
        conversationSid: participant.conversation?.sid,
        identity: participant.identity
      });
      this.emit('participantLeft', participant);
    });

    this.isListening = true;
    console.log('✅ Twilio event listeners set up successfully');
  }

  // Remove all event listeners
  removeEventListeners(): void {
    const client = twilioClientManager.getClient();
    if (client) {
      console.log('🔇 Removing Twilio event listeners...');
      client.removeAllListeners();
    }
    
    this.isListening = false;
    this.eventHandlers.clear();
    console.log('✅ Twilio event listeners removed');
  }

  // Add event handler
  on(event: TwilioEventType, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  // Remove event handler
  off(event: TwilioEventType, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Emit event to all handlers
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`❌ Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}

export const twilioEventManager = new TwilioEventManager();