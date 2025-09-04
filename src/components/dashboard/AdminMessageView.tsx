import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, Bot, User, Wifi, WifiOff, Shield, Phone, ToggleLeft, ToggleRight, RefreshCw, ChevronDown, UserCheck, MapPin } from 'lucide-react';
import { ParticipantPopover } from './ParticipantPopover';
import { FormattedMessage } from '../common/FormattedMessage';
import type { TwilioMessage, TwilioConversation } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { twilioService } from '../../services/twilio';
import { apiService } from '../../services/api';
import { getMessageDisplayInfo, getMessageStyling, getMessageIcon } from '../../utils/messageDisplay';

interface AdminMessageViewProps {
  conversation: TwilioConversation | null;
  messages: TwilioMessage[];
  onSendMessage: (message: string) => Promise<void>;
  onRefreshMessages?: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  sendingChunks?: { current: number; total: number } | null;
  conversationType?: 'main' | 'expert_admin_dm' | 'admin_traveler_dm';
  conversationData?: any; // Additional data for DM conversations
}

export function AdminMessageView({
  conversation,
  messages,
  onSendMessage,
  onRefreshMessages,
  isLoading,
  error,
  sendingChunks,
  conversationType = 'main',
  conversationData,
}: AdminMessageViewProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [botSettings, setBotSettings] = useState({
    expertBot: true,
    travelerBot: true,
  });
  const [isUpdatingBotSettings, setIsUpdatingBotSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('unknown');
  const [showParticipants, setShowParticipants] = useState<{ position: { x: number; y: number } } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user, token } = useAuth();

  // Monitor Twilio connection status
  useEffect(() => {
    const updateConnectionStatus = () => {
      const status = twilioService.getConnectionState();
      setConnectionStatus(status || 'unknown');
    };

    updateConnectionStatus();
    const handleConnectionChange = (state: string) => {
      setConnectionStatus(state);
    };

    twilioService.on('connectionStateChanged', handleConnectionChange);
    const interval = setInterval(updateConnectionStatus, 5000);

    return () => {
      twilioService.off('connectionStateChanged', handleConnectionChange);
      clearInterval(interval);
    };
  }, []);

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

  // Auto-resize textarea
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
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      
    } catch (err) {
      console.error('❌ Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };



  const handleBotToggle = async (type: 'expertBot' | 'travelerBot') => {
    setIsUpdatingBotSettings(true);
    
    const newValue = !botSettings[type];
    const action = newValue ? 'enable' : 'disable';
    const botType = type === 'expertBot' ? 'Expert Bot' : 'Traveler Bot';
    
    try {
      console.log(`🤖 ${action} ${botType}...`);
      
      // Update UI immediately (optimistic update)
      setBotSettings(prev => ({
        ...prev,
        [type]: newValue,
      }));
      
      await apiService.updateBotSettings({
        action,
        type: botType,
        conversationSid: conversation?.sid,
      }, token!);
      
      console.log(`✅ ${botType} ${action}d successfully via webhook`);
      
    } catch (error) {
      console.error(`❌ Failed to send ${action} ${botType} webhook:`, error);
      // Don't revert the optimistic update since webhook is fire-and-forget
      // Assume the webhook was sent successfully even if no response received
      console.log(`🔄 Assuming ${botType} ${action} webhook was sent successfully (fire-and-forget)`);
    } finally {
      setIsUpdatingBotSettings(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleParticipantClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setShowParticipants({
      position: { x: rect.left, y: rect.bottom }
    });
  };

  const handleRefreshMessages = async () => {
    if (!conversation || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      console.log('🔄 Admin manually refreshing messages...');
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

  const getConnectionDisplay = () => {
    if (connectionStatus === 'connected') return { icon: Wifi, color: 'text-green-500', text: 'Connected' };
    if (connectionStatus === 'connecting') return { icon: WifiOff, color: 'text-yellow-500', text: 'Connecting' };
    return { icon: WifiOff, color: 'text-red-500', text: 'Disconnected' };
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500 max-w-md">
          <Shield className="w-16 h-16 mx-auto mb-4 text-blue-400" />
          <h3 className="text-xl font-medium mb-2">Admin Dashboard</h3>
          <p className="mb-4">Select a conversation to manage communication between experts and travelers</p>
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Admin Features:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Send messages to local experts (via Twilio)</p>
              <p>• Send messages to travelers (via Make.com)</p>
              <p>• Control Baboo Bot settings</p>
              <p>• Monitor all conversation activity</p>
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
      {/* Admin Header */}
      <div className="border-b border-gray-200 p-4 bg-blue-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {conversationType === 'admin_traveler_dm' ? (
              <Phone className="w-6 h-6 text-purple-600" />
            ) : conversationType === 'expert_admin_dm' ? (
              <User className="w-6 h-6 text-green-600" />
            ) : (
              <Shield className="w-6 h-6 text-blue-600" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {conversationType === 'admin_traveler_dm' ? 'Traveler DM' : 
                 conversationType === 'expert_admin_dm' ? 'Expert DM' : 
                 'Admin Control Panel'}
              </h2>
              <p className="text-sm text-gray-600">
                {conversationType === 'admin_traveler_dm' && conversationData ? 
                  `${conversationData.customer_name} (${conversationData.customer_email})` :
                 conversationType === 'expert_admin_dm' && conversationData ?
                  `${conversationData.expert?.name || conversationData.admin?.name}` :
                 displayName}
              </p>
              
              {/* Participant Button */}
              {conversation && (
                <div className="mt-2">
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 hover:text-blue-800 rounded-lg border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md text-sm"
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
                </div>
              )}
            </div>
          </div>
          
          {/* Bot Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Expert Bot:</span>
              <button
                onClick={() => handleBotToggle('expertBot')}
                disabled={isUpdatingBotSettings}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  botSettings.expertBot
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {botSettings.expertBot ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {botSettings.expertBot ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Traveler Bot:</span>
              <button
                onClick={() => handleBotToggle('travelerBot')}
                disabled={isUpdatingBotSettings}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  botSettings.travelerBot
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {botSettings.travelerBot ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {botSettings.travelerBot ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            
            <button
              onClick={handleRefreshMessages}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Refresh messages"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        </div>
      )}

      {connectionStatus === 'disconnected' && !error && (
        <div className="p-3 bg-yellow-50 border-b border-yellow-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-500" />
            <p className="text-yellow-800 text-sm">
              Connection to Twilio lost. Expert messages may be delayed.
            </p>
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
                      {!displayInfo.isCurrentUser && (
                        <div className="flex-shrink-0 mt-1">
                          <IconComponent className={`w-4 h-4 ${styling.iconColor}`} />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        {!displayInfo.isCurrentUser && (
                          <p className={`text-xs font-medium mb-1 ${styling.nameClass}`}>
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
                        )}
                        
                        <FormattedMessage 
                          text={message.body} 
                          className={displayInfo.isCurrentUser ? 'text-white' : ''}
                        />
                        
                        <div className="flex items-center justify-between mt-2">
                          <p className={`text-xs ${
                            displayInfo.isCurrentUser ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.dateCreated)}
                          </p>
                          
                          {displayInfo.type === 'traveler' && (
                            <span className="text-xs text-orange-600">
                              → Make.com → Traveler
                            </span>
                          )}
                          {displayInfo.isCurrentUser && displayInfo.type !== 'traveler' && (
                            <span className="text-xs text-blue-200">
                              → Twilio → Expert
                            </span>
                          )}
                          {displayInfo.type === 'bot' && (
                            <span className="text-xs text-green-600">
                              External → Twilio → Dashboard
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

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0 sticky bottom-0 z-10">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              rows={2}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none min-h-[60px] max-h-[120px] overflow-y-auto"
              disabled={isSending}
              style={{ height: 'auto' }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending || !!sendingChunks}
              className="px-6 py-3 rounded-xl text-white font-medium transition-colors focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 self-end"
              title="Send message"
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
            </div>
            <div className="text-right">
              {newMessage.length > 1000 && (
                <p className="text-orange-600 text-xs mt-1">
                  ⚠️ Message will be split into {Math.ceil(newMessage.length / 1000)} parts
                </p>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Participant Popover */}
      {showParticipants && (
        <ParticipantPopover
          participants={conversation.participants}
          onClose={() => setShowParticipants(null)}
          position={showParticipants.position}
        />
      )}
    </div>
  );
} 