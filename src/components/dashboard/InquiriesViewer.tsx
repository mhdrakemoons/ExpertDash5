import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, RefreshCw, Users, Calendar, Phone, Mail, MapPin, Clock, User, Star, MessageSquare, ExternalLink, Search, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { InquiryDetailModal } from './InquiryDetailModal';

interface InquiryRow {
  [key: string]: string;
}

interface InquiryDetail {
  key: string;
  label: string;
  value: string;
  icon?: React.ComponentType<any>;
  category: 'customer' | 'trip' | 'expert' | 'system' | 'follow-up';
}

export function InquiriesViewer() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryRow | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      loadInquiries();
    }
  }, [token]);

  const loadInquiries = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('📊 Loading inquiries from Google Sheets...');
      const data = await apiService.getGoogleSheetData('Inquiries', token!);
      
      if (data && data.length > 0) {
        const [headerRow, ...dataRows] = data;
        setHeaders(headerRow || []);
        
        // Convert rows to objects using headers as keys
        const inquiryObjects = dataRows.map(row => {
          const inquiry: InquiryRow = {};
          headerRow.forEach((header: string, index: number) => {
            inquiry[header] = row[index] || '';
          });
          return inquiry;
        });
        
        setInquiries(inquiryObjects);
        setLastRefresh(new Date());
        console.log(`✅ Loaded ${inquiryObjects.length} inquiries from Google Sheets`);
      } else {
        setInquiries([]);
        setHeaders([]);
        console.log('ℹ️ No data found in Google Sheets');
      }
    } catch (err) {
      console.error('❌ Failed to load inquiries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load inquiries from Google Sheets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    console.log('🔄 Manual refresh triggered for inquiries');
    await loadInquiries();
  };

  // Transform raw field names to user-friendly labels and categorize them
  const transformFieldToDetail = (key: string, value: string): InquiryDetail => {
    const fieldMappings: Record<string, { label: string; icon?: React.ComponentType<any>; category: 'customer' | 'trip' | 'expert' | 'system' | 'follow-up' }> = {
      'Full Name': { label: 'Full Name', icon: User, category: 'customer' },
      'First Name': { label: 'First Name', icon: User, category: 'customer' },
      'Email Address': { label: 'Email Address', icon: Mail, category: 'customer' },
      'Phone Number': { label: 'Phone Number', icon: Phone, category: 'customer' },
      'Destination': { label: 'Destination', icon: MapPin, category: 'trip' },
      'When they want to go': { label: 'Travel Date', icon: Calendar, category: 'trip' },
      'Days Staying': { label: 'Duration', icon: Clock, category: 'trip' },
      'Group Amount': { label: 'Group Size', icon: Users, category: 'trip' },
      'Group Ages': { label: 'Group Ages', icon: Users, category: 'trip' },
      'User Stay Pref': { label: 'Accommodation Preference', icon: Star, category: 'trip' },
      'User Budget': { label: 'Budget', icon: Star, category: 'trip' },
      'User Preferences / Vibe': { label: 'Travel Preferences', icon: Star, category: 'trip' },
      'Extra Note for Local Expert': { label: 'Expert Notes', icon: MessageSquare, category: 'trip' },
      'Local Expert': { label: 'Assigned Expert', icon: User, category: 'expert' },
      'Local Expert - Phone Number': { label: 'Expert Phone', icon: Phone, category: 'expert' },
      'Local Expert - Email Address': { label: 'Expert Email', icon: Mail, category: 'expert' },
      'Local Expert Preferred Contact Method': { label: 'Expert Contact Method', icon: MessageSquare, category: 'expert' },
      'Type (finished / in-flow)': { label: 'Status', icon: FileText, category: 'system' },
      'Stage': { label: 'Stage', icon: FileText, category: 'system' },
      'Last Response': { label: 'Last Response', icon: Clock, category: 'system' },
      'Last Local Expert Response': { label: 'Last Expert Response', icon: Clock, category: 'system' },
      'Whole Conversation': { label: 'Conversation History', icon: MessageSquare, category: 'system' },
      'Proposal Code / URL': { label: 'Proposal', icon: ExternalLink, category: 'system' },
      'Contact Method': { label: 'Contact Method', icon: MessageSquare, category: 'system' },
      'ConversationSid': { label: 'Twilio Conversation ID', icon: MessageSquare, category: 'system' },
      'Trip Finished Date': { label: 'Trip Completed', icon: Calendar, category: 'system' },
      'Feedback Received': { label: 'Feedback Status', icon: Star, category: 'system' },
    };

    const mapping = fieldMappings[key] || { label: key, category: 'system' };
    
    return {
      key,
      label: mapping.label,
      value: value || 'Not specified',
      icon: mapping.icon,
      category: mapping.category
    };
  };

  // Filter inquiries based on search and status
  const filteredInquiries = inquiries.filter(inquiry => {
    const matchesSearch = searchTerm === '' || 
      Object.values(inquiry).some(value => 
        value.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesStatus = statusFilter === 'all' || 
      inquiry['Type (finished / in-flow)']?.toLowerCase().includes(statusFilter.toLowerCase()) ||
      inquiry['Stage']?.toLowerCase().includes(statusFilter.toLowerCase());
    
    return matchesSearch && matchesStatus;
  });

  // Get unique statuses for filter dropdown
  const uniqueStatuses = Array.from(new Set([
    ...inquiries.map(inquiry => inquiry['Type (finished / in-flow)']),
    ...inquiries.map(inquiry => inquiry['Stage'])
  ].filter(Boolean)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Loading inquiries from Google Sheets...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to Load Inquiries</h3>
        <p className="text-sm text-center mb-4 max-w-md">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Google Sheets Inquiries</h2>
              <p className="text-sm text-gray-600">
                {filteredInquiries.length} of {inquiries.length} inquiries
                {lastRefresh && (
                  <span className="ml-2">• Last updated: {lastRefresh.toLocaleTimeString()}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Refresh from Google Sheets"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search inquiries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
        />
      )}

      {inquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FileText className="w-12 h-12 mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No Inquiries Found</h3>
          <p className="text-sm text-center mb-4">
            The "Inquiries" sheet appears to be empty or could not be accessed.
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      ) : (
        /* List View - Always Visible */
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3">
            {filteredInquiries.map((inquiry, index) => (
              <button
                key={index}
                onClick={() => setSelectedInquiry(inquiry)}
                className="w-full p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">
                        {inquiry['Full Name'] || inquiry['First Name'] || `Inquiry #${index + 1}`}
                      </h3>
                      {inquiry['Type (finished / in-flow)'] && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          inquiry['Type (finished / in-flow)'].toLowerCase().includes('finished') 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {inquiry['Type (finished / in-flow)']}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      {inquiry['Destination'] && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{inquiry['Destination']}</span>
                        </div>
                      )}
                      {inquiry['When they want to go'] && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{inquiry['When they want to go']}</span>
                        </div>
                      )}
                      {inquiry['Local Expert'] && (
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{inquiry['Local Expert']}</span>
                        </div>
                      )}
                    </div>
                    {inquiry['User Preferences / Vibe'] && (
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {inquiry['User Preferences / Vibe'].length > 100
                          ? `${inquiry['User Preferences / Vibe'].substring(0, 100)}...`
                          : inquiry['User Preferences / Vibe']
                        }
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>Click to view details</div>
                    {inquiry['ConversationSid'] && (
                      <div className="mt-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>Twilio</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}