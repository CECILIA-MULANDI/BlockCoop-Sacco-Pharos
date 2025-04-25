// scripts/deploy-blockcoop-tokens.ts
const hre = require("hardhat");

async function main() {
  try {
    console.log("Starting deployment of BlockCoopTokens contract...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);

    // Check deployer balance
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} ETH`);

    // Deploy the BlockCoopTokens contract
    const BlockCoopTokens = await ethers.getContractFactory("BlockCoopTokens");
    const blockCoopTokens = await BlockCoopTokens.deploy();

    // Wait for deployment to finish
    await blockCoopTokens.waitForDeployment();

    const blockCoopTokensAddress = await blockCoopTokens.getAddress();
    console.log(`BlockCoopTokens deployed to: ${blockCoopTokensAddress}`);

    // Verify the owner is the deployer
    const owner = await blockCoopTokens.owner();
    console.log(`Contract owner: ${owner}`);

    // Check if deployer is a fund manager
    const isFundManager = await blockCoopTokens.isFundManager(deployer.address);
    console.log(`Deployer is fund manager: ${isFundManager}`);

    console.log("Deployment completed successfully!");

    // Return the deployed contract for testing purposes
    return blockCoopTokens;
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
0xffc53a39d9fd01419ce97b8243ba628c0a8beda3;
