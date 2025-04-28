// scripts/deploy-demo-token-weth.js
const hre = require("hardhat");
const fs = require("fs");
const { ethers } = hre;

async function main() {
  try {
    console.log("Starting deployment of Mock WETH (DemoToken)...");

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

    // Deploy DemoToken for Mock WETH
    const DemoToken = await ethers.getContractFactory("DemoToken");
    const mockWETH = await DemoToken.deploy("Mock WETH", "WETH");
    await mockWETH.waitForDeployment();
    const mockWETHAddress = await mockWETH.getAddress();
    console.log(`Mock WETH deployed to: ${mockWETHAddress}`);

    // Update addresses file
    let addresses = {};
    try {
      addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));
    } catch (error) {
      // File doesn't exist, we'll create it
      console.log("Creating new deployed-addresses.json file");
    }
    addresses.mockWETHAddress = mockWETHAddress;
    fs.writeFileSync(
      "./deployed-addresses.json",
      JSON.stringify(addresses, null, 2)
    );
    console.log("Mock WETH address saved to deployed-addresses.json");

    return mockWETH;
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
