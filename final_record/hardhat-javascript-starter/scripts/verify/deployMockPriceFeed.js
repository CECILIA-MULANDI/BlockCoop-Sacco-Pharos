const hre = require("hardhat");

async function main() {
  // Get the deployer's account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Get the MockPriceFeed contract factory
  const MockPriceFeed = await hre.ethers.getContractFactory("MockPriceFeed");

  // Deploy the contract
  console.log("Deploying MockPriceFeed...");
  const mockPriceFeed = await MockPriceFeed.deploy();

  // Wait for the deployment transaction to be mined
  await mockPriceFeed.waitForDeployment();

  // Get the deployed contract address
  const contractAddress = await mockPriceFeed.getAddress();
  console.log("MockPriceFeed deployed to:", contractAddress);

  // Optional: Verify the contract on Etherscan (for testnets/mainnet)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations before verification...");
    await mockPriceFeed.deploymentTransaction().wait(6); // Wait for 6 confirmations
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
  }
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });

// 0xdA5F41747A3A8fA4200cdAe7A25B16Ae5A65c434
