import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractService } from '../services/contractService';

export default function WithdrawForm({ onSuccess, onSwitchTab }) {
  const [depositedTokens, setDepositedTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState('');
  const [userDeposits, setUserDeposits] = useState({});

  useEffect(() => {
    loadUserDeposits();
  }, []);

  const loadUserDeposits = async () => {
    try {
      setLoading(true);
      const address = await contractService.signer.getAddress();
      const tokens = await contractService.getUserDepositedTokens(address);
      
      const deposits = {};
      const tokenDetails = await Promise.all(
        tokens.map(async (tokenAddress) => {
          const deposit = await contractService.getUserDeposits(address, tokenAddress);
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function symbol() view returns (string)', 'function name() view returns (string)'],
            contractService.provider
          );
          
          const [symbol, name] = await Promise.all([
            tokenContract.symbol(),
            tokenContract.name()
          ]);
          
          deposits[tokenAddress] = {
            amount: ethers.utils.formatEther(deposit.amount),
            depositTimestamp: new Date(deposit.depositTimestamp.toNumber() * 1000)
          };
          
          return {
            address: tokenAddress,
            symbol,
            name,
            amount: deposits[tokenAddress].amount
          };
        })
      );
      
      setDepositedTokens(tokenDetails);
      setUserDeposits(deposits);
    } catch (error) {
      console.error('Error loading user deposits:', error);
      setError('Failed to load your deposits. Please try again.');
    } finally {
      setLoading(false);
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

      // Get token decimals
      const tokenContract = new ethers.Contract(
        selectedToken,
        ['function decimals() view returns (uint8)'],
        contractService.provider
      );
      const decimals = await tokenContract.decimals();
      console.log('Token decimals:', decimals);

      // Parse amount with proper decimals
      const parsedAmount = ethers.utils.parseUnits(amount, decimals);
      console.log('Parsed amount:', parsedAmount.toString());

      const deposit = userDeposits[selectedToken];
      if (!deposit) {
        throw new Error('No deposit found for this token');
      }
      
      // Convert deposit amount to same decimal precision for comparison
      const depositAmount = ethers.utils.parseUnits(deposit.amount, decimals);
      if (parsedAmount.gt(depositAmount)) {
        throw new Error(`Insufficient deposit. You only have ${deposit.amount} tokens deposited`);
      }

      // Make the withdrawal
      setStatus('Processing withdrawal...');
      const withdrawTx = await contractService.withdraw(selectedToken, parsedAmount);
      setStatus('Waiting for confirmation...');
      await withdrawTx.wait();

      setSuccess('Withdrawal successful!');
      setAmount('');
      setSelectedToken('');
      // Refresh deposits
      loadUserDeposits();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error making withdrawal:', error);
      setError(error.message || 'Failed to withdraw. Please try again.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">Withdraw Tokens</h3>

      {loading && depositedTokens.length === 0 && <p>Loading your deposits...</p>}
      
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

      {depositedTokens.length > 0 ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium mb-2">
              Select Token to Withdraw
            </label>
            <select
              id="token"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">-- Select a Token --</option>
              {depositedTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
          </div>

          {selectedToken && userDeposits[selectedToken] && (
            <div className="text-sm">
              <span className="text-gray-300">Deposited Amount: </span>
              <span className="font-medium">
                {parseFloat(userDeposits[selectedToken].amount).toFixed(4)} {depositedTokens.find(t => t.address === selectedToken)?.symbol}
              </span>
              <br />
              <span className="text-gray-300">Deposited on: </span>
              <span className="font-medium">
                {userDeposits[selectedToken].depositTimestamp.toLocaleDateString()}
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
              placeholder="Enter amount to withdraw"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !selectedToken || !amount}
            className={`w-full px-4 py-2 rounded-md text-white ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </form>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">No tokens available for withdrawal</p>
          <button
            onClick={() => onSwitchTab('deposit')}
            className="mt-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            Make your first deposit
          </button>
        </div>
      )}
    </div>
  );
}
