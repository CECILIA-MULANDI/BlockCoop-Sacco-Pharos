// scripts/deploy-blockcoop-tokens.js
const hre = require("hardhat");
const fs = require("fs");
const { ethers } = hre;

async function main() {
  try {
    console.log("Starting deployment of BlockCoopTokens...");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);

    // Check deployer balance
    const deployerBalance = await ethers.provider.getBalance(
      deployer.address
    );
    console.log(
      `Deployer balance: ${ethers.formatEther(deployerBalance)} ETH`
    );

    // Load LendToken address
    let addresses = {};
    try {
      addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));
    } catch (error) {
      // File doesn't exist, we'll create it
      console.log("Creating new deployed-addresses.json file");
    }
    const lendTokenAddress = addresses.lendTokenAddress;
    if (!lendTokenAddress)
      throw new Error("LendToken address not found in deployed-addresses.json");

    // Deploy BlockCoopTokens
    const BlockCoopTokens = await ethers.getContractFactory(
      "BlockCoopTokens"
    );
    const blockCoopTokens = await BlockCoopTokens.deploy(lendTokenAddress);
    await blockCoopTokens.waitForDeployment();
    const blockCoopTokensAddress = await blockCoopTokens.getAddress();
    console.log(`BlockCoopTokens deployed to: ${blockCoopTokensAddress}`);

    // Verify owner and fund manager
    const owner = await blockCoopTokens.owner();
    console.log(`Contract owner: ${owner}`);
    const isFundManager = await blockCoopTokens.isFundManager(deployer.address);
    console.log(`Deployer is fund manager: ${isFundManager}`);

    // Update addresses file
    addresses.blockCoopTokensAddress = blockCoopTokensAddress;
    fs.writeFileSync(
      "./deployed-addresses.json",
      JSON.stringify(addresses, null, 2)
    );
    console.log("BlockCoopTokens address saved to deployed-addresses.json");

    return blockCoopTokens;
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
