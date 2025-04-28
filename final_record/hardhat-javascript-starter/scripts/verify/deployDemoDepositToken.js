const hre = require("hardhat");
const fs = require("fs");

async function main() {
  try {
    console.log("Starting deployment of Mock WETH (DemoToken)...");

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);

    // Check deployer balance
    const deployerBalance = await hre.ethers.provider.getBalance(
      deployer.address
    );
    console.log(
      `Deployer balance: ${hre.ethers.utils.formatEther(deployerBalance)} ETH`
    );

    // Deploy DemoToken for Mock WETH
    const DemoToken = await hre.ethers.getContractFactory("DemoToken");
    const mockWETH = await DemoToken.deploy("Mock WETH", "WETH");
    await mockWETH.deployed();
    const mockWETHAddress = mockWETH.address;
    console.log(`Mock WETH deployed to: ${mockWETHAddress}`);

    // Update addresses file
    const addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));
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
