import React, { useState, useEffect } from 'react';
import { contractService } from '../services/contractService';

export default function TokenInfoDisplay() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(null);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setError(null);
      // Get all whitelisted tokens with their complete info
      const whitelistedTokens = await contractService.getWhitelistedTokens();
      setTokens({ 
        tokens: whitelistedTokens.map(t => t.address),
        names: whitelistedTokens.map(t => t.name),
        symbols: whitelistedTokens.map(t => t.symbol),
        prices: whitelistedTokens.map(t => t.price),
        priceFeeds: whitelistedTokens.map(t => t.priceFeed)
      });
    } catch (error) {
      console.error('Error loading tokens:', error);
      setError('Failed to load tokens. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (tokenAddress, newPriceFeed) => {
    try {
      setUpdateLoading(tokenAddress);
      setError(null);
      const tx = await contractService.updatePriceFeed(tokenAddress, newPriceFeed);
      if (!tx) {
        throw new Error('Transaction failed');
      }
      await tx.wait(); // Wait for confirmation
      await loadTokens(); // Reload tokens after update
      setError(null);
    } catch (error) {
      console.error('Error updating price feed:', error);
      setError(`Failed to update price feed: ${error.message}`);
    } finally {
      setUpdateLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Token Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price Feed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Price (USD)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tokens.tokens && tokens.tokens.map((tokenAddress, index) => (
              <tr key={tokenAddress}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {tokens.names[index] || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {tokens.symbols[index] || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="truncate max-w-xs" title={tokenAddress}>
                      {tokenAddress}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="truncate max-w-xs" title={tokens.priceFeeds?.[index]}>
                      {tokens.priceFeeds?.[index] || 'Not set'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${tokens.prices && tokens.prices[index] ? parseFloat(tokens.prices[index].toString()) / 1e18 : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => {
                      const newPriceFeed = prompt('Enter new price feed address:');
                      if (newPriceFeed) {
                        handleUpdatePrice(tokenAddress, newPriceFeed);
                      }
                    }}
                    disabled={updateLoading === tokenAddress}
                    className={`text-blue-600 hover:text-blue-900 disabled:text-blue-300 disabled:cursor-not-allowed`}
                  >
                    {updateLoading === tokenAddress ? 'Updating...' : 'Update Price Feed'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
