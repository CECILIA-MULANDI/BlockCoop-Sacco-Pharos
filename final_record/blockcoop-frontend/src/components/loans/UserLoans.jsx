import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractService } from '../../services/contractService';

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
      const lendingTokenAddress = await contractService.getLendingToken();
      const lendingTokenContract = new ethers.Contract(
        lendingTokenAddress,
        ["function symbol() view returns (string)", "function decimals() view returns (uint8)"],
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
      const tokenAddress = await contractService.getLendingToken();
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const lendingTokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function balanceOf(address) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );

      // Get user's balance
      const userAddress = await signer.getAddress();
      const balance = await lendingTokenContract.balanceOf(userAddress);
      const amount = ethers.utils.parseEther(repayAmount[loanId]);
      
      if (balance.lt(amount)) {
        throw new Error("Insufficient lending token balance");
      }

      // Check allowance and approve if needed
      const allowance = await lendingTokenContract.allowance(
        userAddress,
        contractService.contract.address
      );

      if (allowance.lt(amount)) {
        console.log('Approving tokens...');
        const approveTx = await lendingTokenContract.approve(
          contractService.contract.address,
          amount
        );
        await approveTx.wait();
        console.log('Tokens approved');
      }

      // Repay the loan
      console.log('Repaying loan:', { loanId, amount: amount.toString() });
      const tx = await contractService.repayLoan(loanId, amount);
      await tx.wait();
      console.log('Loan repaid successfully');

      // Clear repay amount and refresh loans
      setRepayAmount(prev => ({ ...prev, [loanId]: '' }));
      await loadLoans();
      setError('');
    } catch (err) {
      console.error('Error repaying loan:', err);
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
