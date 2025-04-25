import { ethers } from "ethers";
import contractABI from "../utils/abi.json";

// Get these from your deployed contract
const CONTRACT_ADDRESS = "0xffc53a39d9fd01419ce97b8243ba628c0a8beda3";
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
    this.contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      contractABI,
      this.signer
    );
    this.address = await this.signer.getAddress();
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

  // Owner functions
  async addFundManager(managerAddress) {
    if (!this.contract) await this.init();
    const tx = await this.contract.addFundManager(managerAddress);
    await tx.wait();
  }

  async whitelistToken(tokenAddress, priceFeed) {
    if (!this.contract) await this.init();
    const tx = await this.contract.whitelistToken(tokenAddress, priceFeed);
    await tx.wait();
  }

  // Fund Manager functions
  async updatePriceFeed(tokenAddress, newPriceFeed) {
    if (!this.contract) await this.init();
    const tx = await this.contract.updatePriceFeed(tokenAddress, newPriceFeed);
    await tx.wait();
  }

  // User functions
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

  // View functions
  async getUserDepositedTokens(userAddress) {
    if (!this.contract) await this.init();
    return await this.contract.getUserDepositedTokens(userAddress);
  }

  async getWhitelistedTokens() {
    if (!this.contract) await this.init();
    
    try {
      // Get total count of whitelisted tokens
      const count = await this.contract.getWhitelistedTokenCount();
      
      // Use the contract's getTokensInfo function to get all token details
      const [addresses, names, symbols, decimals, prices] = await this.contract.getTokensInfo(0, count);
      
      // Format the data into an array of token objects
      const tokens = addresses.map((address, index) => ({
        address,
        name: names[index],
        symbol: symbols[index],
        decimals: decimals[index],
        price: ethers.utils.formatUnits(prices[index], 8), // Assuming price feed uses 8 decimals
        priceFeed: null // We'll fetch this separately
      }));

      // Get price feed addresses for each token
      for (const token of tokens) {
        const tokenInfo = await this.contract.whiteListedTokens(token.address);
        token.priceFeed = tokenInfo.priceFeed;
      }

      return tokens;
    } catch (error) {
      console.error("Error fetching whitelisted tokens:", error);
      throw error;
    }
  }

  async getUserDeposits(userAddress, tokenAddress) {
    if (!this.contract) await this.init();
    return await this.contract.userDeposits(userAddress, tokenAddress);
  }
}

export const contractService = new ContractService();
