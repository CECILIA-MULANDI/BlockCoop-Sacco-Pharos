import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractService } from '../services/contractService';

export default function DepositForm({ onSuccess }) {
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenBalances, setTokenBalances] = useState({});
  const [status, setStatus] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('idle');

  useEffect(() => {
    loadWhitelistedTokens();
  }, []);

  // Reset approval status when token changes
  useEffect(() => {
    setApprovalStatus('idle');
  }, [selectedToken]);

  const loadWhitelistedTokens = async () => {
    try {
      const count = await contractService.getWhitelistedTokenCount();
      const tokenInfo = await contractService.getTokensInfo(0, count);
      const [addresses, names, symbols, decimals] = tokenInfo;
      
      const formattedTokens = addresses.map((address, index) => ({
        address,
        name: names[index] || 'Unknown',
        symbol: symbols[index] || '???',
        decimals: decimals[index]
      }));
      
      setTokens(formattedTokens);
      
      // Load balances for all tokens
      const balances = {};
      await Promise.all(
        formattedTokens.map(async (token) => {
          const tokenContract = new ethers.Contract(
            token.address,
            ['function balanceOf(address owner) view returns (uint256)'],
            contractService.provider
          );
          const balance = await tokenContract.balanceOf(contractService.address);
          balances[token.address] = ethers.utils.formatUnits(balance, token.decimals);
        })
      );
      setTokenBalances(balances);
    } catch (error) {
      console.error('Error loading tokens:', error);
      setError('Failed to load tokens. Please try again.');
    }
  };

  const handleApprove = async (tokenAddress, amount) => {
    try {
      setApprovalStatus('approving');
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        contractService.signer
      );

      const approveTx = await tokenContract.approve(contractService.contract.address, amount);
      await approveTx.wait();
      setApprovalStatus('approved');
      return true;
    } catch (error) {
      console.error('Error during token approval:', error);
      setApprovalStatus('failed');
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setStatus('');
    setLoading(true);

    try {
      if (!selectedToken || !amount) {
        throw new Error('Please select a token and enter an amount');
      }

      const parsedAmount = ethers.utils.parseEther(amount);
      const token = tokens.find(t => t.address === selectedToken);
      const tokenBalance = tokenBalances[selectedToken];
      
      if (parseFloat(amount) > parseFloat(tokenBalance)) {
        throw new Error(`Insufficient balance. You only have ${tokenBalance} ${token.symbol}`);
      }

      // First approve the contract to spend tokens
      setStatus('Approving token spend...');
      const approved = await handleApprove(selectedToken, parsedAmount);
      if (!approved) {
        throw new Error('Token approval failed');
      }

      // Then make the deposit
      setStatus('Making deposit...');
      const depositTx = await contractService.deposit(selectedToken, parsedAmount);
      setStatus('Waiting for deposit confirmation...');
      await depositTx.wait();

      setSuccess('Deposit successful!');
      setAmount('');
      setSelectedToken('');
      setApprovalStatus('idle');
      // Refresh token balances
      loadWhitelistedTokens();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error making deposit:', error);
      setError(error.message || 'Failed to make deposit. Please try again.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">Deposit Tokens</h3>

      {loading && tokens.length === 0 && <p>Loading tokens...</p>}
      {error && (
        <div className="p-4 mb-4 bg-red-900/50 text-red-200 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 mb-4 bg-green-900/50 text-green-200 rounded-lg">
          {success}
        </div>
      )}

      {status && (
        <div className="p-4 mb-4 bg-blue-900/50 text-blue-200 rounded-lg flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {status}
        </div>
      )}

      {tokens.length > 0 ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium mb-2">
              Select Token
            </label>
            <select
              id="token"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || approvalStatus === 'approving'}
            >
              <option value="">-- Select a Token --</option>
              {tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
          </div>

          {selectedToken && tokenBalances[selectedToken] && (
            <div className="text-sm">
              <span className="text-gray-300">Available Balance: </span>
              <span className="font-medium">
                {parseFloat(tokenBalances[selectedToken]).toFixed(4)} {tokens.find(t => t.address === selectedToken)?.symbol}
              </span>
            </div>
          )}

          <div>
            <label htmlFor="amount" className="block text-sm font-medium mb-2">
              Amount
            </label>
            <input
              type="number"
              step="any"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter amount to deposit"
              disabled={loading || approvalStatus === 'approving'}
            />
          </div>

          <button
            type="submit"
            disabled={loading || approvalStatus === 'approving' || !selectedToken || !amount}
            className={`w-full px-4 py-2 rounded-md text-white ${
              loading || approvalStatus === 'approving'
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading
              ? 'Processing...'
              : approvalStatus === 'approving'
              ? 'Approving...'
              : 'Deposit'}
          </button>
        </form>
      ) : (
        <p>No whitelisted tokens available for deposit.</p>
      )}
    </div>
  );
}
