require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    pharos: {
      url: "https://devnet.dplabs-internal.com",
      accounts: [
        "48f12fe4b6e4d9c6bf5f5e383242be6c67a6692b269d0bda1142bf59c0a9444a",
      ],
      gasPrice: undefined, // Remove this if it exists
      // Add these EIP-1559 gas settings
      maxFeePerGas: "50000000000", // 50 gwei
      maxPriorityFeePerGas: "1000000000", // 1 gwei
      chainId: 50002,
    },
  },
};
