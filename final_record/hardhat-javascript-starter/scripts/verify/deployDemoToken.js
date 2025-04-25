const hre = require("hardhat");

async function main() {
  const DemoToken = await hre.ethers.getContractFactory("DemoToken");
  const demoToken = await DemoToken.deploy();
  await demoToken.waitForDeployment();
  console.log("DemoToken deployed to:", demoToken.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// 0x85c5aaFc492Dbd50277E65F1294D00093FdF1b6d
