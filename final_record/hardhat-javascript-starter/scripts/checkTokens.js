const hre = require("hardhat");

async function main() {
  try {
    // Get the BlockCoopTokens contract
    const blockCoopAddress = "0xffc53a39d9fd01419ce97b8243ba628c0a8beda3";
    const BlockCoopTokens = await hre.ethers.getContractFactory("BlockCoopTokens");
    const blockCoopTokens = BlockCoopTokens.attach(blockCoopAddress);

    // Get the PharosDemo token address
    const pharosTokenAddress = "0x85c5aaFc492Dbd50277E65F1294D00093FdF1b6d";
    
    console.log("Checking token status...");
    
    // Get total count
    const count = await blockCoopTokens.getWhitelistedTokenCount();
    console.log("Total whitelisted tokens:", count.toString());

    // Check if token is whitelisted
    const tokenInfo = await blockCoopTokens.whiteListedTokens(pharosTokenAddress);
    console.log("\nPharosDemo Token Info:");
    console.log("Is Whitelisted:", tokenInfo.isWhitelisted);
    console.log("Price Feed:", tokenInfo.priceFeed);

    // Get all token info
    if (count > 0) {
      const [addresses, names, symbols, decimals, prices] = await blockCoopTokens.getTokensInfo(0, count);
      console.log("\nAll Whitelisted Tokens:");
      for (let i = 0; i < addresses.length; i++) {
        console.log(`\nToken ${i + 1}:`);
        console.log("Address:", addresses[i]);
        console.log("Name:", names[i]);
        console.log("Symbol:", symbols[i]);
        console.log("Decimals:", decimals[i].toString());
        console.log("Price:", prices[i].toString());
      }
    }

  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
