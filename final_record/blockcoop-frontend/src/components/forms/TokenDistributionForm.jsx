import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { contractService } from "../../services/contractService";

export default function TokenDistributionForm() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedToken, setSelectedToken] = useState("");
  const [tokens, setTokens] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokens();
  }, []);

  useEffect(() => {
    if (selectedToken) {
      loadBalance(selectedToken);
    }
  }, [selectedToken]);

  const loadTokens = async () => {
    try {
      const whitelistedTokens = await contractService.getWhitelistedTokens();
      setTokens(whitelistedTokens);
      if (whitelistedTokens.length > 0) {
        setSelectedToken(whitelistedTokens[0].address);
      }
    } catch (error) {
      console.error("Error loading tokens:", error);
      setError("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async (tokenAddress) => {
    try {
      const ownerAddress = await contractService.signer.getAddress();
      const balance = await contractService.getTokenBalance(
        tokenAddress,
        ownerAddress
      );
      setBalances((prev) => ({
        ...prev,
        [tokenAddress]: balance,
      }));
    } catch (error) {
      console.error("Error loading balance:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recipientAddress.startsWith("0x")) {
      setError("Please enter a valid recipient address");
      return;
    }

    if (!selectedToken) {
      setError("Please select a token");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      // Create token contract instance
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        selectedToken,
        ["function transfer(address to, uint256 amount) returns (bool)"],
        signer
      );

      // Convert amount to wei (using token's decimals)
      const token = tokens.find((t) => t.address === selectedToken);
      const amountInWei = ethers.utils.parseUnits(amount, token.decimals);

      // Check if we have enough balance
      const currentBalance = balances[selectedToken]?.raw;
      if (currentBalance && amountInWei.gt(currentBalance)) {
        throw new Error("Insufficient balance for transfer");
      }

      // Send the transaction
      const tx = await tokenContract.transfer(recipientAddress, amountInWei);
      setSuccess("Transaction submitted. Waiting for confirmation...");

      // Wait for confirmation
      await tx.wait();
      setSuccess("Tokens distributed successfully!");

      // Refresh balance
      await loadBalance(selectedToken);

      // Clear form
      setRecipientAddress("");
      setAmount("");
    } catch (err) {
      console.error("Distribution error:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-white">Loading tokens...</div>;
  }

  return (
    <div className="p-4 border rounded-lg mb-8 shadow-md bg-gray-800">
      <h3 className="text-xl font-semibold mb-4 text-white">
        Distribute Tokens
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-500 text-green-200 rounded">
          {success}
        </div>
      )}

      <div className="mb-4 p-4 bg-gray-700 rounded-lg">
        <h4 className="text-lg font-medium text-white mb-2">
          Available Balances
        </h4>
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.address}
              className="flex justify-between items-center text-gray-300"
            >
              <span>{token.symbol}:</span>
              <span>
                {balances[token.address]
                  ? `${balances[token.address].formatted} ${
                      balances[token.address].symbol
                    }`
                  : "Loading..."}
              </span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="token"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Select Token
          </label>
          <select
            id="token"
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="recipientAddress"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Recipient Address
          </label>
          <input
            id="recipientAddress"
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Amount
          </label>
          <input
            id="amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.0"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
        >
          {isSubmitting ? "Processing..." : "Send Tokens"}
        </button>
      </form>
    </div>
  );
}
