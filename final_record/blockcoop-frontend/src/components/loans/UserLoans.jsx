import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractService from '../../services/contractService';

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const INTEREST_RATE = 0.05; // 5% annual

export default function UserLoans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repayAmount, setRepayAmount] = useState({});
  const [processing, setProcessing] = useState({});

  const loadLoans = async () => {
    try {
      setLoading(true);
      const userAddress = await contractService.signer.getAddress();
      const loanCount = await contractService.contract.userLoanCount(userAddress);
      
      const loanPromises = [];
      for (let i = 0; i < loanCount.toNumber(); i++) {
        loanPromises.push(contractService.contract.userLoans(userAddress, i));
      }
      
      const loanResults = await Promise.all(loanPromises);
      
      // Get lending token info for display
      const lendingTokenContract = new ethers.Contract(
        "0xB1BF661cf9C19cb899400B0E62D8fc87AA3a22C6", 
        [
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)"
        ],
        contractService.provider
      );
      const [symbol, decimals] = await Promise.all([
        lendingTokenContract.symbol(),
        lendingTokenContract.decimals()
      ]);

      // Process each loan
      const processedLoans = await Promise.all(loanResults.map(async (loan, index) => {
        if (!loan.active) return null;

        // Get collateral token info
        const collateralContract = new ethers.Contract(
          loan.collateralToken,
          ["function symbol() view returns (string)", "function decimals() view returns (uint8)"],
          contractService.provider
        );
        const [collateralSymbol, collateralDecimals] = await Promise.all([
          collateralContract.symbol(),
          collateralContract.decimals()
        ]);

        // Calculate current interest
        const timeElapsed = Math.floor(Date.now() / 1000) - loan.startTimestamp.toNumber();
        const interest = loan.borrowedAmount.mul(ethers.BigNumber.from(INTEREST_RATE * 10000))
          .mul(ethers.BigNumber.from(timeElapsed))
          .div(ethers.BigNumber.from(10000 * SECONDS_PER_YEAR));
        
        const totalOwed = loan.borrowedAmount.add(interest);

        return {
          id: index,
          collateralToken: loan.collateralToken,
          collateralSymbol,
          collateralAmount: ethers.utils.formatUnits(loan.collateralAmount, collateralDecimals),
          borrowedAmount: ethers.utils.formatUnits(loan.borrowedAmount, decimals),
          accruedInterest: ethers.utils.formatUnits(interest, decimals),
          totalOwed: ethers.utils.formatUnits(totalOwed, decimals),
          startDate: new Date(loan.startTimestamp.toNumber() * 1000).toLocaleString(),
          lendingSymbol: symbol,
          active: loan.active
        };
      }));

      setLoans(processedLoans.filter(loan => loan !== null));
    } catch (err) {
      console.error('Error loading loans:', err);
      setError('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const handleRepay = async (loanId) => {
    if (!repayAmount[loanId]) return;
    
    try {
      setProcessing(prev => ({ ...prev, [loanId]: true }));
      setError('');

      // Get the lending token contract
      const lendingTokenContract = new ethers.Contract(
        "0xB1BF661cf9C19cb899400B0E62D8fc87AA3a22C6", 
        [
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)"
        ],
        contractService.signer
      );

      // Get user's address
      const userAddress = await contractService.signer.getAddress();

      // Fetch loan details to get total owed
      const contract = new ethers.Contract(
        contractService.contract.address, 
        [
          'function userLoans(address, uint256) view returns (address collateralToken, uint256 collateralAmount, uint256 borrowedAmount, uint256 accruedInterest, uint256 startTimestamp, bool active)',
          'function INTEREST_RATE() view returns (uint256)',
          'function SECONDS_PER_YEAR() view returns (uint256)'
        ], 
        contractService.provider
      );

      // Detailed logging for debugging
      console.log('Attempting to repay loan:', { 
        loanId, 
        repayAmount: repayAmount[loanId]
      });

      const loan = await contract.userLoans(userAddress, loanId);
      
      // Validate loan is active
      if (!loan.active) {
        throw new Error(`Loan ${loanId} is not active`);
      }

      const INTEREST_RATE = await contract.INTEREST_RATE();
      const SECONDS_PER_YEAR = await contract.SECONDS_PER_YEAR();

      const borrowedAmount = loan.borrowedAmount;
      const startTimestamp = loan.startTimestamp.toNumber();
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeElapsed = currentTimestamp - startTimestamp;

      const interest = (borrowedAmount.mul(INTEREST_RATE).mul(timeElapsed)).div(ethers.BigNumber.from(10000).mul(SECONDS_PER_YEAR));
      const totalOwed = borrowedAmount.add(interest);

      // Get token decimals
      const decimals = await lendingTokenContract.decimals();

      // Improved repayment amount calculation
      const repayAmountBN = ethers.utils.parseUnits(
        // Use string to avoid floating-point precision loss
        (Math.min(
          parseFloat(repayAmount[loanId] || '0'), 
          parseFloat(ethers.utils.formatUnits(totalOwed, decimals))
        )).toFixed(decimals), 
        decimals
      );

      // Always set full allowance before repayment
      const approveTx = await lendingTokenContract.approve(
        contractService.contract.address, 
        repayAmountBN
      );
      await approveTx.wait();
      console.log('Tokens approved:', repayAmountBN.toString());

      // Additional validation
      if (repayAmountBN.isZero()) {
        throw new Error('Repayment amount must be greater than zero');
      }

      // Ensure repayment doesn't exceed total owed
      if (repayAmountBN.gt(totalOwed)) {
        throw new Error(`Repayment amount exceeds total owed. Max repayable: ${ethers.utils.formatUnits(totalOwed, decimals)}`);
      }

      // Debug logging
      console.log('Repayment Details:', {
        loanId,
        repayAmount: repayAmount[loanId],
        repayAmountBN: repayAmountBN.toString(),
        loanDetails: loans.find(loan => loan.id === loanId)
      });

      // Repay the loan
      console.log('Submitting repayment transaction...');
      const tx = await contractService.repayLoan(loanId, repayAmountBN);
      await tx.wait();
      console.log('Loan repaid successfully');

      // Clear repay amount and refresh loans
      setRepayAmount(prev => ({ ...prev, [loanId]: '' }));
      await loadLoans();
      setError('');
    } catch (err) {
      console.error('Full Error Details:', {
        message: err.message,
        code: err.code,
        reason: err.reason,
        stack: err.stack,
        name: err.name,
        toString: err.toString ? err.toString() : 'No toString method'
      });
      setError(err.message || 'Failed to repay loan');
    } finally {
      setProcessing(prev => ({ ...prev, [loanId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg">
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-400">No active loans found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white mb-4">Your Active Loans</h2>
      
      {loans.map(loan => (
        <div key={loan.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-400">Loan ID</p>
              <p className="font-medium text-white">{loan.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Start Date</p>
              <p className="font-medium text-white">{loan.startDate}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Collateral</p>
              <p className="font-medium text-white">
                {loan.collateralAmount} {loan.collateralSymbol}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Borrowed Amount</p>
              <p className="font-medium text-white">
                {loan.borrowedAmount} {loan.lendingSymbol}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Accrued Interest</p>
              <p className="font-medium text-yellow-400">
                {loan.accruedInterest} {loan.lendingSymbol}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Owed</p>
              <p className="font-medium text-red-400">
                {loan.totalOwed} {loan.lendingSymbol}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <input
              type="number"
              value={repayAmount[loan.id] || ''}
              onChange={(e) => setRepayAmount(prev => ({ ...prev, [loan.id]: e.target.value }))}
              placeholder={`Amount to repay (max: ${loan.totalOwed})`}
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              disabled={processing[loan.id]}
            />
            <button
              onClick={() => handleRepay(loan.id)}
              disabled={!repayAmount[loan.id] || processing[loan.id]}
              className={`px-4 py-2 rounded-md font-medium ${
                !repayAmount[loan.id] || processing[loan.id]
                  ? 'bg-blue-500/50 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white transition-colors`}
            >
              {processing[loan.id] ? 'Processing...' : 'Repay'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
