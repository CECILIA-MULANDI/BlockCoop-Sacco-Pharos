const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  try {
    console.log("Starting deployment of contracts for BlockCoopTokens demo...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);

    // Check deployer balance
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} ETH`);

    // Deploy DemoToken for LendToken
    console.log("Deploying LendToken (DemoToken)...");
    const DemoToken = await ethers.getContractFactory("DemoToken");
    const lendToken = await DemoToken.deploy("LendToken", "LEND");
    await lendToken.waitForDeployment();
    const lendTokenAddress = await lendToken.getAddress();
    console.log(`LendToken deployed to: ${lendTokenAddress}`);

    // Deploy DemoToken for Mock WETH
    console.log("Deploying Mock WETH (DemoToken)...");
    const mockWETH = await DemoToken.deploy("Mock WETH", "WETH");
    await mockWETH.waitForDeployment();
    const mockWETHAddress = await mockWETH.getAddress();
    console.log(`Mock WETH deployed to: ${mockWETHAddress}`);

    // Deploy MockPriceFeed
    console.log("Deploying MockPriceFeed...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy();
    await priceFeed.waitForDeployment();
    const priceFeedAddress = await priceFeed.getAddress();
    console.log(`MockPriceFeed deployed to: ${priceFeedAddress}`);

    // Verify price feed price ($2000)
    const price = await priceFeed.price();
    console.log(
      `MockPriceFeed initial price: $${ethers.formatUnits(price, 8)}`
    );

    // Deploy BlockCoopTokens with LendToken address
    console.log("Deploying BlockCoopTokens...");
    const BlockCoopTokens = await ethers.getContractFactory("BlockCoopTokens");
    const blockCoopTokens = await BlockCoopTokens.deploy(lendTokenAddress);
    await blockCoopTokens.waitForDeployment();
    const blockCoopTokensAddress = await blockCoopTokens.getAddress();
    console.log(`BlockCoopTokens deployed to: ${blockCoopTokensAddress}`);

    // Verify the owner
    const owner = await blockCoopTokens.owner();
    console.log(`Contract owner: ${owner}`);

    // Verify deployer is a fund manager
    const isFundManager = await blockCoopTokens.isFundManager(deployer.address);
    console.log(`Deployer is fund manager: ${isFundManager}`);

    // Whitelist Mock WETH with price feed
    console.log("Whitelisting Mock WETH...");
    await blockCoopTokens.whitelistToken(mockWETHAddress, priceFeedAddress);
    console.log(`Mock WETH whitelisted with price feed: ${priceFeedAddress}`);

    // Fund the lending pool with 100,000 LendToken
    const fundingAmount = ethers.parseUnits("100000", 18);
    console.log(
      `Funding lending pool with ${ethers.formatUnits(
        fundingAmount,
        18
      )} LendToken...`
    );
    await lendToken.approve(blockCoopTokensAddress, fundingAmount);
    await blockCoopTokens.fundLendingPool(fundingAmount);
    const lendingPoolBalance = await blockCoopTokens.lendingPoolBalance();
    console.log(
      `Lending pool balance: ${ethers.formatUnits(
        lendingPoolBalance,
        18
      )} LendToken`
    );

    console.log("Deployment and setup completed successfully!");

    // Return deployed contracts for testing
    return {
      blockCoopTokens,
      lendToken,
      mockWETH,
      priceFeed,
    };
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
// 0xffc53a39d9fd01419ce97b8243ba628c0a8beda3;
