import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import Header from '../../layouts/Header';
import { contractService } from '../../services/contractService';
import { ethers } from 'ethers';

export default function UserDashboard() {
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
    // Check if MetaMask is installed
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to use this application.');
      setLoading(false);
      return;
    }

    // Listen for account changes
    window.ethereum.on('accountsChanged', () => {
      setIsConnected(false);
      setUserTokens([]);
    });

    // Listen for chain changes
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
          const price = await contractService.contract.getTokenPrice(tokenAddress);
          
          return {
            address: tokenAddress,
            amount: ethers.utils.formatEther(deposit.amount),
            depositTimestamp: new Date(deposit.depositTimestamp.toNumber() * 1000).toLocaleString(),
            value: ethers.utils.formatEther(deposit.amount.mul(price)),
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

  const handleDeposit = async () => {
    try {
      const tokenAddress = prompt('Enter token address:');
      const amount = prompt('Enter amount to deposit:');
      
      if (tokenAddress && amount) {
        const parsedAmount = ethers.utils.parseEther(amount);
        await contractService.deposit(tokenAddress, parsedAmount);
        await loadUserTokens();
      }
    } catch (error) {
      console.error('Error depositing:', error);
      alert('Error making deposit. Please try again.');
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

  return (
    <div>
      <Header />
      
      {/* User navbar */}
      <div className="bg-blue-500 text-white shadow-lg mb-6">
        <div className="container mx-auto px-4">
          <div className="py-4">
            <h2 className="text-xl font-bold">User Dashboard</h2>
            <p className="text-white/80 text-sm">Welcome, User</p>
          </div>
        </div>
      </div>

      <DashboardLayout role="user">
        {error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : isConnecting ? (
          <div className="text-center">Connecting to MetaMask...</div>
        ) : isConnected ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-semibold text-gray-900">My Dashboard</h1>
              <button
                onClick={handleDeposit}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600"
              >
                Make New Deposit
              </button>
            </div>

            {/* User's Token Holdings */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">My Token Holdings</h2>
              
              {loading ? (
                <p>Loading your tokens...</p>
              ) : userTokens.length === 0 ? (
                <p>You haven't deposited any tokens yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Token
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Value (ETH)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deposit Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {userTokens.map((token) => (
                        <tr key={token.address}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {token.address}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {token.amount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {token.value}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {token.depositTimestamp}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => handleWithdraw(token.address)}
                              className="text-blue-500 hover:text-blue-600"
                            >
                              Withdraw
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={connectWallet}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600"
            >
              Connect to MetaMask
            </button>
          </div>
        )}
      </DashboardLayout>
    </div>
  );
}
