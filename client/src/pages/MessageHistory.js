import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const MessageHistory = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    hasMore: true
  });

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async (offset = 0) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/sms/messages?limit=${pagination.limit}&offset=${offset}`);
      
      if (response.data.success) {
        const newMessages = response.data.data.messages;
        
        if (offset === 0) {
          setMessages(newMessages);
        } else {
          setMessages(prev => [...prev, ...newMessages]);
        }
        
        setPagination(prev => ({
          ...prev,
          offset: offset,
          hasMore: newMessages.length === prev.limit
        }));
      } else {
        setError(response.data.message || 'Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to fetch messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const newOffset = pagination.offset + pagination.limit;
    fetchMessages(newOffset);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (successful, failed) => {
    if (failed === 0) return 'bg-success-100 text-success-800';
    if (successful === 0) return 'bg-danger-100 text-danger-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = (successful, failed, total) => {
    if (failed === 0) return 'All sent';
    if (successful === 0) return 'All failed';
    return `${successful}/${total} sent`;
  };

  const getSuccessRate = (successful, total) => {
    if (total === 0) return 0;
    return Math.round((successful / total) * 100);
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Message History</h1>
            <p className="text-gray-600 mt-2">
              View all your sent SMS messages and their delivery status.
            </p>
          </div>
          <Link
            to="/send-sms"
            className="btn-primary"
          >
            Send New SMS
          </Link>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert-error">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-danger-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="bg-white rounded-lg shadow-md">
        {messages.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by sending your first SMS message.</p>
            <div className="mt-6">
              <Link
                to="/send-sms"
                className="btn-primary"
              >
                Send SMS
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                All Messages ({messages.length})
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {messages.map((message) => (
                <div key={message.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {message.message_content}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(message.successful_sends, message.failed_sends)}`}>
                          {getStatusText(message.successful_sends, message.failed_sends, message.total_recipients)}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>{message.total_recipients} recipients</span>
                        </div>
                        
                        <div className="flex items-center">
                          <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatDate(message.created_at)}</span>
                        </div>
                        
                        <div className="flex items-center">
                          <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span>{getSuccessRate(message.successful_sends, message.total_recipients)}% success rate</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/messages/${message.id}`}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {pagination.hasMore && (
              <div className="px-6 py-4 border-t border-gray-200">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading more...
                    </div>
                  ) : (
                    'Load More Messages'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary Stats */}
      {messages.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {messages.length}
              </div>
              <div className="text-sm text-gray-600">Total Messages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {messages.reduce((sum, msg) => sum + msg.total_recipients, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Recipients</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success-600">
                {messages.reduce((sum, msg) => sum + msg.successful_sends, 0)}
              </div>
              <div className="text-sm text-gray-600">Successful Sends</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-danger-600">
                {messages.reduce((sum, msg) => sum + msg.failed_sends, 0)}
              </div>
              <div className="text-sm text-gray-600">Failed Sends</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageHistory;
