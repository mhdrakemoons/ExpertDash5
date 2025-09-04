import type { User } from '../types';

export interface TwilioClientConfig {
  token: string;
  identity: string;
}

export interface ConnectionState {
  state: 'unknown' | 'connecting' | 'connected' | 'denied' | 'failed' | 'disconnected';
  client: any | null;
  identity: string | null;
  isInitializing: boolean;
}

class TwilioClientManager {
  private connectionState: ConnectionState = {
    state: 'unknown',
    client: null,
    identity: null,
    isInitializing: false
  };

  private eventHandlers: Map<string, Function[]> = new Map();

  async initialize(token: string, identity?: string): Promise<any> {
    if (this.connectionState.isInitializing) {
      console.log('⚠️ Twilio initialization already in progress');
      return this.connectionState.client;
    }

    this.connectionState.isInitializing = true;

    try {
      // Import Twilio Conversations SDK
      const { Client } = await import('@twilio/conversations');
      
      const clientIdentity = identity || 'user';
      console.log(`🔄 Initializing Twilio client for identity: ${clientIdentity}`);

      const client = new Client(token);
      
      // Set up connection event handlers
      client.on('connectionStateChanged', (state: string) => {
        console.log(`🔗 Twilio connection state: ${state}`);
        this.connectionState.state = state as any;
        this.emit('connectionStateChanged', state);
      });

      client.on('tokenExpired', () => {
        console.log('🎫 Twilio token expired');
        this.emit('tokenExpired');
      });

      this.connectionState.client = client;
      this.connectionState.identity = clientIdentity;
      this.connectionState.state = 'connecting';

      console.log('✅ Twilio client initialized successfully');
      return client;

    } catch (error) {
      console.error('❌ Failed to initialize Twilio client:', error);
      this.connectionState.state = 'failed';
      this.connectionState.isInitializing = false;
      throw error;
    } finally {
      this.connectionState.isInitializing = false;
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting Twilio client...');
    
    if (this.connectionState.client) {
      try {
        this.connectionState.client.removeAllListeners();
        // Note: Twilio client doesn't have a disconnect method, it disconnects automatically
      } catch (error) {
        console.error('❌ Error during disconnect:', error);
      }
    }

    this.connectionState = {
      state: 'disconnected',
      client: null,
      identity: null,
      isInitializing: false
    };

    console.log('✅ Twilio client disconnected');
  }

  getClient(): any | null {
    return this.connectionState.client;
  }

  getConnectionState(): string {
    return this.connectionState.state;
  }

  getIdentity(): string | null {
    return this.connectionState.identity;
  }

  isConnected(): boolean {
    return this.connectionState.state === 'connected' && !!this.connectionState.client;
  }

  isInitializing(): boolean {
    return this.connectionState.isInitializing;
  }

  // Event system for connection state changes
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

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

export const twilioClientManager = new TwilioClientManager();