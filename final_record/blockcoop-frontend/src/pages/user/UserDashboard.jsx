import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import Header from '../../layouts/Header';
import { contractService } from '../../services/contractService';
import { ethers } from 'ethers';
import DepositForm from '../../forms/depositForm';
import WithdrawForm from '../../forms/withdrawForm';
import LoanForm from '../../forms/loanForm';

export default function UserDashboard() {
  const [activeTab, setActiveTab] = useState('deposit');
  const [userTokens, setUserTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const connectWallet = async () => {
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
  };

  useEffect(() => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to use this application.');
      setLoading(false);
      return;
    }

    window.ethereum.on('accountsChanged', () => {
      setIsConnected(false);
      setUserTokens([]);
    });

    window.ethereum.on('chainChanged', () => {
      setIsConnected(false);
      setUserTokens([]);
    });

    return () => {
      window.ethereum.removeListener('accountsChanged', () => {});
      window.ethereum.removeListener('chainChanged', () => {});
    };
  }, []);

  const loadUserTokens = async () => {
    try {
      const address = await contractService.signer.getAddress();
      const depositedTokens = await contractService.getUserDepositedTokens(address);
      
      const tokensWithDetails = await Promise.all(
        depositedTokens.map(async (tokenAddress) => {
          const deposit = await contractService.getUserDeposits(address, tokenAddress);
          const price = await contractService.getTokenPrice(tokenAddress);
          
          // Format amount from 18 decimals
          const amount = ethers.utils.formatEther(deposit.amount);
          // Price is already formatted from getTokenPrice
          const priceInUSD = Number(price);
          // Calculate USD value: amount * price
          const valueInUSD = Number(amount) * priceInUSD;
          
          console.log('Calculated values:', {
            amount: Number(amount),
            priceInUSD,
            valueInUSD
          });
          
          return {
            address: tokenAddress,
            amount,
            depositTimestamp: new Date(deposit.depositTimestamp.toNumber() * 1000).toLocaleString(),
            value: valueInUSD,
            pricePerToken: priceInUSD
          };
        })
      );
      
      setUserTokens(tokensWithDetails);
    } catch (error) {
      console.error('Error loading user tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (tokenAddress) => {
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
  };

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
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      {/* Main Navigation */}
      <div className="bg-gray-800 text-white shadow-lg mb-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap mt-2 border-b border-gray-700">
            {/* Deposit Tab */}
            <button
              className={`py-3 px-6 font-medium text-lg transition-colors duration-200 ${
                activeTab === 'deposit'
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('deposit')}
            >
              Deposit
            </button>

            {/* Withdraw Tab */}
            <button
              className={`py-3 px-6 font-medium text-lg transition-colors duration-200 ${
                activeTab === 'withdraw'
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('withdraw')}
            >
              Withdraw
            </button>

            {/* Loan Tab */}
            <button
              onClick={() => setActiveTab('loan')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'loan'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Loans
            </button>

            {/* User Info Tab */}
            <button
              className={`py-3 px-6 font-medium text-lg transition-colors duration-200 ${
                activeTab === 'userInfo'
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('userInfo')}
            >
              User Info
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 pb-8">
        {activeTab === 'deposit' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-semibold mb-6 text-gray-800">Deposit Tokens</h3>
            <DepositForm onSuccess={loadUserTokens} />
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-semibold mb-6 text-gray-800">Withdraw Tokens</h3>
            <WithdrawForm 
              onSuccess={loadUserTokens} 
              onSwitchTab={setActiveTab}
            />
          </div>
        )}

        {activeTab === 'loan' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-semibold mb-6 text-gray-800">Get a Loan</h3>
            <LoanForm 
              onSuccess={loadUserTokens} 
              onSwitchTab={setActiveTab}
            />
          </div>
        )}

        {activeTab === 'userInfo' && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {/* Header Section */}
              <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <h4 className="text-xl font-semibold mb-2">Account Overview</h4>
                <p className="text-sm opacity-90">
                  Connected as: <span className="font-mono">{contractService.address}</span>
                </p>
              </div>

              {/* Portfolio Value Section */}
              <div className="p-6 bg-gray-50">
                <div>
                  <p className="text-gray-600 text-sm uppercase tracking-wide">
                    Total Portfolio Value
                  </p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    ${loading 
                      ? '...' 
                      : userTokens.reduce((acc, token) => acc + Number(token.value), 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })
                    }{' '}
                    <span className="text-sm text-gray-500">USD</span>
                  </p>
                </div>
              </div>

              {/* Tokens Section */}
              <div className="p-6">
                <h5 className="text-lg font-semibold mb-4 text-gray-800">
                  Your Deposited Tokens
                </h5>
                {loading ? (
                  <div className="text-center py-4">Loading...</div>
                ) : userTokens.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {userTokens.map((token) => (
                      <div
                        key={token.address}
                        className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors duration-200 bg-white"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h6 className="font-semibold text-gray-800">
                            Token <span className="text-gray-500">({token.address.slice(0, 6)}...{token.address.slice(-4)})</span>
                          </h6>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Active
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700">
                            Amount: <span className="font-semibold">{Number(token.amount).toLocaleString(undefined, {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4
                            })}</span>
                          </p>
                          <p className="text-gray-700">
                            Price: <span className="font-semibold">${Number(token.pricePerToken).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })} USD</span>
                          </p>
                          <p className="text-gray-700">
                            Value:{' '}
                            <span className="font-semibold text-green-600">
                              ${Number(token.value).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })} USD
                            </span>
                          </p>
                          <p className="text-gray-600">
                            Deposited: {token.depositTimestamp}
                          </p>
                          <button
                            onClick={() => handleWithdraw(token.address)}
                            className="mt-2 w-full py-1 px-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          >
                            Withdraw
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 bg-gray-50 rounded-lg text-center">
                    <p className="text-gray-500">No tokens deposited yet</p>
                    <button
                      onClick={() => setActiveTab('deposit')}
                      className="mt-2 text-blue-500 hover:text-blue-600 text-sm font-medium"
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
  );
}
