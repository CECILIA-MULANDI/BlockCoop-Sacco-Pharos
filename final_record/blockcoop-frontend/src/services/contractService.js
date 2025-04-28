import { ethers } from "ethers";
import contractABI from "../utils/abi.json";

// Get these from your deployed contract
const CONTRACT_ADDRESS = "0x6C70060CA445484D76C9685807E6F21E42a8ab6D";
const CHAIN_ID = "0xC352"; // 50002 in hex

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.address = null;
  }

  async init() {
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
        } else {
          throw switchError;
        }
      }
    }

    this.provider = new ethers.providers.Web3Provider(window.ethereum);
    this.signer = this.provider.getSigner();
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, this.signer);
    this.address = await this.signer.getAddress();
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
    const tx = await this.contract.whitelistToken(tokenAddress, priceFeed);
    await tx.wait();
  }

  async updatePriceFeed(tokenAddress, newPriceFeed) {
    if (!this.contract) await this.init();
    const tx = await this.contract.updatePriceFeed(tokenAddress, newPriceFeed);
    await tx.wait();
  }

  async unWhitelistToken(tokenAddress) {
    if (!this.contract) await this.init();
    const tx = await this.contract.unWhitelistToken(tokenAddress);
    await tx.wait();
  }

  // === User Functions ===
  async deposit(tokenAddress, amount) {
    if (!this.contract) await this.init();
    const tx = await this.contract.deposit(tokenAddress, amount);
    await tx.wait();
  }

  async withdraw(tokenAddress, amount) {
    if (!this.contract) await this.init();
    const tx = await this.contract.withdraw(tokenAddress, amount);
    await tx.wait();
  }

  async borrow(collateralToken, collateralAmount, borrowAmount) {
    if (!this.contract) await this.init();
    const tx = await this.contract.borrow(collateralToken, collateralAmount, borrowAmount);
    await tx.wait();
  }

  async repay(loanId, repayAmount) {
    if (!this.contract) await this.init();
    const tx = await this.contract.repay(loanId, repayAmount);
    await tx.wait();
  }

  async fundLendingPool(amount) {
    if (!this.contract) await this.init();
    const tx = await this.contract.fundLendingPool(amount);
    await tx.wait();
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
    return await this.contract.getTokenPrice(tokenAddress);
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
      if (fundManagers.some(
        (addr) => addr.toLowerCase() === this.address.toLowerCase()
      ))
        return "fundManager";

      return "user";
    } catch (error) {
      console.error("Error checking role:", error);
      return "user";
    }
  }
}

export const contractService = new ContractService();
