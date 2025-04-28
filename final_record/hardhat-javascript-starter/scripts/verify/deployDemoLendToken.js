const hre = require("hardhat");
const fs = require("fs");

async function main() {
  try {
    console.log("Starting deployment of LendToken (DemoToken)...");

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

    // Deploy DemoToken for LendToken
    const DemoToken = await hre.ethers.getContractFactory("DemoToken");
    const lendToken = await DemoToken.deploy("LendToken", "LEND");
    await lendToken.deployed();
    const lendTokenAddress = lendToken.address;
    console.log(`LendToken deployed to: ${lendTokenAddress}`);

    // Save address to JSON file
    const addresses = { lendTokenAddress };
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
