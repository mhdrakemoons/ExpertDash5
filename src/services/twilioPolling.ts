import { twilioClientManager } from './twilioClient';
import { twilioConversationManager } from './twilioConversations';
import { twilioEventManager } from './twilioEvents';

export interface PollingConfig {
  interval: number;
  enabled: boolean;
}

export class TwilioPollingManager {
  private pollTimer: NodeJS.Timeout | null = null;
  private pollCount: number = 0;
  private config: PollingConfig = {
    interval: 10000, // 10 seconds for faster message sync
    enabled: true
  };

  startPolling(): void {
    if (this.pollTimer) {
      console.log('⚠️ Polling already active');
      return;
    }

    if (!this.config.enabled) {
      console.log('⚠️ Polling is disabled');
      return;
    }

    console.log(`🔄 Starting polling every ${this.config.interval / 1000}s...`);
    
    // Initial poll
    this.executePoll();
    
    // Set up recurring polls
    this.pollTimer = setInterval(() => {
      this.executePoll();
    }, this.config.interval);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      console.log('⏹️ Stopping Twilio polling');
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  triggerPoll(): void {
    console.log('🔄 Manual poll triggered');
    this.executePoll();
  }

  private async executePoll(): Promise<void> {
    try {
      const connectionState = twilioClientManager.getConnectionState();
      
      if (connectionState !== 'connected') {
        console.log(`⚠️ Twilio client in bad state (${connectionState}) - skipping polling until connection improves`);
        return;
      }

      this.pollCount++;
      const currentTime = new Date().toISOString();
      const currentSecond = new Date().getSeconds();
      
      console.log(`🔍 Executing global polling logic [${currentTime}] (second: ${currentSecond})`);

      // Refresh conversations to detect new ones
      await twilioConversationManager.getConversations();
      
      console.log(`✅ Poll ${this.pollCount} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Poll ${this.pollCount} failed:`, error);
    }
  }

  isPolling(): boolean {
    return !!this.pollTimer;
  }

  getPollCount(): number {
    return this.pollCount;
  }

  updateConfig(newConfig: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.pollTimer && newConfig.interval) {
      // Restart polling with new interval
      this.stopPolling();
      this.startPolling();
    }
  }
}

export const twilioPollingManager = new TwilioPollingManager();