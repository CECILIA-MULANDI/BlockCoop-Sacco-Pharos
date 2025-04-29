import React, { useState } from "react";
import { useWhitelistToken } from "../../hooks/useContractFunctions";
import { useMessages } from "../../hooks/useMessages";

export default function WhitelistTokenForm() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [priceFeed, setPriceFeed] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { whitelistToken } = useWhitelistToken();
  const { displaySuccessMessage, displayErrorMessage } = useMessages();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tokenAddress.startsWith("0x") || !priceFeed.startsWith("0x")) {
      displayErrorMessage("Please enter valid addresses");
      return;
    }

    try {
      setIsSubmitting(true);
      displayErrorMessage("Waiting for wallet signature...");

      // First wait for user to sign the transaction
      const tx = await whitelistToken(tokenAddress, priceFeed);
      displayErrorMessage("Please wait for transaction confirmation...");

      // Then wait for transaction to be confirmed
      await tx.wait();

      // Only show success after confirmation
      displaySuccessMessage("Token whitelisted successfully!");
      setTokenAddress("");
      setPriceFeed("");
    } catch (err) {
      displayErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg mb-8 shadow-md bg-gray-800">
      <h3 className="text-xl font-semibold mb-4 text-white">
        Whitelist New Token
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="tokenAddress"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Token Address
          </label>
          <input
            id="tokenAddress"
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="priceFeed"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Price Feed Address
          </label>
          <input
            id="priceFeed"
            type="text"
            value={priceFeed}
            onChange={(e) => setPriceFeed(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
        >
          {isSubmitting ? "Processing..." : "Whitelist Token"}
        </button>
      </form>
    </div>
  );
}
