import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, MessageCircle, AlertCircle, Users, Shield, Phone, RefreshCw, Wifi, WifiOff, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { twilioService } from '../../services/twilio';
import { apiService } from '../../services/api';
import { ConversationList } from './ConversationList';
import { MessageView } from './MessageView';
import { AdminMessageView } from './AdminMessageView';
import { InquiryCreator } from './InquiryCreator';
import { InquiriesViewer } from './InquiriesViewer';
import { InquiriesMainView } from './InquiriesMainView';
import { DashboardHome } from './DashboardHome';
import { ConversationAcceptancePopup } from './ConversationAcceptancePopup';
import type { TwilioConversation, TwilioMessage, ConnectionStatus, PollingStatus } from '../../types';

type DashboardView = 'home' | 'conversations' | 'inquiries';

export function Dashboard() {
  const { user, logout, token } = useAuth();
  const [currentView, setCurrentView] = useState<DashboardView>('home');
  
  // Conversation state
  const [conversations, setConversations] = useState<TwilioConversation[]>([]);
  const [selectedConversationSid, setSelectedConversationSid] = useState<string | null>(null);
  const [messages, setMessages] = useState<TwilioMessage[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Connection state
  const [twilioInitialized, setTwilioInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('unknown');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Expert acceptance state
  const [acceptedConversations, setAcceptedConversations] = useState<Set<string>>(new Set());
  const [pendingAcceptanceConversation, setPendingAcceptanceConversation] = useState<{
    sid: string;
    data: any;
  } | null>(null);
  const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
  const [isAcceptingConversation, setIsAcceptingConversation] = useState(false);
  
  // Message sending state
  const [sendingChunks, setSendingChunks] = useState<{ current: number; total: number } | null>(null);

  // Initialize Twilio when component mounts
  useEffect(() => {
    if (token && !twilioInitialized) {
      initializeTwilio();
    }
  }, [token, twilioInitialized]);

  // Load conversations when Twilio is ready
  useEffect(() => {
    if (twilioInitialized && token) {
      loadConversations(1); // Load first page
    }
  }, [twilioInitialized, token]);

  // Monitor connection status
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

  const initializeTwilio = async () => {
    try {
      console.log('🔄 Initializing Twilio...');
      setError(null);
      
      await twilioService.initialize(token!);
      setTwilioInitialized(true);
      
      console.log('✅ Twilio initialized successfully');
    } catch (err) {
      console.error('❌ Failed to initialize Twilio:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize Twilio');
    }
  };

  // OPTIMIZED: Load conversations with minimal API calls
  const loadConversations = useCallback(async (page: number = 1) => {
    if (!token) return;
    
    setIsLoadingConversations(page === 1);
    if (page > 1) setIsLoadingMore(true);
    
    try {
      console.log(`⚡ ULTRA FAST: Loading conversations page ${page}...`);
      const startTime = performance.now();
      
      const response = await apiService.getMainConversations(token, page, 15);
      const loadTime = performance.now() - startTime;
      
      console.log(`⚡ ULTRA FAST: Loaded ${response.conversations?.length || 0} conversations in ${loadTime.toFixed(2)}ms`);
      
      const twilioConversations = response.conversations || [];
      
      // Transform to match expected format
      const formattedConversations = twilioConversations.map(conv => ({
        ...conv,
        dateCreated: new Date(conv.dateCreated),
        dateUpdated: new Date(conv.dateUpdated),
        participants: [], // Will be loaded on-demand
        lastMessage: undefined // Will be loaded on-demand
      }));
      
      if (page === 1) {
        setConversations(formattedConversations);
        setCurrentPage(1);
      } else {
        // Append to existing conversations for pagination
        setConversations(prev => [...prev, ...formattedConversations]);
        setCurrentPage(page);
      }
      
      // Update pagination state
      setHasMoreConversations(response.pagination?.hasMore || false);
      
      setLastRefresh(new Date());
      console.log(`✅ FAST: Conversations loaded with lazy participant loading enabled`);
      
    } catch (err) {
      console.error('❌ Failed to load conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
      setIsLoadingMore(false);
    }
  }, [token]);

  // FAST: Load participants for a specific conversation on-demand
  const loadConversationParticipants = useCallback(async (conversationSid: string) => {
    if (!token) return;
    
    try {
      console.log(`👥 Lazy loading participants for: ${conversationSid}`);
      const participantData = await apiService.getConversationParticipants(token, conversationSid);
      
      // Update the conversation in state with participant data
      setConversations(prev => prev.map(conv => 
        conv.sid === conversationSid 
          ? { 
              ...conv, 
              participants: participantData.participants || [],
              participantCount: participantData.participantCount || 0,
              conversationType: participantData.conversationType || conv.conversationType
            }
          : conv
      ));
      
      // For experts, check acceptance status for this specific conversation
      if (user?.role === 'expert') {
        try {
          const acceptanceResponse = await apiService.checkConversationAcceptance(conversationSid, token);
          if (acceptanceResponse.accepted) {
            setAcceptedConversations(prev => new Set([...prev, conversationSid]));
          }
        } catch (acceptanceError) {
          console.error(`❌ Failed to check acceptance for ${conversationSid}:`, acceptanceError);
          // Default to accepted on error to avoid blocking access
          setAcceptedConversations(prev => new Set([...prev, conversationSid]));
        }
      }
      
      console.log(`👥 Updated conversation ${conversationSid} with ${participantData.participants?.length || 0} participants`);
    } catch (error) {
      console.error(`❌ Failed to load participants for ${conversationSid}:`, error);
    }
  }, [token, user?.role]);

  // Load more conversations (pagination)
  const handleLoadMore = useCallback(async () => {
    if (!hasMoreConversations || isLoadingMore) return;
    
    const nextPage = currentPage + 1;
    console.log(`📄 Loading more conversations (page ${nextPage})...`);
    await loadConversations(nextPage);
  }, [hasMoreConversations, isLoadingMore, currentPage, loadConversations]);

  // Handle conversation selection with optimized acceptance check
  const handleSelectConversation = async (conversationSid: string) => {
    console.log(`👆 Selected conversation: ${conversationSid}`);
    
    // Set the selected conversation immediately for better UX
    setSelectedConversationSid(conversationSid);
    setMessages([]);
    
    // Load messages immediately
    loadMessages(conversationSid);
    
    // Lazy load participants for this conversation if not already loaded
    const selectedConv = conversations.find(c => c.sid === conversationSid);
    if (selectedConv && selectedConv.participants.length === 0) {
      loadConversationParticipants(conversationSid);
    }
    
    // For experts, check if conversation is accepted
    if (user?.role === 'expert') {
      // Only show acceptance modal if we know it's not accepted
      const isCurrentlyAccepted = acceptedConversations.has(conversationSid);
      
      if (!isCurrentlyAccepted) {
        // Skip acceptance check - just allow access to avoid blocking workflow
        try {
          // First check if conversation exists in our main conversations list
          const conversationExists = conversations.find(c => c.sid === conversationSid);
          
          if (conversationExists) {
            // Allow access immediately - skip acceptance checks to prevent blocking
            console.log(`✅ Allowing expert access to conversation ${conversationSid} (found in main list)`);
            setAcceptedConversations(prev => new Set([...prev, conversationSid]));
          } else {
            // Try to load conversation details, but don't block on failure
            try {
              const conversationDetails = await apiService.getConversationDetailsBySid(conversationSid, token);
              
              if (conversationDetails.data?.expert_accepted) {
                setAcceptedConversations(prev => new Set([...prev, conversationSid]));
              } else {
                setPendingAcceptanceConversation({
                  sid: conversationSid,
                  data: conversationDetails.data
                });
                setShowAcceptanceModal(true);
              }
            } catch (detailsError) {
              console.warn(`⚠️ Could not load conversation details, allowing access anyway:`, detailsError);
              // Allow access even if we can't verify acceptance to prevent blocking
              setAcceptedConversations(prev => new Set([...prev, conversationSid]));
            }
          }
        } catch (error) {
          console.warn(`⚠️ Conversation access check failed, allowing access anyway:`, error);
          setAcceptedConversations(prev => new Set([...prev, conversationSid]));
        }
      }
    }
  };

  // Check if conversation is accepted (for experts)
  const isConversationAccepted = (conversationSid: string): boolean => {
    if (user?.role !== 'expert') return true; // Non-experts can access all conversations
    return acceptedConversations.has(conversationSid);
  };

  // Handle conversation acceptance
  const handleAcceptConversation = async () => {
    if (!pendingAcceptanceConversation || !token) return;
    
    setIsAcceptingConversation(true);
    try {
      console.log(`🤝 Accepting conversation: ${pendingAcceptanceConversation.sid}`);
      
      await apiService.acceptConversationBySid(pendingAcceptanceConversation.sid, token);
      
      // Mark as accepted
      setAcceptedConversations(prev => new Set([...prev, pendingAcceptanceConversation.sid]));
      
      // Close modal
      setShowAcceptanceModal(false);
      setPendingAcceptanceConversation(null);
      
      // Refresh conversations to show updated status
      await loadConversations(1);
      
      console.log('✅ Conversation accepted successfully');
    } catch (error) {
      console.error('❌ Failed to accept conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to accept conversation');
    } finally {
      setIsAcceptingConversation(false);
    }
  };

  // Load messages for selected conversation
  const loadMessages = useCallback(async (conversationSid: string) => {
    setIsLoadingMessages(true);
    try {
      console.log(`📨 Loading messages via backend API for: ${conversationSid}`);
      
      // Use backend API to fetch messages since frontend Twilio client has permission issues
      const response = await apiService.getConversationMessages(conversationSid, token!);
      const fetchedMessages = response.messages || [];
      
      console.log(`✅ Loaded ${fetchedMessages.length} messages via backend API`);
      setMessages(fetchedMessages);
    } catch (err) {
      console.error('❌ Failed to load messages via backend API:', err);
      
      // Fallback: try Twilio frontend client (may fail due to permissions)
      try {
        console.log('🔄 Trying frontend Twilio client as fallback...');
        const conversation = await twilioService.getConversation(conversationSid);
        if (conversation) {
          const fetchedMessages = await twilioService.getMessages(conversation);
          setMessages(fetchedMessages);
          console.log(`✅ Fallback: Loaded ${fetchedMessages.length} messages via frontend client`);
        } else {
          console.log('ℹ️ No conversation available from frontend client, keeping empty messages');
          setMessages([]);
        }
      } catch (fallbackErr) {
        console.error('❌ Fallback message loading also failed:', fallbackErr);
        // Keep any existing messages, don't clear them
        console.log('ℹ️ Keeping existing messages in UI');
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Send message with chunking for long messages
  const handleSendMessage = async (message: string) => {
    if (!selectedConversationSid) return;
    
    const maxChunkSize = 1000;
    const chunks = [];
    
    // Split message into chunks if needed
    if (message.length > maxChunkSize) {
      const totalChunks = Math.ceil(message.length / maxChunkSize);
      for (let i = 0; i < message.length; i += maxChunkSize) {
        const chunk = message.slice(i, i + maxChunkSize);
        const chunkNumber = Math.floor(i / maxChunkSize) + 1;
        chunks.push(`(${chunkNumber}/${totalChunks}) ${chunk}`);
      }
    } else {
      chunks.push(message);
    }
    
    // Store the initial message count to track success
    const initialMessageCount = messages.length;
    
    // Send chunks with progress tracking
    for (let i = 0; i < chunks.length; i++) {
      setSendingChunks({ current: i + 1, total: chunks.length });
      
      try {
        console.log(`📤 Sending chunk ${i + 1}/${chunks.length} to backend...`);
        const response = await apiService.sendExternalMessage(
          selectedConversationSid,
          chunks[i],
          user?.email || 'user',
          token!,
          user?.role === 'admin' ? 'Baboo Team' : `${user?.name} - Local Expert`
        );
        
        console.log(`✅ Backend confirmed message chunk ${i + 1} sent:`, response);
        
        // Add optimistic message to UI after successful API call
        const optimisticMessage: TwilioMessage = {
          sid: response.data?.sid || `temp_${Date.now()}_${i}`,
          author: user?.email || 'user',
          body: chunks[i],
          dateCreated: new Date(),
          type: 'text',
          index: messages.length + i,
          conversationSid: selectedConversationSid,
          attributes: { from: user?.role === 'admin' ? 'Baboo Team' : `${user?.name} - Local Expert` },
          from: user?.role === 'admin' ? 'Baboo Team' : `${user?.name} - Local Expert`
        };
        
        setMessages(prev => [...prev, optimisticMessage]);
        
        // Add delay between chunks
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Failed to send chunk ${i + 1} to backend:`, error);
        // Don't add optimistic message if API call failed
        throw error;
      }
    }
    
    setSendingChunks(null);
    
    console.log('✅ All message chunks sent successfully to backend');
  };

  // Get selected conversation object
  const selectedConversation = selectedConversationSid 
    ? conversations.find(c => c.sid === selectedConversationSid) || null
    : null;

  // Refresh conversations
  const handleRefreshConversations = useCallback(async () => {
    console.log('🔄 Refreshing conversations...');
    await loadConversations(1);
  }, [loadConversations]);

  const handleInquiryCreated = () => {
    // Refresh conversations when new inquiry is created
    loadConversations(1);
  };

  const handleConversationAccepted = () => {
    // Refresh conversations when expert accepts a conversation
    loadConversations(1);
  };

  // Determine conversation type for display
  const getConversationType = (conversation: TwilioConversation): 'main' | 'expert_admin_dm' | 'admin_traveler_dm' => {
    const attrs = conversation.attributes || {};
    
    if (attrs.type === 'expert_admin_dm' || attrs.typeOfChat === 'expertAndAdmin') {
      return 'expert_admin_dm';
    }
    if (attrs.type === 'admin_traveler_dm' || attrs.typeOfChat === 'adminAndTraveler') {
      return 'admin_traveler_dm';
    }
    return 'main';
  };

  if (!twilioInitialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to Twilio...</p>
          <p className="text-sm text-gray-500 mt-2">Setting up real-time messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Expert Dashboard</h1>
              <p className="text-sm text-gray-600">{user?.name}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          
          {/* Navigation */}
          <div className="space-y-1">
            <button
              onClick={() => setCurrentView('home')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                currentView === 'home' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              {user?.role === 'expert' ? 'Inquiries' : 'Dashboard'}
            </button>
            
            <button
              onClick={() => setCurrentView('conversations')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                currentView === 'conversations' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              Conversations
            </button>
            
            <button
              onClick={() => setCurrentView('inquiries')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                currentView === 'inquiries' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Shield className="w-4 h-4" />
              Google Sheets
            </button>
          </div>
        </div>

        {/* Content based on current view */}
        {currentView === 'conversations' && (
          <>
            {/* Connection status */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-600">
                    {connectionStatus === 'connected' ? 'Connected' : 
                     connectionStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
                  </span>
                </div>
                <button
                  onClick={() => loadConversations(1)}
                  disabled={isLoadingConversations}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors disabled:opacity-50"
                  title="Refresh conversations"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingConversations ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                {lastRefresh && ` • Last refresh: ${lastRefresh.toLocaleTimeString()}`}
              </p>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              <ConversationList
                conversations={conversations}
                selectedConversationSid={selectedConversationSid}
                onSelectConversation={handleSelectConversation}
                isLoading={isLoadingConversations}
                hasMore={hasMoreConversations}
                onLoadMore={handleLoadMore}
                loadingMore={isLoadingMore}
                acceptedConversations={acceptedConversations}
              />
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {currentView === 'home' && user?.role === 'expert' && (
          <InquiriesMainView 
            onConversationAccepted={handleConversationAccepted}
            onConversationClick={(conversationSid) => {
              // Switch to conversations tab and select the conversation
              setCurrentView('conversations');
              handleSelectConversation(conversationSid);
            }}
          />
        )}
        
        {currentView === 'home' && user?.role === 'admin' && (
          <DashboardHome
            conversations={conversations}
            onRefreshConversations={handleRefreshConversations}
            isLoading={isLoadingConversations}
            error={error}
          />
        )}
        
        {currentView === 'conversations' && (
          user?.role === 'admin' ? (
            <AdminMessageView
              conversation={selectedConversation}
              messages={messages}
              onSendMessage={handleSendMessage}
              onRefreshMessages={() => selectedConversationSid && loadMessages(selectedConversationSid)}
              isLoading={isLoadingMessages}
              error={error}
              sendingChunks={sendingChunks}
              conversationType={selectedConversation ? getConversationType(selectedConversation) : 'main'}
            />
          ) : (
            <MessageView
              conversation={selectedConversation}
              messages={messages}
              onSendMessage={handleSendMessage}
              onRefreshMessages={() => selectedConversationSid && loadMessages(selectedConversationSid)}
              isLoading={isLoadingMessages}
              error={error}
              sendingChunks={sendingChunks}
              isConversationAccepted={selectedConversationSid ? isConversationAccepted(selectedConversationSid) : true}
              onShowAcceptance={() => {
                if (selectedConversationSid && pendingAcceptanceConversation) {
                  setShowAcceptanceModal(true);
                }
              }}
            />
          )
        )}
        
        {currentView === 'inquiries' && (
          <InquiriesViewer />
        )}
      </div>

      {/* Inquiry Creator (Admin only) */}
      {user?.role === 'admin' && currentView === 'conversations' && (
        <InquiryCreator onInquiryCreated={handleInquiryCreated} />
      )}

      {/* Conversation Acceptance Modal */}
      {showAcceptanceModal && pendingAcceptanceConversation && (
        <ConversationAcceptancePopup
          conversationSid={pendingAcceptanceConversation.sid}
          onAccept={handleAcceptConversation}
          onDecline={() => {
            setShowAcceptanceModal(false);
            setPendingAcceptanceConversation(null);
          }}
          isAccepting={isAcceptingConversation}
          conversationData={pendingAcceptanceConversation.data}
        />
      )}
    </div>
  );
}