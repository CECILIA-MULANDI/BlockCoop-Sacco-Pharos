// scripts/deploy-mock-price-feed.js
// File: final_record/hardhat-javascript-starter/scripts/verify/deployMockPriceFeed.js
// Purpose: Deploy MockPriceFeed contract and save its address to deployed-addresses.json

const hre = require("hardhat");
const fs = require("fs");
const { ethers } = hre;

async function main() {
  try {
    console.log("Starting deployment of MockPriceFeed...");

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

    // Deploy MockPriceFeed
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy();
    await priceFeed.waitForDeployment();
    const priceFeedAddress = await priceFeed.getAddress();
    console.log(`MockPriceFeed deployed to: ${priceFeedAddress}`);

    // Verify price
    const price = await priceFeed.price();
    console.log(
      `MockPriceFeed initial price: $${ethers.formatUnits(price, 8)}`
    );

    // Update addresses file
    let addresses = {};
    try {
      addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));
    } catch (error) {
      // File doesn't exist, we'll create it
      console.log("Creating new deployed-addresses.json file");
    }
    addresses.priceFeedAddress = priceFeedAddress;
    fs.writeFileSync(
      "./deployed-addresses.json",
      JSON.stringify(addresses, null, 2)
    );
    console.log("MockPriceFeed address saved to deployed-addresses.json");

    return priceFeed;
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
