export interface User {
  id: string;
  email: string;
  name: string;
  role: 'expert' | 'admin' | 'bot';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface TwilioConversation {
  sid: string;
  uniqueName?: string;
  friendlyName?: string;
  dateCreated: Date;
  dateUpdated: Date;
  participants: TwilioParticipant[];
  lastMessage?: TwilioMessage;
  state?: string;
  attributes?: Record<string, any>;
}

export interface TwilioParticipant {
  sid: string;
  identity: string;
  type: string;
  displayName?: string;
  isCustomer?: boolean;
  roleSid?: string;
  dateCreated?: Date;
  dateUpdated?: Date;
}

export interface TwilioMessage {
  sid: string;
  author: string;
  body: string;
  dateCreated: Date;
  type: string;
  index: number;
  participantSid?: string;
  conversationSid?: string;
  attributes?: Record<string, any>;
  from?: string; // Extracted from attributes for convenience
}

export interface Inquiry {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message: string;
  conversationSid?: string;
  assignedExpert?: string;
  assignedExpertId?: string;
  status: 'new' | 'assigned' | 'in_progress' | 'resolved';
  createdAt: Date;
  updatedAt?: Date;
}

export interface Expert {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: Date;
}

export interface CreateInquiryRequest {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message: string;
  assignedExpertId: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ConnectionStatus {
  isConnected: boolean;
  connectionState: string;
  lastConnected?: Date;
  reconnectAttempts?: number;
}

export interface PollingStatus {
  isActive: boolean;
  pollCount: number;
  nextPollInSeconds: number;
  elapsedSeconds: number;
  hasInstance: boolean;
  timerId: number | null;
}

export interface TwilioDebugInfo {
  hasClient: boolean;
  hasToken: boolean;
  connectionState: string;
  userIdentity: string;
  eventHandlersCount: number;
  pollingActive: boolean;
  pollingInterval: number | null;
  pollCount: number;
  nextPollInSeconds: number;
  elapsedSeconds: number;
  trackedConversations: number;
  accountSid: string;
  isInitializing: boolean;
  hasGlobalInstance: boolean;
}

// Error types for better error handling
export interface ApiError extends Error {
  status: number;
  code?: string;
}

export interface TwilioError extends Error {
  code?: string | number;
  status?: number;
  moreInfo?: string;
}

// Event types for type-safe event handling
export type TwilioEventType = 
  | 'connectionStateChanged'
  | 'messageAdded'
  | 'conversationAdded'
  | 'conversationUpdated'
  | 'conversationsUpdated'
  | 'participantJoined'
  | 'participantLeft'
  | 'tokenAboutToExpire'
  | 'tokenExpired';

export interface TwilioEventHandler {
  (eventName: TwilioEventType, handler: Function): void;
}