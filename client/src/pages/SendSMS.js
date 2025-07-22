import React, { useState } from 'react';
import axios from 'axios';

const SendSMS = () => {
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' or 'csv'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    if (error) setError('');
  };

  const handleRecipientsChange = (e) => {
    setRecipients(e.target.value);
    if (error) setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setCsvFile(file);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let response;

      if (inputMethod === 'manual') {
        // Manual input
        if (!message.trim() || !recipients.trim()) {
          setError('Please provide both message and recipients');
          setLoading(false);
          return;
        }

        const recipientList = recipients
          .split(',')
          .map(phone => phone.trim())
          .filter(phone => phone.length > 0);

        if (recipientList.length === 0) {
          setError('Please provide at least one valid phone number');
          setLoading(false);
          return;
        }

        response = await axios.post('/api/sms/send', {
          message: message.trim(),
          recipients: recipientList
        });
      } else {
        // CSV upload
        if (!message.trim() || !csvFile) {
          setError('Please provide both message and CSV file');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('message', message.trim());
        formData.append('csvFile', csvFile);

        response = await axios.post('/api/sms/send-csv', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      if (response.data.success) {
        setResult(response.data.data);
        // Reset form
        setMessage('');
        setRecipients('');
        setCsvFile(null);
        // Reset file input
        const fileInput = document.getElementById('csvFile');
        if (fileInput) fileInput.value = '';
      } else {
        setError(response.data.message || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      setError(error.response?.data?.message || 'Failed to send SMS. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > 160;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900">Send Bulk SMS</h1>
        <p className="text-gray-600 mt-2">
          Compose and send SMS messages to multiple recipients at once.
        </p>
      </div>

      {/* Success Result */}
      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="alert-success">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-success-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-success-800">
                  SMS Sending {result.mock ? 'Simulated' : 'Completed'}
                </h3>
                <div className="mt-2 text-sm text-success-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Total Recipients: {result.totalRecipients}</li>
                    <li>Successful Sends: {result.successCount}</li>
                    <li>Failed Sends: {result.failCount}</li>
                    {result.csvProcessed && (
                      <>
                        <li>Original CSV entries: {result.originalCount}</li>
                        <li>Unique numbers processed: {result.uniqueCount}</li>
                      </>
                    )}
                    {result.mock && (
                      <li className="text-yellow-700">
                        ⚠️ This was a simulation. Configure Africa's Talking API for real SMS sending.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* SMS Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Message Input */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700">
              Message Content
            </label>
            <div className="mt-1">
              <textarea
                id="message"
                name="message"
                rows={4}
                className={`input-field resize-none ${isOverLimit ? 'border-danger-500' : ''}`}
                placeholder="Enter your message here..."
                value={message}
                onChange={handleMessageChange}
                required
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-gray-500">
                  SMS messages are limited to 160 characters
                </p>
                <p className={`text-sm ${isOverLimit ? 'text-danger-600' : 'text-gray-500'}`}>
                  {characterCount}/160
                </p>
              </div>
            </div>
          </div>

          {/* Input Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How would you like to add recipients?
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="inputMethod"
                  value="manual"
                  checked={inputMethod === 'manual'}
                  onChange={(e) => setInputMethod(e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Manual Entry</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="inputMethod"
                  value="csv"
                  checked={inputMethod === 'csv'}
                  onChange={(e) => setInputMethod(e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">CSV Upload</span>
              </label>
            </div>
          </div>

          {/* Recipients Input */}
          {inputMethod === 'manual' ? (
            <div>
              <label htmlFor="recipients" className="block text-sm font-medium text-gray-700">
                Phone Numbers
              </label>
              <div className="mt-1">
                <textarea
                  id="recipients"
                  name="recipients"
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Enter phone numbers separated by commas (e.g., +254712345678, +254723456789)"
                  value={recipients}
                  onChange={handleRecipientsChange}
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enter phone numbers separated by commas. Include country code (e.g., +254 for Kenya).
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="csvFile" className="block text-sm font-medium text-gray-700">
                CSV File
              </label>
              <div className="mt-1">
                <input
                  id="csvFile"
                  name="csvFile"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  required
                />
                <div className="mt-2 text-sm text-gray-500">
                  <p>Upload a CSV file with phone numbers. The CSV should have a column named:</p>
                  <ul className="list-disc list-inside mt-1 ml-4">
                    <li><code>phone</code>, <code>phoneNumber</code>, <code>phone_number</code>, or <code>number</code></li>
                  </ul>
                  <p className="mt-1">Maximum file size: 1MB</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || isOverLimit}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending SMS...
                </div>
              ) : (
                'Send SMS'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              SMS Sending Tips
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Messages are limited to 160 characters to ensure delivery</li>
                <li>Include country codes in phone numbers (e.g., +254 for Kenya)</li>
                <li>For CSV uploads, ensure your file has a column with phone numbers</li>
                <li>Duplicate phone numbers will be automatically removed</li>
                <li>Invalid phone numbers will be skipped during sending</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendSMS;
