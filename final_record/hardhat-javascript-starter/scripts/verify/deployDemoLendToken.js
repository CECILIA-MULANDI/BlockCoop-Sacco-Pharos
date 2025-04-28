// scripts/deploy-demo-lend-token.js
const hre = require("hardhat");
const fs = require("fs");
const { ethers } = hre;

/**
 * Deploy DemoToken for LendToken.
 *
 * This script deploys the DemoToken contract and saves the deployed address to a JSON file.
 */

async function main() {
  try {
    console.log("Starting deployment of LendToken (DemoToken)...");

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

    // Deploy DemoToken for LendToken
    const DemoToken = await ethers.getContractFactory("DemoToken");
    const lendToken = await DemoToken.deploy("LendToken", "LEND");
    await lendToken.waitForDeployment();
    const lendTokenAddress = await lendToken.getAddress();
    console.log(`LendToken deployed to: ${lendTokenAddress}`);

    // Save address to JSON file
    let addresses = {};
    try {
      addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));
    } catch (error) {
      // File doesn't exist, we'll create it
      console.log("Creating new deployed-addresses.json file");
    }
    addresses.lendTokenAddress = lendTokenAddress;
    fs.writeFileSync(
      "./deployed-addresses.json",
      JSON.stringify(addresses, null, 2)
    );
    console.log("LendToken address saved to deployed-addresses.json");

    return lendToken;
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

// 0x85c5aaFc492Dbd50277E65F1294D00093FdF1b6d
