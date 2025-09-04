import { MessageCircle, Clock, Wifi, ChevronDown, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

import type { TwilioConversation } from '../../types';

interface ConversationListProps {
  conversations: TwilioConversation[];
  selectedConversationSid: string | null;
  onSelectConversation: (sid: string) => void;
  isLoading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  acceptedConversations?: Set<string>;
}

export function ConversationList({
  conversations,
  selectedConversationSid,
  onSelectConversation,
  isLoading,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  acceptedConversations,
}: ConversationListProps) {
  const { user } = useAuth();


  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return formatTime(messageDate);
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Active now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays}d ago`;
  };


  
  const getConversationStatus = (conversation: TwilioConversation) => {
    const timeSinceUpdate = Date.now() - conversation.dateUpdated.getTime();
    const isRecent = timeSinceUpdate < 5 * 60 * 1000; // 5 minutes
    const hasMessages = !!conversation.lastMessage;
    
    return {
      isRecent,
      hasMessages,
      isActive: isRecent && hasMessages,
    };
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Loading conversations...</span>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 px-4">
        <MessageCircle className="w-12 h-12 mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
        <p className="text-sm text-center mb-4">
          New conversations will appear here when:
        </p>
        <div className="text-xs text-gray-400 space-y-1">
          <p>• External systems create conversations</p>
          <p>• You create new inquiries</p>
          <p>• Customers initiate contact</p>
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg w-full">
          <p className="text-xs text-blue-700 text-center">
            Real-time detection active
          </p>
        </div>
      </div>
    );
  }

  // Sort conversations by date updated (most recent first)
  const sortedConversations = [...conversations].sort((a, b) => 
    b.dateUpdated.getTime() - a.dateUpdated.getTime()
  );

  return (
    <div className="space-y-1">
      {sortedConversations.map((conversation) => {
        const isSelected = conversation.sid === selectedConversationSid;
        const displayName = conversation.friendlyName || conversation.uniqueName || `Conversation ${conversation.sid.slice(-6)}`;
        const status = getConversationStatus(conversation);
        
        return (
          <button
            key={conversation.sid}
            onClick={() => onSelectConversation(conversation.sid)}
            className={`w-full p-3 text-left rounded-lg transition-all duration-200 ${
              isSelected
                ? 'bg-blue-50 border border-blue-200 shadow-sm'
                : 'bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-medium truncate text-sm ${
                    isSelected ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {displayName}
                  </h3>
                  {user?.role === 'expert' && acceptedConversations && !acceptedConversations.has(conversation.sid) && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      UNACCEPTED
                    </span>
                  )}
                  {status.isActive && (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Created {formatDate(conversation.dateCreated)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>{formatRelativeTime(conversation.dateUpdated)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end text-right">
                {conversation.lastMessage && (
                  <div className="text-xs text-gray-500 mb-1">
                    Last: {formatTime(conversation.lastMessage.dateCreated)}
                  </div>
                )}
                {status.isRecent && (
                  <div title="Recently active">
                    <Wifi className="w-3 h-3 text-green-500" />
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
      
      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="pt-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full p-3 text-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Loading more conversations...
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-600">
                <ChevronDown className="h-4 w-4 mr-2" />
                Load more conversations
              </div>
            )}
          </button>
        </div>
      )}

    </div>
  );
}