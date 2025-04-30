import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAddFundManager, useGetActiveFundManagers } from '../../hooks/useContractFunctions';
import { useRemoveFundManager } from '../../hooks/useRemoveFundManager';
import { useFundManagerAddedEvents, useFundManagerRemovedEvents } from '../../hooks/useContractEvents';
import { useMessages } from '../../hooks/useMessages';
import WhitelistTokenForm from '../../components/forms/WhitelistTokenForm';
import TokenInfoDisplay from '../../forms/displayTokens';
import Header from '../../layouts/Header';
import TokenDistributionForm from '../../components/forms/TokenDistributionForm';
import FundLendingPoolForm from '../../components/forms/FundLendingPoolForm';

export default function OwnerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [newManagerAddress, setNewManagerAddress] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    const path = location.pathname;
    if (path.includes('/tokens')) return 'tokens';
    if (path.includes('/displayTokens')) return 'displayTokens';
    if (path.includes('/tokenDistribution')) return 'tokenDistribution';
    if (path.includes('/fundPool')) return 'fundPool';
    return 'managers';
  });

  const { addManager, error: addManagerError, isLoading: addingManager } = useAddFundManager();
  const { removeManager, isLoading: removingManager } = useRemoveFundManager();
  const { data: fundManagers, isLoading } = useGetActiveFundManagers();
  const addedEventsObj = useFundManagerAddedEvents();
  const removedEventsObj = useFundManagerRemovedEvents();
  const { successMessage, displaySuccessMessage, clearSuccessMessage } = useMessages();

  const lastAddedEventHashRef = useRef('');
  const lastRemovedEventHashRef = useRef('');

  useEffect(() => {
    const events = addedEventsObj.events;
    if (events && events.length > 0) {
      const latestEvent = events[0];
      if (latestEvent.transactionHash !== lastAddedEventHashRef.current) {
        console.log('New manager added event:', latestEvent);
        lastAddedEventHashRef.current = latestEvent.transactionHash;
        displaySuccessMessage(
          `Fund manager ${latestEvent.args.fundManager} was successfully added!`
        );
      }
    }
  }, [addedEventsObj.events, displaySuccessMessage]);

  useEffect(() => {
    const events = removedEventsObj.events;
    if (events && events.length > 0) {
      const latestEvent = events[0];
      if (latestEvent.transactionHash !== lastRemovedEventHashRef.current) {
        console.log('Manager removed event:', latestEvent);
        lastRemovedEventHashRef.current = latestEvent.transactionHash;
        displaySuccessMessage(
          `Fund manager ${latestEvent.args.fundManager} was successfully removed!`
        );
      }
    }
  }, [removedEventsObj.events, displaySuccessMessage]);

  useEffect(() => {
    // Redirect to managers tab if no specific tab is selected
    if (location.pathname === '/owner-dashboard') {
      navigate('/owner-dashboard/managers');
    }
  }, [location.pathname, navigate]);

  const handleAddManager = () => {
    if (newManagerAddress?.startsWith('0x')) {
      addManager(newManagerAddress);
      if (!addManagerError) {
        setNewManagerAddress('');
      }
    } else {
      alert('Please enter a valid wallet address');
    }
  };

  const handleRemoveManager = (address) => {
    if (window.confirm(`Are you sure you want to remove fund manager ${address}?`)) {
      removeManager(address);
    }
  };

  const renderFundManagersList = () => {
    if (isLoading || fundManagers === undefined) {
      return <p>Loading fund managers...</p>;
    }

    if (fundManagers.length > 0) {
      return (
        <ul className="divide-y divide-gray-700">
          {fundManagers.map((address) => (
            <li
              key={address}
              className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
            >
              <span className="font-mono text-sm sm:text-base break-all text-white">
                {address}
              </span>
              <button
                onClick={() => handleRemoveManager(address)}
                disabled={removingManager}
                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base disabled:bg-red-300"
              >
                {removingManager ? 'Removing...' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      );
    }

    return <p>No fund managers found.</p>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-gray-900">
      <Header />
      
      {/* Success message toast notification */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-900/50 border border-green-500 text-green-200 p-4 rounded shadow-md flex items-center max-w-md">
          <div className="mr-3">
            <svg
              className="h-6 w-6 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="flex-1 text-sm sm:text-base">{successMessage}</div>
          <button
            onClick={clearSuccessMessage}
            className="ml-auto text-green-400 hover:text-green-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Owner Dashboard</h1>
          <p className="text-blue-200 text-sm sm:text-base">Manage your BlockCoop platform</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 sm:mb-8 overflow-x-auto">
          <div className="flex flex-nowrap sm:justify-center min-w-full border-b border-blue-700/30">
            <button
              onClick={() => setActiveTab('managers')}
              className={`py-3 sm:py-4 px-4 sm:px-8 text-base sm:text-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'managers'
                  ? 'text-white border-b-2 border-blue-400 bg-blue-900/20'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Manage Fund Managers
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`py-3 sm:py-4 px-4 sm:px-8 text-base sm:text-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'tokens'
                  ? 'text-white border-b-2 border-blue-400 bg-blue-900/20'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Whitelist Tokens
            </button>
            <button
              onClick={() => setActiveTab('displayTokens')}
              className={`py-3 sm:py-4 px-4 sm:px-8 text-base sm:text-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'displayTokens'
                  ? 'text-white border-b-2 border-blue-400 bg-blue-900/20'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Display Tokens
            </button>
            <button
              onClick={() => setActiveTab('tokenDistribution')}
              className={`py-3 sm:py-4 px-4 sm:px-8 text-base sm:text-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'tokenDistribution'
                  ? 'text-white border-b-2 border-blue-400 bg-blue-900/20'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Token Distribution
            </button>
            <button
              onClick={() => setActiveTab('fundPool')}
              className={`py-3 sm:py-4 px-4 sm:px-8 text-base sm:text-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'fundPool'
                  ? 'text-white border-b-2 border-blue-400 bg-blue-900/20'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Fund Pool
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full max-w-4xl mx-auto px-0 sm:px-4">
          {activeTab === 'managers' && (
            <div className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 rounded-lg sm:rounded-xl shadow-lg sm:shadow-xl p-4 sm:p-8 backdrop-blur-sm border border-blue-700/30">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">Manage Fund Managers</h2>
              {/* Add Fund Manager Section */}
              <div className="mb-8 p-4 border rounded-lg bg-gray-800 shadow-md">
                <h3 className="text-xl font-semibold mb-4 text-white">
                  Add Fund Manager
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newManagerAddress}
                    onChange={(e) => setNewManagerAddress(e.target.value)}
                    placeholder="Enter Wallet address (0x...)"
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 text-sm sm:text-base"
                  />
                  <button
                    onClick={handleAddManager}
                    disabled={addingManager}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 text-sm sm:text-base"
                  >
                    {addingManager ? 'Adding...' : 'Add Manager'}
                  </button>
                </div>

                {/* Error display */}
                {addManagerError && (
                  <div className="mt-2 p-2 bg-red-900/50 border border-red-500 text-red-200 rounded text-sm sm:text-base">
                    Error: {addManagerError}
                  </div>
                )}
              </div>

              {/* Fund Managers List */}
              <div className="p-4 border rounded-lg mb-8 shadow-md bg-gray-800">
                <h3 className="text-xl font-semibold mb-4 text-white">
                  Current Fund Managers
                </h3>
                {renderFundManagersList()}
              </div>
            </div>
          )}

          {activeTab === 'tokens' && (
            <div className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 rounded-lg sm:rounded-xl shadow-lg sm:shadow-xl p-4 sm:p-8 backdrop-blur-sm border border-blue-700/30">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">Whitelist Tokens</h2>
              <WhitelistTokenForm />
            </div>
          )}

          {activeTab === 'displayTokens' && (
            <div className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 rounded-lg sm:rounded-xl shadow-lg sm:shadow-xl p-4 sm:p-8 backdrop-blur-sm border border-blue-700/30">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">Display Tokens</h2>
              <TokenInfoDisplay />
            </div>
          )}

          {activeTab === 'tokenDistribution' && (
            <div className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 rounded-lg sm:rounded-xl shadow-lg sm:shadow-xl p-4 sm:p-8 backdrop-blur-sm border border-blue-700/30">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">Token Distribution</h2>
              <TokenDistributionForm />
            </div>
          )}

          {activeTab === 'fundPool' && (
            <div className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 rounded-lg sm:rounded-xl shadow-lg sm:shadow-xl p-4 sm:p-8 backdrop-blur-sm border border-blue-700/30">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">Fund Pool</h2>
              <FundLendingPoolForm />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
