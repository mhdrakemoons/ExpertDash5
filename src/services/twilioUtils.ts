import type { User } from '../types';

export function isBotUser(user: User | null): boolean {
  if (!user) return false;
  
  return user.role === 'bot' || 
         user.role === 'system' ||
         (user.email && isBotIdentity(user.email)) ||
         (user.name && isBotIdentity(user.name));
}

export function isBotIdentity(identity: string): boolean {
  if (!identity) return false;
  
  const lowerIdentity = identity.toLowerCase();
  const botKeywords = [
    'bot',
    'system', 
    'auto',
    'make',
    'webhook',
    'support_bot_',
    'automated',
    'service',
    'api'
  ];
  
  return botKeywords.some(keyword => lowerIdentity.includes(keyword));
}

export function getDebugInfo(): any {
  return {
    hasClient: false, // Will be implemented when needed
    hasToken: false,
    connectionState: 'unknown',
    userIdentity: 'unknown',
    eventHandlersCount: 0,
    pollingActive: false,
    pollingInterval: null,
    pollCount: 0,
    nextPollInSeconds: 0,
    elapsedSeconds: 0,
    trackedConversations: 0,
    accountSid: 'unknown',
    isInitializing: false,
    hasGlobalInstance: false,
  };
}

export function validateConversationSid(sid: string): boolean {
  if (!sid || typeof sid !== 'string') {
    return false;
  }
  
  // Twilio conversation SIDs start with 'CH' followed by 32 hex characters
  const conversationSidPattern = /^CH[a-f0-9]{32}$/i;
  return conversationSidPattern.test(sid);
}

export function validateMessageSid(sid: string): boolean {
  if (!sid || typeof sid !== 'string') {
    return false;
  }
  
  // Twilio message SIDs start with 'IM' followed by 32 hex characters
  const messageSidPattern = /^IM[a-f0-9]{32}$/i;
  return messageSidPattern.test(sid);
}

export function sanitizeMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return '';
  }
  
  // Remove excessive whitespace and limit length
  return message.trim().substring(0, 4000);
}