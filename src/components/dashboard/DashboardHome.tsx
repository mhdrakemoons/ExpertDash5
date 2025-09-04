import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Users, Shield, Phone, Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { twilioService } from '../../services/twilio';
import { apiService } from '../../services/api';
import type { TwilioConversation } from '../../types';

interface DashboardSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
}

interface DashboardHomeProps {
  conversations: TwilioConversation[];
  onRefreshConversations?: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function DashboardHome({ 
  conversations, 
  onRefreshConversations, 
  isLoading, 
  error 
}: DashboardHomeProps) {
  const { user, token } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('main');
  const [sectionData, setSectionData] = useState<{
    main: TwilioConversation[];
    dm_experts: any[];
    dm_travelers: any[];
  }>({
    main: [],
    dm_experts: [],
    dm_travelers: [],
  });
  const [loading, setLoading] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('unknown');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Define sections based on user role
  const expertSections: DashboardSection[] = [
    {
      id: 'main',
      title: 'Assigned Conversations',
      description: 'Customer inquiries assigned to you',
      icon: MessageCircle,
    },
    {
      id: 'dm_admins',
      title: 'DMs with Admins',
      description: 'Direct messages with administrators',
      icon: Shield,
    },
  ];

  const adminSections: DashboardSection[] = [
    {
      id: 'main',
      title: 'All Conversations',
      description: 'All customer inquiries and expert assignments',
      icon: MessageCircle,
    },
    {
      id: 'dm_experts',
      title: 'DMs with Experts',
      description: 'Direct messages with local experts',
      icon: Users,
    },
    {
      id: 'dm_travelers',
      title: 'DMs with Travelers',
      description: 'Direct private messages to travelers',
      icon: Phone,
    },
  ];

  const sections = user?.role === 'admin' ? adminSections : expertSections;
  const activeTab = sections.find(s => s.id === activeSection);

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

  // Manual refresh functionality
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh both section data and conversations
      await Promise.all([
        loadSectionData(),
        onRefreshConversations ? onRefreshConversations() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Force reconnect to Twilio and refresh data
      await twilioService.disconnect();
      if (token) {
        await twilioService.initialize(token);
      }
      await Promise.all([
        loadSectionData(),
        onRefreshConversations ? onRefreshConversations() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Failed to force refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get connection status display
  const getConnectionDisplay = () => {
    if (connectionStatus === 'connected') return { icon: Wifi, color: 'text-green-500', text: 'Connected' };
    if (connectionStatus === 'connecting') return { icon: WifiOff, color: 'text-yellow-500', text: 'Connecting' };
    return { icon: WifiOff, color: 'text-red-500', text: 'Disconnected' };
  };

  const connectionDisplay = getConnectionDisplay();
  const ConnectionIcon = connectionDisplay.icon;

  // Load data for current section
  const loadSectionData = async () => {
    if (!token || !activeSection) return;
    
    setLoading(true);
    setSectionError(null);
    try {
      switch (activeSection) {
        case 'main':
          // Main conversations are handled by parent component - no additional loading needed
          console.log('⚡ FAST MODE: Main conversations managed by parent component');
          break;
          
        case 'dm_experts':
          if (user?.role === 'admin') {
            const response = await apiService.getExpertAdminDMs(token);
            setSectionData(prev => ({ ...prev, dm_experts: response.conversations || [] }));
          }
          break;
          
        case 'dm_travelers':
          if (user?.role === 'admin') {
            const response = await apiService.getAdminTravelerDMs(token);
            setSectionData(prev => ({ ...prev, dm_travelers: response.conversations || [] }));
          }
          break;
          
        case 'dm_admins':
          if (user?.role === 'expert') {
            const response = await apiService.getExpertAdminDMs(token);
            setSectionData(prev => ({ ...prev, dm_experts: response.conversations || [] }));
          }
          break;
      }
    } catch (err) {
      console.error(`Failed to load ${activeSection} data:`, err);
      setSectionError(err instanceof Error ? err.message : `Failed to load ${activeSection} data`);
    } finally {
      setLoading(false);
    }
  };

  // Load section data when active section changes
  useEffect(() => {
    if (activeSection !== 'main') {
      loadSectionData();
    }
  }, [activeSection, token]);

  // Update main conversations from props
  useEffect(() => {
    if (activeSection === 'main') {
      setSectionData(prev => ({ ...prev, main: conversations }));
    }
  }, [conversations, activeSection]);

  const getActiveData = () => {
    switch (activeSection) {
      case 'main':
        return conversations;
      case 'dm_experts':
      case 'dm_admins':
        return sectionData.dm_experts;
      case 'dm_travelers':
        return sectionData.dm_travelers;
      default:
        return [];
    }
  };

  const activeData = getActiveData();

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              {activeTab?.icon && <activeTab.icon className="w-6 h-6 text-blue-600" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab?.title || 'Dashboard'}
              </h1>
              <p className="text-gray-600">{activeTab?.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionIcon className={`w-4 h-4 ${connectionDisplay.color}`} />
              <span className={`text-sm ${connectionDisplay.color}`}>
                {connectionDisplay.text}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || loading}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {connectionStatus === 'disconnected' && (
              <button
                onClick={handleForceRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Wifi className="w-4 h-4" />
                Reconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeSection === section.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{section.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {(error || sectionError) && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 text-sm">{error || sectionError}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span>Loading {activeTab?.title.toLowerCase()}...</span>
            </div>
          </div>
        ) : activeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            {activeTab?.icon && <activeTab.icon className="w-12 h-12 mb-4 text-gray-300" />}
            <h3 className="text-lg font-medium mb-2">No {activeTab?.title.toLowerCase()} found</h3>
            <p className="text-center mb-4">{activeTab?.description}</p>
            {activeSection === 'main' && (
              <div className="p-4 bg-blue-50 rounded-lg max-w-md">
                <h4 className="font-medium text-blue-900 mb-2">Getting Started:</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Conversations will appear as customers reach out</p>
                  <p>• External systems create conversations automatically</p>
                  <p>• Real-time updates keep everything in sync</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total {activeTab?.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{activeData.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <ConnectionIcon className={`w-5 h-5 ${connectionDisplay.color}`} />
                  <div>
                    <p className="text-sm text-gray-600">Connection Status</p>
                    <p className={`text-lg font-semibold ${connectionDisplay.color}`}>
                      {connectionDisplay.text}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {activeTab?.title} Overview
              </h3>
              
              {activeSection === 'main' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{conversations.length}</p>
                    <p className="text-sm text-gray-600">Total Conversations</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {conversations.filter(c => c.state === 'active').length}
                    </p>
                    <p className="text-sm text-gray-600">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {conversations.filter(c => c.participants?.length === 0).length}
                    </p>
                    <p className="text-sm text-gray-600">Loading Participants</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {conversations.filter(c => c.participants?.length > 0).length}
                    </p>
                    <p className="text-sm text-gray-600">Ready</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Recent {activeTab?.title}
                </h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {activeData.slice(0, 5).map((item, index) => (
                  <div key={item.sid || index} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {item.friendlyName || item.uniqueName || `Item ${index + 1}`}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {item.dateUpdated ? new Date(item.dateUpdated).toLocaleString() : 'Recently updated'}
                        </p>
                        {item.participants && (
                          <p className="text-xs text-gray-500 mt-1">
                            {item.participants.length > 0 
                              ? `${item.participants.length} participants`
                              : 'Loading participants...'
                            }
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.state === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.state || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {activeData.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <p>No {activeTab?.title.toLowerCase()} available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}