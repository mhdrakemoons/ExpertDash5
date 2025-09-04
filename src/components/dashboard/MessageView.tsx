import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, Bot, User, RefreshCw, Wifi, WifiOff, Users, Shield, ChevronDown, UserCheck, MapPin } from 'lucide-react';
import { ParticipantPopover } from './ParticipantPopover';
import { FormattedMessage } from '../common/FormattedMessage';
import type { TwilioMessage, TwilioConversation } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { twilioService } from '../../services/twilio';
import { getMessageDisplayInfo, getMessageStyling, getMessageIcon, isBotMessage } from '../../utils/messageDisplay';

interface MessageViewProps {
  conversation: TwilioConversation | null;
  messages: TwilioMessage[];
  onSendMessage: (message: string) => Promise<void>;
  onRefreshMessages?: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  sendingChunks?: { current: number; total: number } | null;
  isConversationAccepted?: boolean;
  onShowAcceptance?: () => void;
}

export function MessageView({
  conversation,
  messages,
  onSendMessage,
  onRefreshMessages,
  isLoading,
  error,
  sendingChunks,
  isConversationAccepted = true,
  onShowAcceptance,
}: MessageViewProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('unknown');
  const [showParticipants, setShowParticipants] = useState<{ position: { x: number; y: number } } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();

  // Monitor Twilio connection status
  useEffect(() => {
    const updateConnectionStatus = () => {
      const status = twilioService.getConnectionState();
      setConnectionStatus(status || 'unknown');
    };

    // Update immediately
    updateConnectionStatus();

    // Set up listener for connection changes
    const handleConnectionChange = (state: string) => {
      setConnectionStatus(state);
    };

    twilioService.on('connectionStateChanged', handleConnectionChange);

    // Update every few seconds as backup
    const interval = setInterval(updateConnectionStatus, 5000);

    return () => {
      twilioService.off('connectionStateChanged', handleConnectionChange);
      clearInterval(interval);
    };
  }, []);

  // Track last message time
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      setLastMessageTime(lastMsg.dateCreated);
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when conversation changes
  useEffect(() => {
    if (conversation && !isLoading) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [conversation, isLoading]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newMessage]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSending) return;

    const messageToSend = newMessage.trim();
    setIsSending(true);
    
    try {
      console.log(`📤 Sending message: "${messageToSend.substring(0, 50)}..."`);
      await onSendMessage(messageToSend);
      setNewMessage('');
      
      // Focus input after sending
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      
    } catch (err) {
      console.error('❌ Failed to send message:', err);
      // Keep the message in the input on error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
    // Shift+Enter allows newlines
  };

  const handleRefreshMessages = async () => {
    if (!conversation || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      console.log('🔄 Manually refreshing messages...');
      if (onRefreshMessages) {
        await onRefreshMessages();
      } else {
        // Fallback: force refresh via Twilio
        await twilioService.triggerPoll();
        // Give it a moment to update
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error('❌ Failed to refresh messages:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  // Get icon component based on type
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Bot':
        return Bot;
      case 'Shield':
        return Shield;
      case 'UserCheck':
        return UserCheck;
      case 'MapPin':
        return MapPin;
      default:
        return User;
    }
  };

  // Check if current user is a bot
  const isCurrentUserBot = (): boolean => {
    if (!user) return false;
    
    return user.role === 'bot' || 
           user.role === 'system' ||
           (user.email && isBotMessage(user.email)) ||
           (user.name && isBotMessage(user.name));
  };

  const handleParticipantClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setShowParticipants({
      position: { x: rect.left, y: rect.bottom }
    });
  };

  // Connection status indicator
  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case 'connected':
        return { icon: Wifi, color: 'text-green-500', text: 'Connected' };
      case 'connecting':
        return { icon: WifiOff, color: 'text-yellow-500', text: 'Connecting' };
      case 'disconnected':
        return { icon: WifiOff, color: 'text-red-500', text: 'Disconnected' };
      default:
        return { icon: WifiOff, color: 'text-gray-500', text: 'Unknown' };
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500 max-w-md">
          <Send className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-medium mb-2">Select a conversation</h3>
          <p className="mb-4">Choose a conversation from the sidebar to start messaging</p>
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Real-time Message Flow:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• External Sources → Twilio → Your App</p>
              <p>• You → Twilio → External Sources</p>
              <p>• Live sync via Twilio events + polling</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = conversation.friendlyName || conversation.uniqueName || `Conversation ${conversation.sid.slice(-6)}`;
  const connectionDisplay = getConnectionDisplay();
  const ConnectionIcon = connectionDisplay.icon;

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      {/* Enhanced Header */}
      <div className="border-b border-gray-200 p-4 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">{displayName}</h2>
              <div className="flex items-center gap-1" title={`Twilio: ${connectionDisplay.text}`}>
                <ConnectionIcon className={`w-4 h-4 ${connectionDisplay.color}`} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <button
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 hover:text-blue-800 rounded-lg border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                onClick={handleParticipantClick}
              >
                <UserCheck className="w-4 h-4" />
                <span className="font-medium">
                  {conversation.participants.length === 0 ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                      Loading participants...
                    </span>
                  ) : `${conversation.participants.length} participants`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>
              <span>•</span>
              <span>Connected via Twilio</span>
              {lastMessageTime && (
                <>
                  <span>•</span>
                  <span>Last activity: {formatRelativeTime(lastMessageTime)}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshMessages}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Refresh messages"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="text-right text-xs text-gray-500">
              <p>Created: {formatTime(conversation.dateCreated)}</p>
              <p>Updated: {formatTime(conversation.dateUpdated)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 text-sm font-medium">Connection Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              {connectionStatus === 'disconnected' && (
                <p className="text-red-600 text-xs mt-2">
                  Real-time updates may be delayed. Messages will sync when connection is restored.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Warning */}
      {connectionStatus === 'disconnected' && !error && (
        <div className="p-3 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-500" />
            <div className="flex-1">
              <p className="text-yellow-800 text-sm">
                Connection to Twilio lost. Attempting to reconnect...
              </p>
              <p className="text-yellow-700 text-xs mt-1">
                You can still send messages, but real-time updates may be delayed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 max-h-full" style={{ scrollBehavior: 'smooth' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span>Loading messages...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <Send className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="font-medium">No messages in this conversation yet</p>
              <p className="text-sm mt-1">Send the first message to get started</p>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs">
                <p className="font-medium text-gray-700 mb-1">Ready for real-time messaging:</p>
                <p>• Messages from external sources appear instantly</p>
                <p>• Your messages sync to external systems via Twilio</p>
                <p>• Auto-polling detects delayed messages</p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const displayInfo = getMessageDisplayInfo(message, user);
            const styling = getMessageStyling(displayInfo);
            const IconComponent = getIconComponent(getMessageIcon(displayInfo.icon));
            const showDate = index === 0 || 
              new Date(message.dateCreated).toDateString() !== new Date(messages[index - 1].dateCreated).toDateString();

            return (
              <div key={message.sid}>
                {showDate && (
                  <div className="text-center my-4">
                    <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {formatDate(message.dateCreated)}
                    </span>
                  </div>
                )}
                
                <div className={`flex ${displayInfo.isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${styling.containerClass}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {!displayInfo.isCurrentUser && (
                          <div className="flex items-center gap-1 mb-2">
                            <IconComponent className={`w-3 h-3 ${styling.iconColor}`} />
                            <p className={`text-xs font-medium ${styling.nameClass}`}>
                              {displayInfo.displayName}
                              {displayInfo.type === 'bot' && (
                                <span className="text-xs opacity-60 ml-1">(automated)</span>
                              )}
                              {displayInfo.type === 'admin' && (
                                <span className="text-xs opacity-60 ml-1">(admin)</span>
                              )}
                              {displayInfo.type === 'expert' && (
                                <span className="text-xs opacity-60 ml-1">(local expert)</span>
                              )}
                              {displayInfo.type === 'traveler' && (
                                <span className="text-xs opacity-60 ml-1">(traveler)</span>
                              )}
                            </p>
                          </div>
                        )}
                        <div className="text-sm leading-relaxed">
                          <FormattedMessage text={message.body} />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className={`text-xs ${
                            displayInfo.isCurrentUser ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.dateCreated)}
                          </p>
                          {displayInfo.isCurrentUser && (
                            <span className="text-xs text-blue-200">
                              {isCurrentUserBot() ? 
                                'Local Only (Bot)' : '→ Twilio → External'}
                            </span>
                          )}
                          {displayInfo.type === 'bot' && (
                            <span className="text-xs text-green-600">
                              External → Twilio → You
                            </span>
                          )}
                          {displayInfo.type === 'admin' && !displayInfo.isCurrentUser && (
                            <span className="text-xs text-blue-600">
                              Baboo Team
                            </span>
                          )}
                          {displayInfo.type === 'expert' && !displayInfo.isCurrentUser && (
                            <span className="text-xs text-purple-600">
                              Local Expert
                            </span>
                          )}
                          {displayInfo.type === 'traveler' && (
                            <span className="text-xs text-orange-600">
                              Traveler Message
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Message Input */}
      <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
        {!isConversationAccepted ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 relative">
            {/* Small acceptance popup in top-right corner */}
            <div className="absolute top-2 right-2">
              <button
                onClick={onShowAcceptance}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors font-medium text-sm shadow-lg"
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Accept Conversation
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">Conversation Not Accepted</p>
                <p className="text-xs text-amber-700">You must accept this conversation before you can send messages.</p>
                <p className="text-xs text-amber-600 mt-1">Click the "Accept Conversation" button in the top-right corner.</p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              rows={2}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                connectionStatus === 'connected' 
                  ? isCurrentUserBot()
                    ? "Bot message (local only - won't trigger external workflows)"
                    : "Type your message... Press Shift+Enter for new line"
                  : connectionStatus === 'connecting'
                    ? "Connecting to Twilio..."
                    : "Connection lost - message will send when reconnected"
              }
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none min-h-[60px] max-h-[120px] overflow-y-auto"
              disabled={isSending}
              style={{ height: 'auto' }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending || !!sendingChunks}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium self-end"
              title="Send message via Twilio to external systems"
            >
              {sendingChunks ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending {sendingChunks.current}/{sendingChunks.total}
                </div>
              ) : isSending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending
                </div>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {/* Status indicators */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className={`flex items-center gap-1 ${
                connectionStatus === 'connected' ? 'text-green-600' : 
                connectionStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                <ConnectionIcon className="w-3 h-3" />
                {connectionDisplay.text}
              </span>
              <span>{newMessage.length} chars</span>
              {isCurrentUserBot() && (
                <span className="text-orange-600 font-medium">
                  🤖 Bot Mode: Local Only (No Twilio)
                </span>
              )}
              {sendingChunks && (
                <span className="text-blue-600 font-medium">
                  📤 Sending part {sendingChunks.current} of {sendingChunks.total}...
                </span>
              )}
              <span className="text-gray-400">
                Shift+Enter for new line
              </span>
            </div>
            <div className="text-right">
              <p>
                {isCurrentUserBot() ? 
                  '🚫 Bot messages: Local only (Twilio blocked)' : 
                  sendingChunks ? 
                    `📤 Multi-part message: ${sendingChunks.current}/${sendingChunks.total} chunks` :
                    'Messages route: You → Twilio → External Systems'}
              </p>
              {newMessage.length > 1000 && (
                <p className="text-orange-600 text-xs mt-1">
                  ⚠️ Message will be split into {Math.ceil(newMessage.length / 1000)} parts (current: {newMessage.length} chars)
                </p>
              )}
            </div>
          </div>
        </form>
        )}
      </div>
      
      {/* Participant Popover */}
      {showParticipants && conversation && (
        <ParticipantPopover
          participants={conversation.participants}
          onClose={() => setShowParticipants(null)}
          position={showParticipants.position}
        />
      )}
    </div>
  );
}