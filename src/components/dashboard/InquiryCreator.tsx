import React, { useState, useEffect } from 'react';
import { Plus, Users, MessageCircle, AlertCircle, Phone } from 'lucide-react';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Expert {
  id: string;
  name: string;
  email: string;
}

interface InquiryCreatorProps {
  onInquiryCreated: () => void;
}

export function InquiryCreator({ onInquiryCreated }: InquiryCreatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    message: '',
    assignedExpertId: '',
  });

  // Load experts when component opens
  useEffect(() => {
    if (isOpen && token) {
      loadExperts();
    }
  }, [isOpen, token]);

  const loadExperts = async () => {
    try {
      setError(null);
      const response = await apiService.getExperts(token!);
      setExperts(response.data);
    } catch (err) {
      console.error('Failed to load experts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load experts');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.customerEmail || !formData.message || !formData.assignedExpertId) {
      setError('Name, email, message, and expert assignment are required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.customerEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Basic phone validation (if provided)
    if (formData.customerPhone) {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(formData.customerPhone)) {
        setError('Please enter a valid phone number (include country code for SMS)');
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiService.createInquiry({
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        message: formData.message,
        assignedExpertId: formData.assignedExpertId,
      }, token!);

      // Reset form
      setFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        message: '',
        assignedExpertId: '',
      });

      setIsOpen(false);
      onInquiryCreated();
    } catch (err) {
      console.error('Failed to create inquiry:', err);
      setError(err instanceof Error ? err.message : 'Failed to create inquiry');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Create new inquiry"
      >
        <Plus className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Create New Conversation</h2>
                <p className="text-sm text-gray-600">Connect customer with expert via Twilio</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name *
            </label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              value={formData.customerName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Email *
            </label>
            <input
              type="email"
              id="customerEmail"
              name="customerEmail"
              value={formData.customerEmail}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="customer@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Phone (Optional)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="tel"
                id="customerPhone"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleInputChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+1234567890"
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Include country code for SMS support (e.g., +1 for US)
            </p>
          </div>

          <div>
            <label htmlFor="assignedExpertId" className="block text-sm font-medium text-gray-700 mb-2">
              Assign to Expert *
            </label>
            <select
              id="assignedExpertId"
              name="assignedExpertId"
              value={formData.assignedExpertId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select an expert...</option>
              {experts.map(expert => (
                <option key={expert.id} value={expert.id}>
                  {expert.name} ({expert.email})
                </option>
              ))}
            </select>
            {experts.length === 0 && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <Users className="w-4 h-4" />
                No experts available
              </p>
            )}
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Initial Message *
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Customer's initial inquiry or message..."
              required
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">How this works:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Creates a Twilio conversation with the expert</li>
              <li>• If phone provided, enables SMS for the customer</li>
              <li>• Expert receives real-time notifications</li>
              <li>• All messages sync via Twilio webhooks</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Conversation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}