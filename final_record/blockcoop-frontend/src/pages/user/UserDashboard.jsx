import React, { useState, useEffect, useCallback } from 'react';
import Header from '../../layouts/Header';
import { contractService } from '../../services/contractService';
import { ethers } from 'ethers';
import DepositForm from '../../forms/depositForm';
import WithdrawForm from '../../forms/withdrawForm';
import LoanForm from '../../forms/loanForm';
import UserLoans from '../../components/loans/UserLoans';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Something went wrong</h2>
            <p className="text-gray-600 mb-6">{this.state.error?.message || 'An error occurred while loading the dashboard'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function UserDashboard() {
  const [activeTab, setActiveTab] = useState('userInfo');
  const [userTokens, setUserTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const loadUserTokens = useCallback(async () => {
    try {
      const address = await contractService.signer.getAddress();
      const depositedTokens = await contractService.getUserDepositedTokens(address);
      
      const tokensWithDetails = await Promise.all(
        depositedTokens.map(async (tokenAddress) => {
          const deposit = await contractService.getUserDeposits(address, tokenAddress);
          const price = await contractService.getTokenPrice(tokenAddress);
          
          // Format amount from 18 decimals
          const amount = Number(ethers.utils.formatEther(deposit.amount));
          // Calculate USD value: amount * price
          const valueInUSD = amount * price;
          
          console.log('Final values:', {
            amount,
            priceInUSD: price,
            valueInUSD
          });
          
          return {
            address: tokenAddress,
            amount: amount.toFixed(4),
            depositTimestamp: new Date(deposit.depositTimestamp.toNumber() * 1000).toLocaleString(),
            value: valueInUSD.toFixed(2),
            pricePerToken: price.toFixed(2)
          };
        })
      );
      
      setUserTokens(tokensWithDetails);
    } catch (error) {
      console.error('Error loading user tokens:', error);
    } finally {
      setLoading(false);
    }
  }, [setUserTokens, setLoading]);

  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      await contractService.init();
      setIsConnected(true);
      loadUserTokens();
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  }, [loadUserTokens, setIsConnecting, setError, setIsConnected]);

  const handleWithdraw = useCallback(async (tokenAddress) => {
    try {
      const amount = prompt('Enter amount to withdraw:');
      if (amount) {
        const parsedAmount = ethers.utils.parseEther(amount);
        await contractService.withdraw(tokenAddress, parsedAmount);
        await loadUserTokens();
      }
    } catch (error) {
      console.error('Error withdrawing:', error);
      alert('Error making withdrawal. Please try again.');
    }
  }, [loadUserTokens]);

  useEffect(() => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to use this application.');
      setLoading(false);
      return;
    }

    // Auto-connect on component mount
    connectWallet();

    window.ethereum.on('accountsChanged', () => {
      setIsConnected(false);
      setUserTokens([]);
      // Reconnect when account changes
      connectWallet();
    });

    window.ethereum.on('chainChanged', () => {
      setIsConnected(false);
      setUserTokens([]);
      // Reconnect when chain changes
      connectWallet();
    });

    return () => {
      window.ethereum.removeListener('accountsChanged', () => {});
      window.ethereum.removeListener('chainChanged', () => {});
    };
  }, [connectWallet]);

  // If no wallet is connected, show connect wallet message
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to access the dashboard</p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
          {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-900 text-white">
        <Header />
        <div className="container mx-auto px-4 py-4 sm:py-8">
          <div className="mb-4 sm:mb-8 text-white overflow-x-auto">
            <div className="flex flex-nowrap sm:flex-wrap space-x-2 sm:space-x-4 border-b border-gray-700 whitespace-nowrap">
              <button
                onClick={() => setActiveTab('deposit')}
                className={`py-2 sm:py-3 px-4 sm:px-6 text-sm sm:text-lg font-medium text-white !important ${
                  activeTab === 'deposit'
                    ? 'border-b-2 border-white'
                    : 'border-b-2 border-transparent'
                }`}
                style={{ color: 'white' }}
              >
                Deposit
              </button>
              <button
                onClick={() => setActiveTab('withdraw')}
                className={`py-2 sm:py-3 px-4 sm:px-6 text-sm sm:text-lg font-medium text-white !important ${
                  activeTab === 'withdraw'
                    ? 'border-b-2 border-white'
                    : 'border-b-2 border-transparent'
                }`}
                style={{ color: 'white' }}
              >
                Withdraw
              </button>
              <button
                onClick={() => setActiveTab('borrow')}
                className={`py-2 sm:py-3 px-4 sm:px-6 text-sm sm:text-lg font-medium text-white !important ${
                  activeTab === 'borrow'
                    ? 'border-b-2 border-white'
                    : 'border-b-2 border-transparent'
                }`}
                style={{ color: 'white' }}
              >
                Borrow
              </button>
              <button
                onClick={() => setActiveTab('loans')}
                className={`py-2 sm:py-3 px-4 sm:px-6 text-sm sm:text-lg font-medium text-white !important ${
                  activeTab === 'loans'
                    ? 'border-b-2 border-white'
                    : 'border-b-2 border-transparent'
                }`}
                style={{ color: 'white' }}
              >
                My Loans
              </button>
              <button
                onClick={() => setActiveTab('userInfo')}
                className={`py-2 sm:py-3 px-4 sm:px-6 text-sm sm:text-lg font-medium text-white !important ${
                  activeTab === 'userInfo'
                    ? 'border-b-2 border-white'
                    : 'border-b-2 border-transparent'
                }`}
                style={{ color: 'white' }}
              >
                My Account
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="container mx-auto px-2 sm:px-4 pb-4 sm:pb-8">
            {activeTab === 'deposit' && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-gray-800">Deposit Tokens</h3>
                <DepositForm onSuccess={loadUserTokens} />
              </div>
            )}

            {activeTab === 'withdraw' && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-gray-800">Withdraw Tokens</h3>
                <WithdrawForm 
                  onSuccess={loadUserTokens} 
                  onSwitchTab={setActiveTab}
                />
              </div>
            )}

            {activeTab === 'borrow' && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-gray-800">Get a Loan</h3>
                <LoanForm 
                  onSuccess={loadUserTokens} 
                  onSwitchTab={setActiveTab}
                />
              </div>
            )}

            {activeTab === 'loans' && (
              <UserLoans />
            )}
            
            {activeTab === 'userInfo' && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {/* Header Section */}
                  <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                    <h4 className="text-lg sm:text-xl font-semibold mb-2">Account Overview</h4>
                    <p className="text-xs sm:text-sm opacity-90 break-all">
                      Connected as: <span className="font-mono">{contractService.address}</span>
                    </p>
                  </div>

                  {/* Portfolio Value Section */}
                  <div className="p-4 sm:p-6 bg-gray-50">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 uppercase tracking-wide">
                        Total Portfolio Value
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1">
                        ${loading 
                          ? '...' 
                          : userTokens.reduce((acc, token) => acc + Number(token.value), 0).toFixed(2)}{' '}
                        <span className="text-xs sm:text-sm text-gray-500">USD</span>
                      </p>
                    </div>
                  </div>

                  {/* Tokens Section */}
                  <div className="p-4 sm:p-6">
                    <h5 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800">
                      Your Deposited Tokens
                    </h5>
                    {loading ? (
                      <div className="text-center py-4">Loading...</div>
                    ) : userTokens.length > 0 ? (
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {userTokens.map((token) => (
                          <div
                            key={token.address}
                            className="p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors duration-200 bg-white"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h6 className="font-semibold text-sm sm:text-base text-gray-800">
                                Token <span className="text-xs sm:text-sm text-gray-500">({token.address.slice(0, 6)}...{token.address.slice(-4)})</span>
                              </h6>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                Active
                              </span>
                            </div>
                            <div className="space-y-1 text-xs sm:text-sm">
                              <p className="text-gray-700">
                                Amount: <span className="font-semibold">{token.amount}</span>
                              </p>
                              <p className="text-gray-700">
                                Price: <span className="font-semibold">${token.pricePerToken} USD</span>
                              </p>
                              <p className="text-gray-700">
                                Value:{' '}
                                <span className="font-semibold text-green-600">
                                  ${token.value} USD
                                </span>
                              </p>
                              <p className="text-gray-600 text-xs">
                                Deposited: {token.depositTimestamp}
                              </p>
                              <button
                                onClick={() => handleWithdraw(token.address)}
                                className="mt-2 w-full py-1 px-3 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                              >
                                Withdraw
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 sm:py-8 bg-gray-50 rounded-lg text-center">
                        <p className="text-gray-500 text-sm sm:text-base">No tokens deposited yet</p>
                        <button
                          onClick={() => setActiveTab('deposit')}
                          className="mt-2 text-blue-500 hover:text-blue-600 text-xs sm:text-sm font-medium"
                        >
                          Make your first deposit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
