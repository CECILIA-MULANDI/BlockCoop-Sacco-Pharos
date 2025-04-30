import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { contractService } from "../../services/contractService";

const FundLendingPoolForm = () => {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [lendingTokenContract, setLendingTokenContract] = useState(null);
  const [allowance, setAllowance] = useState("0");
  const [balance, setBalance] = useState("0");
  const [isOwner, setIsOwner] = useState(false);
  const [poolBalance, setPoolBalance] = useState("0");
  const [totalBorrowed, setTotalBorrowed] = useState("0");

  const updateTotalBorrowed = useCallback(async () => {
    try {
      if (!contractService.contract || !lendingTokenContract) return;

      let total = ethers.BigNumber.from(0);
      const userAddress = await contractService.signer.getAddress();
      const loanCount = await contractService.contract.userLoanCount(
        userAddress
      );

      for (let i = 0; i < loanCount.toNumber(); i++) {
        const loan = await contractService.contract.userLoans(userAddress, i);
        if (loan.active) {
          total = total.add(loan.borrowedAmount);
        }
      }

      const decimals = await lendingTokenContract.decimals();
      console.log("Total borrowed in wei:", total.toString());
      const formattedTotal = ethers.utils.formatUnits(total, decimals);
      console.log("Formatted total borrowed:", formattedTotal);
      setTotalBorrowed(formattedTotal);
    } catch (err) {
      console.error("Error getting total borrowed:", err);
    }
  }, [lendingTokenContract]);

  const updatePoolBalance = useCallback(async () => {
    try {
      if (!contractService.contract || !lendingTokenContract) {
        console.log("Contract or lending token not initialized");
        return;
      }
      const rawPoolBalance = await contractService.getLendingPoolBalance();
      const decimals = await lendingTokenContract.decimals();
      console.log("Raw pool balance:", rawPoolBalance.toString());
      const formattedPoolBalance = ethers.utils.formatUnits(
        rawPoolBalance,
        decimals
      );
      console.log("Formatted pool balance:", formattedPoolBalance);
      setPoolBalance(formattedPoolBalance);
    } catch (err) {
      console.error("Error getting pool balance:", err);
    }
  }, [lendingTokenContract]);

  const updateBalances = useCallback(async () => {
    try {
      if (!lendingTokenContract) {
        console.log("Lending token contract not initialized");
        return;
      }

      const userAddress = await contractService.signer.getAddress();

      // Update user balance
      const rawBalance = await lendingTokenContract.balanceOf(userAddress);
      const decimals = await lendingTokenContract.decimals();
      console.log("Raw balance:", rawBalance.toString());
      const formattedBalance = ethers.utils.formatUnits(rawBalance, decimals);
      console.log("Formatted balance:", formattedBalance);
      setBalance(formattedBalance);

      // Update allowance
      const rawAllowance = await lendingTokenContract.allowance(
        userAddress,
        contractService.contract.address
      );
      console.log("Raw allowance:", rawAllowance.toString());
      const formattedAllowance = ethers.utils.formatUnits(
        rawAllowance,
        decimals
      );
      console.log("Formatted allowance:", formattedAllowance);
      setAllowance(formattedAllowance);

      // Update pool balance and total borrowed
      await updatePoolBalance();
      await updateTotalBorrowed();
    } catch (err) {
      console.error("Error updating balances:", err);
    }
  }, [lendingTokenContract, updatePoolBalance, updateTotalBorrowed]);

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize contract service first
        if (!contractService.contract) {
          await contractService.init();
        }
        console.log("Contract service initialized");

        const tokenAddress = await contractService.getLendingToken();
        console.log("Lending token address:", tokenAddress);

        // Create contract instance for the lending token
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            "function balanceOf(address) view returns (uint256)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
          ],
          signer
        );
        setLendingTokenContract(tokenContract);

        // Check if user is owner
        const userAddress = await signer.getAddress();
        console.log("User address:", userAddress);
        const owner = await contractService.contract.owner();
        console.log("Contract owner:", owner);
        setIsOwner(userAddress.toLowerCase() === owner.toLowerCase());
        console.log(
          "Is user owner?",
          userAddress.toLowerCase() === owner.toLowerCase()
        );

        // Initialize all balances
        await updateBalances();
      } catch (err) {
        console.error("Error initializing:", err);
        setError("Failed to initialize form: " + err.message);
      }
    };
    init();

    // Set up event listeners
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", updateBalances);
      window.ethereum.on("chainChanged", updateBalances);

      // Clean up listeners
      return () => {
        window.ethereum.removeListener("accountsChanged", updateBalances);
        window.ethereum.removeListener("chainChanged", updateBalances);
      };
    }
  }, [updateBalances]);

  const handleApprove = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Make sure contract service is initialized
      if (!contractService.contract) {
        await contractService.init();
      }

      const decimals = await lendingTokenContract.decimals();
      const amountInWei = ethers.utils.parseUnits(amount, decimals);
      console.log("Approving amount in wei:", amountInWei.toString());

      const tx = await lendingTokenContract.approve(
        contractService.contract.address,
        amountInWei
      );
      console.log("Approval transaction:", tx.hash);
      await tx.wait();
      console.log("Approval confirmed");

      await updateBalances();
      setSuccess("Token approved successfully");
    } catch (err) {
      console.error("Approval error:", err);
      setError(err.message || "Failed to approve token");
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async () => {
    if (!isOwner) {
      setError("Only the contract owner can fund the lending pool");
      return;
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Make sure contract service is initialized
      if (!contractService.contract) {
        await contractService.init();
      }

      const decimals = await lendingTokenContract.decimals();
      const amountInWei = ethers.utils.parseUnits(amount, decimals);
      console.log("Funding amount in wei:", amountInWei.toString());

      // Check if we have sufficient allowance
      const userAddress = await contractService.signer.getAddress();
      const rawAllowance = await lendingTokenContract.allowance(
        userAddress,
        contractService.contract.address
      );
      console.log("Current allowance in wei:", rawAllowance.toString());
      if (rawAllowance.lt(amountInWei)) {
        setError("Please approve tokens first");
        return;
      }

      // Check if we have sufficient balance
      const rawBalance = await lendingTokenContract.balanceOf(userAddress);
      console.log("Current balance in wei:", rawBalance.toString());
      if (rawBalance.lt(amountInWei)) {
        setError("Insufficient balance");
        return;
      }

      console.log(
        "Attempting to fund pool with amount:",
        ethers.utils.formatUnits(amountInWei, decimals)
      );
      const tx = await contractService.fundLendingPool(amountInWei);
      console.log("Transaction hash:", tx.hash);
      await tx.wait();
      setSuccess("Lending pool funded successfully");
      setAmount("");

      await updateBalances();
    } catch (err) {
      console.error("Funding error:", err);
      setError(err.message || "Failed to fund lending pool");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-8">Fund Lending Pool</h2>

      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-800/40 to-blue-900/40 p-6 rounded-xl border border-blue-700/30 backdrop-blur-sm">
            <p className="text-blue-200 text-sm mb-2">Your Balance</p>
            <p className="text-2xl font-bold text-white">
              {parseFloat(balance).toFixed(6)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-800/40 to-blue-900/40 p-6 rounded-xl border border-blue-700/30 backdrop-blur-sm">
            <p className="text-blue-200 text-sm mb-2">Current Allowance</p>
            <p className="text-2xl font-bold text-white">
              {parseFloat(allowance).toFixed(6)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-800/40 to-blue-900/40 p-6 rounded-xl border border-blue-700/30 backdrop-blur-sm">
            <p className="text-blue-200 text-sm mb-2">Available to Fund</p>
            <p className="text-2xl font-bold text-white">
              {(parseFloat(balance) - parseFloat(allowance)).toFixed(6)}
            </p>
          </div>
        </div>

        {/* Pool Stats */}
        <div className="bg-gradient-to-br from-blue-800/30 to-blue-900/30 rounded-xl p-6 border border-blue-700/30 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-blue-300">Pool Balance</p>
              <p className="text-2xl font-bold text-white">
                {parseFloat(poolBalance).toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-red-300">Total Borrowed</p>
              <p className="text-2xl font-bold text-white">
                {parseFloat(totalBorrowed).toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-300">Available</p>
              <p className="text-2xl font-bold text-white">
                {(parseFloat(poolBalance) - parseFloat(totalBorrowed)).toFixed(
                  6
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="bg-gradient-to-br from-blue-800/30 to-blue-900/30 rounded-xl p-8 border border-blue-700/30 backdrop-blur-sm">
          <div className="mb-6">
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-blue-200 mb-2"
            >
              Amount to Fund
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-3 bg-blue-950/50 border border-blue-700/50 rounded-lg text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {!isOwner && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm">
                Note: Only the contract owner can fund the lending pool
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleApprove}
              disabled={loading || !amount || !isOwner}
              className={`flex-1 px-6 py-3 rounded-lg font-medium text-lg transition-all ${
                loading || !amount || !isOwner
                  ? "bg-white text-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {loading ? "Processing..." : "Approve"}
            </button>

            <button
              onClick={handleFund}
              disabled={
                loading || !amount || parseFloat(allowance) <= 0 || !isOwner
              }
              className={`flex-1 px-6 py-3 rounded-lg font-medium text-lg transition-all ${
                loading || !amount || parseFloat(allowance) <= 0 || !isOwner
                  ? "bg-white text-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {loading ? "Processing..." : "Fund Pool"}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <p className="text-green-300">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FundLendingPoolForm;
