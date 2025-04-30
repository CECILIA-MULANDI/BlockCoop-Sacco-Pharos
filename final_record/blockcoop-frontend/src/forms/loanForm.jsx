import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { contractService } from '../services/contractService';

// Protocol parameters
const LTV_RATIO = 0.5; // 50%
const INTEREST_RATE = 0.05; // 5% annual
const LIQUIDATION_THRESHOLD = 0.75; // 75%

export default function LoanForm({ onSuccess, onSwitchTab }) {
  const [depositedTokens, setDepositedTokens] = useState([]);
  const [selectedCollateral, setSelectedCollateral] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState('');
  const [userDeposits, setUserDeposits] = useState({});
  const [maxBorrowAmount, setMaxBorrowAmount] = useState(null);
  const [loanDetails, setLoanDetails] = useState(null);
  const [lendingToken, setLendingToken] = useState({ address: '', symbol: '' });

  const calculatePossibleBorrow = useCallback(async () => {
    if (!collateralAmount || !selectedCollateral) return;

    try {
      const deposit = userDeposits[selectedCollateral];
      if (!deposit) return;

      const collateralValue = parseFloat(collateralAmount) * deposit.price;
      const possibleBorrow = collateralValue * LTV_RATIO;

      setMaxBorrowAmount(possibleBorrow);
    } catch (error) {
      console.error('Error calculating possible borrow:', error);
    }
  }, [collateralAmount, selectedCollateral, userDeposits]);

  useEffect(() => {
    loadUserDeposits();
  }, []);

  useEffect(() => {
    if (selectedCollateral && userDeposits[selectedCollateral]) {
      calculateMaxBorrow();
    } else {
      setMaxBorrowAmount(null);
    }
  }, [selectedCollateral, userDeposits]);

  useEffect(() => {
    if (collateralAmount && selectedCollateral) {
      calculatePossibleBorrow();
    }
  }, [collateralAmount, selectedCollateral, calculatePossibleBorrow]);

  useEffect(() => {
    if (borrowAmount && maxBorrowAmount) {
      calculateLoanDetails();
    } else {
      setLoanDetails(null);
    }
  }, [borrowAmount, maxBorrowAmount]);

  useEffect(() => {
    async function loadLendingToken() {
      try {
        const lendingTokenAddress = await contractService.getLendingToken();
        const tokenInfo = await contractService.getTokenBalance(lendingTokenAddress, await contractService.signer.getAddress());
        setLendingToken({ address: lendingTokenAddress, symbol: tokenInfo.symbol });
      } catch (error) {
        console.error('Error loading lending token:', error);
      }
    }
    loadLendingToken();
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
            ['function symbol() view returns (string)', 'function name() view returns (string)', 'function decimals() view returns (uint8)'],
            contractService.provider
          );
          
          const [symbol, name, decimals] = await Promise.all([
            tokenContract.symbol(),
            tokenContract.name(),
            tokenContract.decimals()
          ]);

          // Get token price for collateral value calculation
          const price = await contractService.getTokenPrice(tokenAddress);
          const amount = ethers.utils.formatUnits(deposit.amount, decimals);
          // Price comes in as a number, no need to format with ethers
          const valueInUSD = parseFloat(amount) * price;
          
          deposits[tokenAddress] = {
            amount,
            valueInUSD,
            decimals,
            price, // Store price for later use
            depositTimestamp: new Date(deposit.depositTimestamp.toNumber() * 1000)
          };
          
          return {
            address: tokenAddress,
            symbol,
            name,
            decimals,
            amount: deposits[tokenAddress].amount,
            valueInUSD
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

  const calculateMaxBorrow = () => {
    const deposit = userDeposits[selectedCollateral];
    if (!deposit) return;

    const maxBorrow = deposit.valueInUSD * LTV_RATIO;
    setMaxBorrowAmount(maxBorrow);
  };

  const calculateLoanDetails = () => {
    const amount = parseFloat(borrowAmount);
    if (isNaN(amount) || amount <= 0) return;

    const annualInterest = amount * INTEREST_RATE;
    const monthlyInterest = annualInterest / 12;
    const liquidationThreshold = maxBorrowAmount * (LIQUIDATION_THRESHOLD / LTV_RATIO);

    setLoanDetails({
      annualInterest,
      monthlyInterest,
      liquidationThreshold
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setStatus('');
    setLoading(true);

    try {
      if (!selectedCollateral || !collateralAmount || !borrowAmount) {
        throw new Error('Please select collateral and enter amounts');
      }

      const bAmount = parseFloat(borrowAmount);
      const cAmount = parseFloat(collateralAmount);
      if (isNaN(bAmount) || bAmount <= 0 || isNaN(cAmount) || cAmount <= 0) {
        throw new Error('Please enter valid amounts');
      }

      if (bAmount > maxBorrowAmount) {
        throw new Error(`Cannot borrow more than ${maxBorrowAmount.toFixed(2)} ${lendingToken.symbol}`);
      }

      const deposit = userDeposits[selectedCollateral];
      if (!deposit) {
        throw new Error('No deposit found for this token');
      }

      if (cAmount > parseFloat(deposit.amount)) {
        throw new Error(`Cannot use more collateral than deposited (${deposit.amount})`);
      }

      // Format amounts with proper decimals
      const collateralAmountWei = ethers.utils.parseUnits(collateralAmount, deposit.decimals);
      const borrowAmountWei = ethers.utils.parseEther(borrowAmount); // Lending token is 18 decimals

      console.log('Collateral amount:', ethers.utils.formatUnits(collateralAmountWei, deposit.decimals));
      console.log('Borrow amount:', ethers.utils.formatEther(borrowAmountWei));

      // Make the borrow transaction
      setStatus('Processing borrow request...');
      const borrowTx = await contractService.borrow(selectedCollateral, collateralAmountWei, borrowAmountWei);
      setStatus('Waiting for confirmation...');
      await borrowTx.wait();

      setSuccess('Loan successfully created!');
      setBorrowAmount('');
      setCollateralAmount('');
      setSelectedCollateral('');
      // Refresh deposits
      loadUserDeposits();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error making loan:', error);
      setError(error.message || 'Failed to create loan. Please try again.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">Borrow Against Collateral</h3>

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
            <label htmlFor="collateral" className="block text-sm font-medium mb-2">
              Select Collateral Token
            </label>
            <select
              id="collateral"
              value={selectedCollateral}
              onChange={(e) => setSelectedCollateral(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">-- Select Collateral --</option>
              {depositedTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - {parseFloat(token.amount).toFixed(4)} available
                </option>
              ))}
            </select>
          </div>

          {selectedCollateral && userDeposits[selectedCollateral] && (
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-300">Available Balance: </span>
                <span className="font-medium">
                  {parseFloat(userDeposits[selectedCollateral].amount).toFixed(4)} {depositedTokens.find(t => t.address === selectedCollateral)?.symbol}
                </span>
              </div>
              <div>
                <span className="text-gray-300">Value in USD: </span>
                <span className="font-medium">
                  ${userDeposits[selectedCollateral].valueInUSD.toFixed(2)} USD
                </span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="collateralAmount" className="block text-sm font-medium mb-2">
              Collateral Amount
            </label>
            <input
              type="number"
              step="any"
              id="collateralAmount"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter amount to use as collateral"
              disabled={loading}
            />
          </div>

          {maxBorrowAmount !== null && (
            <div className="text-sm">
              <span className="text-gray-300">Maximum Borrow Amount ({(LTV_RATIO * 100)}% LTV): </span>
              <span className="font-medium text-green-400">
                ${maxBorrowAmount.toFixed(2)} {lendingToken.symbol}
              </span>
            </div>
          )}

          <div>
            <label htmlFor="borrowAmount" className="block text-sm font-medium mb-2">
              Borrow Amount ({lendingToken.symbol})
            </label>
            <input
              type="number"
              step="any"
              id="borrowAmount"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Enter amount to borrow (max: ${maxBorrowAmount?.toFixed(2) || '0.00'} ${lendingToken.symbol})`}
              disabled={loading}
            />
          </div>

          {loanDetails && (
            <div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
              <h4 className="font-medium text-blue-300">Loan Details</h4>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-gray-300">Annual Interest ({INTEREST_RATE * 100}%): </span>
                  <span className="font-medium">${loanDetails.annualInterest.toFixed(2)} {lendingToken.symbol}</span>
                </div>
                <div>
                  <span className="text-gray-300">Monthly Interest: </span>
                  <span className="font-medium">${loanDetails.monthlyInterest.toFixed(2)} {lendingToken.symbol}</span>
                </div>
                <div>
                  <span className="text-gray-300">Liquidation Threshold: </span>
                  <span className="font-medium text-yellow-400">${loanDetails.liquidationThreshold.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedCollateral || !collateralAmount || !borrowAmount}
            className={`w-full px-4 py-2 rounded-md text-white ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : 'Create Loan'}
          </button>
        </form>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">No collateral available for borrowing</p>
          <button
            onClick={() => onSwitchTab('deposit')}
            className="mt-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            Deposit collateral first
          </button>
        </div>
      )}
    </div>
  );
}
