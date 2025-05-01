import { ethers } from "ethers";
import contractABI from "../utils/abi.json";

// Get these from your deployed contract
const CONTRACT_ADDRESS = "0x5aCe9a0B4b8EE9255d5F2266bE3a9780ebE28a49";
const CHAIN_ID = "0xC352"; // 50002 in hex

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.address = CONTRACT_ADDRESS;
  }

  async init() {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      // Check if we're on the right network
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CHAIN_ID }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: CHAIN_ID,
                    chainName: "Pharos Network",
                    nativeCurrency: {
                      name: "ETH",
                      symbol: "ETH",
                      decimals: 18,
                    },
                    rpcUrls: ["https://devnet.dplabs-internal.com"],
                  },
                ],
              });
            } catch (addError) {
              throw new Error(`Failed to add Pharos Network: ${addError.message}`);
            }
          } else {
            throw new Error(`Failed to switch to Pharos Network: ${switchError.message}`);
          }
        }
      }

      try {
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        this.signer = this.provider.getSigner();
        this.contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          contractABI,
          this.signer
        );
        this.address = await this.signer.getAddress();
      } catch (error) {
        throw new Error(`Failed to initialize contract: ${error.message}`);
      }
    } catch (error) {
      console.error("Contract initialization error:", error);
      throw error;
    }
  }

  // === Management Functions ===
  async addFundManager(managerAddress) {
    if (!this.contract) await this.init();
    const tx = await this.contract.addFundManager(managerAddress);
    await tx.wait();
  }

  async removeFundManager(managerAddress) {
    if (!this.contract) await this.init();
    const tx = await this.contract.removeFundManager(managerAddress);
    await tx.wait();
  }

  async updateStalePriceThreshold(newThreshold) {
    if (!this.contract) await this.init();
    const tx = await this.contract.updateStalePriceThreshold(newThreshold);
    await tx.wait();
  }

  async pause() {
    if (!this.contract) await this.init();
    const tx = await this.contract.pause();
    await tx.wait();
  }

  async unpause() {
    if (!this.contract) await this.init();
    const tx = await this.contract.unpause();
    await tx.wait();
  }

  async whitelistToken(tokenAddress, priceFeed) {
    if (!this.contract) await this.init();
    try {
      // First check if the user has the right role
      const role = await this.checkRole();
      if (role !== "owner" && role !== "fundManager") {
        throw new Error(
          "Unauthorized: Only owner or fund manager can whitelist tokens"
        );
      }

      // Check if token is already whitelisted
      const tokenInfo = await this.contract.whiteListedTokens(tokenAddress);
      if (tokenInfo.isWhitelisted) {
        throw new Error("Token is already whitelisted");
      }

      // Add gas limit to avoid estimation errors
      const tx = await this.contract.whitelistToken(tokenAddress, priceFeed, {
        gasLimit: 500000, // Explicit gas limit
      });
      return tx;
    } catch (error) {
      // Improve error messages
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was rejected by user");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds to execute transaction");
      } else {
        console.error("Whitelist error:", error);
        throw new Error(`Failed to whitelist token: ${error.message}`);
      }
    }
  }

  async updatePriceFeed(tokenAddress, newPriceFeed) {
    if (!this.contract) await this.init();
    try {
      // First check if the user has the right role
      const role = await this.checkRole();
      if (role !== "owner" && role !== "fundManager") {
        throw new Error(
          "Unauthorized: Only owner or fund manager can update price feed"
        );
      }

      // Check if token exists
      const tokenInfo = await this.contract.whiteListedTokens(tokenAddress);
      if (!tokenInfo.isWhitelisted) {
        throw new Error("Token is not whitelisted");
      }

      // Add gas limit to avoid estimation errors
      const tx = await this.contract.updatePriceFeed(
        tokenAddress,
        newPriceFeed,
        {
          gasLimit: 500000, // Explicit gas limit
        }
      );
      return tx;
    } catch (error) {
      // Improve error messages
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was rejected by user");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds to execute transaction");
      } else {
        console.error("Update price feed error:", error);
        throw new Error(`Failed to update price feed: ${error.message}`);
      }
    }
  }

  async unWhitelistToken(tokenAddress) {
    if (!this.contract) await this.init();
    const tx = await this.contract.unWhitelistToken(tokenAddress);
    await tx.wait();
  }

  // === User Functions ===
  async deposit(tokenAddress, amount) {
    if (!this.contract) await this.init();
    try {
      // First check if token is whitelisted
      const tokenInfo = await this.contract.whiteListedTokens(tokenAddress);
      if (!tokenInfo.isWhitelisted) {
        throw new Error("Token is not whitelisted");
      }

      // Check token balance and allowance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
        ],
        this.signer
      );

      const balance = await tokenContract.balanceOf(this.address);
      if (balance.lt(amount)) {
        throw new Error("Insufficient token balance");
      }

      // Check allowance
      const allowance = await tokenContract.allowance(
        this.address,
        this.contract.address
      );
      if (allowance.lt(amount)) {
        // If allowance is insufficient, request approval
        const approveTx = await tokenContract.approve(
          this.contract.address,
          amount
        );
        await approveTx.wait();
      }

      // Make the deposit with explicit gas limit
      const tx = await this.contract.deposit(tokenAddress, amount, {
        gasLimit: 500000, // Explicit gas limit to avoid estimation errors
      });
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Deposit error:", error);
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was rejected by user");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds for gas");
      } else {
        throw new Error(`Deposit failed: ${error.message}`);
      }
    }
  }

  async withdraw(tokenAddress, amount) {
    if (!this.contract) await this.init();
    try {
      // First check if token is whitelisted
      const tokenInfo = await this.contract.whiteListedTokens(tokenAddress);
      if (!tokenInfo.isWhitelisted) {
        throw new Error("Token is not whitelisted");
      }

      // Check user's available balance
      const userDeposit = await this.contract.userDeposits(
        this.address,
        tokenAddress
      );
      console.log("User deposit amount:", userDeposit.amount.toString());
      console.log("Attempting to withdraw:", amount.toString());

      // Add gas limit to avoid estimation errors
      const tx = await this.contract.withdraw(tokenAddress, amount, {
        gasLimit: 500000, // Explicit gas limit
      });
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Withdraw error:", error);
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was rejected by user");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds for gas");
      } else if (error.message.includes("insufficient balance")) {
        throw new Error("Insufficient balance to withdraw");
      } else {
        throw new Error(`Withdrawal failed: ${error.message}`);
      }
    }
  }

  async borrow(collateralToken, collateralAmount, borrowAmount) {
    if (!this.contract) await this.init();
    try {
      // First check if token is whitelisted
      const tokenInfo = await this.contract.whiteListedTokens(collateralToken);
      if (!tokenInfo.isWhitelisted) {
        throw new Error("Token is not whitelisted");
      }

      // Check user's available balance
      const userDeposit = await this.contract.userDeposits(
        this.address,
        collateralToken
      );
      console.log("User deposit amount:", userDeposit.amount.toString());
      console.log(
        "Attempting to borrow with collateral:",
        collateralAmount.toString()
      );
      console.log("Borrow amount:", borrowAmount.toString());

      // Add gas limit to avoid estimation errors
      const tx = await this.contract.borrow(
        collateralToken,
        collateralAmount,
        borrowAmount,
        {
          gasLimit: 500000, // Explicit gas limit
        }
      );
      await tx.wait();
      return tx;
    } catch (error) {
      console.error("Borrow error:", error);
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was rejected by user");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds for gas");
      } else if (error.message.includes("insufficient balance")) {
        throw new Error("Insufficient collateral balance");
      } else if (error.message.includes("insufficient lending pool")) {
        throw new Error("Insufficient lending pool balance");
      } else {
        throw new Error(`Borrow failed: ${error.message}`);
      }
    }
  }

  async repay(loanId, repayAmount) {
    if (!this.contract) await this.init();
    const tx = await this.contract.repay(loanId, repayAmount);
    await tx.wait();
  }

  async repayLoan(loanId, amount) {
    try {
      if (!this.contract) {
        await this.init();
      }
      
      console.log("Repaying loan:", { 
        loanId: loanId, 
        amount: amount.toString(), 
        amountFormatted: ethers.utils.formatUnits(amount, 18) 
      });

      // Dynamically check available contract methods
      console.log('Available Contract Methods:', 
        Object.keys(this.contract.functions).filter(key => 
          key.startsWith('repay') || key.startsWith('loan')
        )
      );

      // Additional diagnostic checks before repayment
      try {
        // Check if loan retrieval method exists
        const loanRetrievalMethod = Object.keys(this.contract.functions).find(
          method => method.startsWith('getLoan') || method === 'loans'
        );

        if (loanRetrievalMethod) {
          const loanDetails = await this.contract[loanRetrievalMethod](loanId);
          console.log('Loan Details Before Repayment:', {
            method: loanRetrievalMethod,
            borrower: loanDetails.borrower,
            amount: ethers.utils.formatUnits(loanDetails.amount || loanDetails[1], 18),
            status: loanDetails.status || 'Unknown'
          });
        }
      } catch (detailError) {
        console.error('Error fetching loan details:', {
          message: detailError.message,
          code: detailError.code
        });
      }

      // Find the correct repayment method
      const repayMethods = Object.keys(this.contract.functions).filter(
        method => method.startsWith('repay')
      );

      console.log('Potential Repay Methods:', repayMethods);

      let tx;
      if (repayMethods.includes('repay')) {
        tx = await this.contract.repay(loanId, amount);
      } else if (repayMethods.length > 0) {
        // Try the first available repay method
        tx = await this.contract[repayMethods[0]](loanId, amount);
      } else {
        throw new Error('No repayment method found in contract');
      }

      console.log("Repay transaction:", {
        hash: tx.hash,
        from: tx.from,
        to: tx.to
      });
      return tx;
    } catch (error) {
      console.error("Detailed Error repaying loan:", {
        message: error.message,
        code: error.code,
        reason: error.reason,
        stack: error.stack,
        data: error.data
      });
      
      // If it's a revert error, try to decode the revert reason
      if (error.code === 'CALL_EXCEPTION' && error.data) {
        try {
          const errorInterface = new ethers.utils.Interface([
            'error InsufficientRepaymentAmount()',
            'error LoanAlreadyRepaid()',
            'error LoanNotActive()',
            'error UnauthorizedRepayment()'
          ]);
          const errorDescription = errorInterface.parseError(error.data);
          console.error('Decoded Revert Reason:', errorDescription);
        } catch (decodeError) {
          console.error('Could not decode revert reason:', decodeError);
        }
      }
      
      throw error;
    }
  }

  async fundLendingPool(amount) {
    if (!this.contract) await this.init();
    try {
      // Add gas limit to avoid estimation errors
      const tx = await this.contract.fundLendingPool(amount, {
        gasLimit: 500000, // Explicit gas limit
      });
      console.log("Funding transaction:", tx.hash);
      await tx.wait();
      console.log("Funding confirmed");
      return tx;
    } catch (error) {
      console.error("Funding error:", error);
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was rejected by user");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds for gas");
      } else if (error.message.includes("not owner")) {
        throw new Error("Only the owner can fund the lending pool");
      } else {
        throw new Error(`Failed to fund lending pool: ${error.message}`);
      }
    }
  }

  async approveTokens(amount) {
    try {
      if (!this.contract) {
        await this.init();
      }
      
      // Get the lending token contract
      const lendingTokenAddress = "0xB1BF661cf9C19cb899400B0E62D8fc87AA3a22C6";
      const lendingTokenContract = new ethers.Contract(
        lendingTokenAddress, 
        ["function approve(address spender, uint256 amount) public returns (bool)"],
        this.signer
      );

      console.log('Approving tokens:', {
        amount: amount.toString(),
        contractAddress: this.contract.address,
        lendingTokenAddress: lendingTokenAddress
      });

      const tx = await lendingTokenContract.approve(
        this.contract.address, 
        amount
      );
      
      console.log('Approve transaction:', {
        hash: tx.hash,
        from: tx.from,
        to: tx.to
      });

      return tx;
    } catch (error) {
      console.error('Error approving tokens:', {
        message: error.message,
        code: error.code,
        reason: error.reason,
        stack: error.stack
      });
      throw error;
    }
  }

  // === View Functions ===
  async getTokensInfo(offset, limit) {
    if (!this.contract) await this.init();
    return await this.contract.getTokensInfo(offset, limit);
  }

  async getUserTotalValueUSD(userAddress, offset, limit) {
    if (!this.contract) await this.init();
    return await this.contract.getUserTotalValueUSD(userAddress, offset, limit);
  }

  async getTokenPrice(tokenAddress) {
    if (!this.contract) await this.init();
    try {
      const rawPrice = await this.contract.getTokenPrice(tokenAddress);
      console.log("Raw price from contract:", rawPrice.toString());

      // Price comes in with 18 decimals
      const formattedPrice = Number(ethers.utils.formatEther(rawPrice));
      console.log("Formatted price:", formattedPrice);
      return formattedPrice;
    } catch (error) {
      console.error("Error getting token price:", error);
      throw error;
    }
  }

  async hasUserDepositedToken(user, token) {
    if (!this.contract) await this.init();
    return await this.contract.hasUserDepositedToken(user, token);
  }

  async getUserDepositedTokens(userAddress) {
    if (!this.contract) await this.init();
    return await this.contract.getUserDepositedTokens(userAddress);
  }

  async getWhitelistedTokenCount() {
    if (!this.contract) await this.init();
    return await this.contract.getWhitelistedTokenCount();
  }

  async getAllActiveFundManagers() {
    if (!this.contract) await this.init();
    return await this.contract.getAllActiveFundManagers();
  }

  async getUserDeposits(userAddress, tokenAddress) {
    if (!this.contract) await this.init();
    return await this.contract.userDeposits(userAddress, tokenAddress);
  }

  async getLendingToken() {
    if (!this.contract) await this.init();
    return await this.contract.lendingToken();
  }

  async getLendingPoolBalance() {
    if (!this.contract) await this.init();
    return await this.contract.lendingPoolBalance();
  }

  async getUserLoans(userAddress, loanId) {
    if (!this.contract) await this.init();
    return await this.contract.userLoans(userAddress, loanId);
  }

  async getUserLoanCount(userAddress) {
    if (!this.contract) await this.init();
    return await this.contract.userLoanCount(userAddress);
  }

  async checkRole() {
    if (!this.contract) await this.init();

    try {
      const ownerAddress = await this.contract.owner();
      if (ownerAddress.toLowerCase() === this.address.toLowerCase())
        return "owner";

      const fundManagers = await this.contract.getAllActiveFundManagers();
      if (
        fundManagers.some(
          (addr) => addr.toLowerCase() === this.address.toLowerCase()
        )
      )
        return "fundManager";

      return "user";
    } catch (error) {
      console.error("Error checking role:", error);
      return "user";
    }
  }

  async getWhitelistedTokens() {
    if (!this.contract) await this.init();
    const count = await this.getWhitelistedTokenCount();
    const tokensInfo = await this.getTokensInfo(0, count);

    // Transform the data into a more usable format
    const tokens = [];
    for (let i = 0; i < tokensInfo.tokens.length; i++) {
      const token = {
        address: tokensInfo.tokens[i],
        name: tokensInfo.names[i],
        symbol: tokensInfo.symbols[i],
        decimals: tokensInfo.decimals[i],
        price: tokensInfo.prices[i].toString(),
        priceFeed: await this.contract
          .whiteListedTokens(tokensInfo.tokens[i])
          .then((info) => info.priceFeed),
      };
      tokens.push(token);
    }
    return tokens;
  }

  async getTokenBalance(tokenAddress, address) {
    if (!this.contract) await this.init();
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function balanceOf(address) view returns (uint256)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
        ],
        this.provider
      );

      const balance = await tokenContract.balanceOf(address);
      const symbol = await tokenContract.symbol();
      const decimals = await tokenContract.decimals();

      return {
        raw: balance,
        formatted: ethers.utils.formatUnits(balance, decimals),
        symbol,
      };
    } catch (error) {
      console.error("Error getting token balance:", error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }
}

const contractService = new ContractService();
export default contractService;
export { ContractService, contractService };
