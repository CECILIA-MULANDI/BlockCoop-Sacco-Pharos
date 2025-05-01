# BlockCoopTokens

![BlockCoop Banner](../readme_assets/HomePage.png)

A decentralized token lending and borrowing platform built on Ethereum with robust governance, risk management, and price feed integration. BlockCoop enables communities to create cooperative-based financial services with advanced DeFi capabilities.

## 🚀 Live Versions

**Main Production Version**:
{todo}

- **Pharos Network DevNet Version**: [BlockCoop Pharos Integration](https://block-coop-sacco-pharos.vercel.app) - Special integration created for the Pharos Network hackathon, showcasing our adaptability and commitment to the Pharos ecosystem.

## 📋 Overview

BlockCoop is a comprehensive DeFi protocol that enables users to deposit various ERC20 tokens as collateral and borrow against them.

### Key Features

- **Multi-Token Support**: Deposit and borrow against various whitelisted tokens
- **Oracle Integration**: Real-time, secure price feeds for accurate valuations
- **Risk Management**: Configurable Loan-to-Value ratios and liquidation thresholds
- **User-Friendly Interface**: Intuitive dashboard for managing deposits and loans

## 🖥️ User Interface & Navigation

### Dashboard

![Dashboard](https://placeholder-for-screenshot.com/dashboard.png)

The main dashboard provides an overview of:

- Your current deposits and their USD value
- Active loans and their health ratios
- Available lending pool liquidity
- Whitelisted tokens and their current prices

### Deposit Flow

![Deposit Flow](https://placeholder-for-screenshot.com/deposit.png)

1. Select the token you wish to deposit from the dropdown menu
2. Enter the amount you want to deposit
3. Approve the token spending (first transaction)
4. Confirm your deposit (second transaction)
5. Your deposit will appear in your portfolio immediately after confirmation

### Borrowing Flow

![Borrowing Flow](https://placeholder-for-screenshot.com/borrow.png)

1. Navigate to the "Borrow" section
2. Select the collateral token and amount you want to use
3. Enter the amount you wish to borrow (system will show your maximum available)
4. Confirm the transaction
5. The borrowed amount will be sent to your wallet

### Portfolio Management

![Portfolio Management](https://placeholder-for-screenshot.com/portfolio.png)

Track and manage your:

- Active deposits
- Current loans and their interest accrual
- Liquidation risk indicators
- Repayment options

## 🧰 Smart Contracts

### Main Contract: BlockCoopTokens

The core contract handling deposits, loans, and protocol governance.

#### Key Parameters

- **LTV_RATIO**: 50% (5000 basis points) - Maximum loan-to-value ratio
- **LIQUIDATION_THRESHOLD**: 75% (7500 basis points) - Threshold for liquidation
- **INTEREST_RATE**: 5% annual (500 basis points)
- **MAX_ITERATION_COUNT**: 100 - Maximum tokens to process in a single view function call

### Support Contracts

#### MockPriceFeed (for testing)

A test contract that mimics Chainlink's AggregatorV3Interface for development and testing purposes.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockPriceFeed {
    int256 public price = 200000000000; // $2000.00, 8 decimals (Chainlink standard)
    uint256 public updatedAt = block.timestamp;
    uint80 public roundId = 1;
    uint256 public startedAt = block.timestamp;
    uint80 public answeredInRound = 1;

    // Returns mock price data in Chainlink format
    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, price, startedAt, block.timestamp, answeredInRound);
    }

    // Updates the mock price
    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
        roundId++;
        answeredInRound = roundId;
    }
}
```

#### DemoToken (for testing)

A simple ERC20 token implementation for testing the protocol.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DemoToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }
}
```

## 📊 Contract Integration with Pharos Network

For the Pharos Network DevNet integration, we've made specific adaptations:

1. **Optimized Gas Usage**: Refactored loops and storage patterns to reduce gas costs on Pharos
2. **Enhanced Oracle Framework**: Modified price feed implementations to work seamlessly with Pharos Network
3. **Governance Extensions**: Added Pharos-specific governance mechanisms while maintaining full compatibility

The integration demonstrates our commitment to supporting emerging blockchain infrastructures while maintaining the core functionality that makes BlockCoop powerful.

## 🔧 Technical Usage

### For Users

1. **Deposit Tokens**

   ```solidity
   function deposit(address _tokenAddress, uint256 _amount) external
   ```

   Deposit whitelisted ERC20 tokens as collateral.

2. **Withdraw Tokens**

   ```solidity
   function withdraw(address _tokenAddress, uint256 _amount) external
   ```

   Withdraw tokens that aren't being used as active collateral.

3. **Borrow**

   ```solidity
   function borrow(address _collateralToken, uint256 _collateralAmount, uint256 _borrowAmount) external
   ```

   Borrow lending tokens against your collateral.

4. **Repay**
   ```solidity
   function repay(uint256 _loanId, uint256 _repayAmount) external
   ```
   Repay your loan to release collateral.

### For Administrators

1. **Whitelist Tokens**

   ```solidity
   function whitelistToken(address _tokenAddress, address _priceFeed) external
   ```

   Add support for new collateral tokens with associated price feeds.

2. **Update Price Feeds**

   ```solidity
   function updatePriceFeed(address _tokenAddress, address _newPriceFeed) external
   ```

   Update the price feed for a whitelisted token.

3. **Fund Manager Management**

   ```solidity
   function addFundManager(address _manager) external
   function removeFundManager(address _manager) external
   ```

   Add or remove accounts with fund manager privileges.

4. **Emergency Controls**

   ```solidity
   function pause() external
   function unpause() external
   ```

   Pause and unpause protocol operations in case of emergencies.

5. **Lending Pool Management**
   ```solidity
   function fundLendingPool(uint256 _amount) external
   ```
   Add funds to the lending pool.

## 🔍 View Functions

- `getTokensInfo`: Get details about whitelisted tokens
- `getUserTotalValueUSD`: Calculate a user's total deposited value
- `getTokenPrice`: Get the current price of a token from its price feed
- `getUserDepositedTokens`: Get all tokens deposited by a user
- `getWhitelistedTokenCount`: Get the count of whitelisted tokens
- `getAllActiveFundManagers`: Get all active fund managers

## 🔒 Security Features

- **ReentrancyGuard**: Protection against reentrancy attacks
- **Pausable**: Emergency pause functionality
- **Ownership Management**: Secure owner transitions
- **Price Feed Validation**: Checks for stale or invalid price data
- **Error Handling**: Comprehensive error messages for transparent operation

## 💻 Development & Deployment

### Local Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/blockcoop/blockcoop-protocol.git
   cd blockcoop-protocol
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run tests:

   ```bash
   npx hardhat test
   ```

4. Start local development:
   ```bash
   npm run dev
   ```

### Deploying to Pharos Network DevNet

1. Set up your environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your private key and Pharos DevNet RPC
   ```

2. Deploy contracts:

   ```bash
   npx hardhat run scripts/deploy-pharos.js --network pharosDevnet
   ```

3. Verify contracts:
   ```bash
   npx hardhat verify --network pharosDevnet <CONTRACT_ADDRESS>
   ```

## 🌟 Our Journey

BlockCoop has already established itself as a promising DeFi platform, raising significant funding and building an active community. For the Pharos Network HackQuest, we've created a specialized version that demonstrates our ability to adapt to new ecosystems while maintaining our core functionality.

We see great potential in the Pharos Network and wanted to showcase how BlockCoop can contribute to its growth while leveraging its unique features. The Pharos DevNet version represents our commitment to innovation and cross-chain compatibility.

## 🤝 Contributing

We welcome contributions from the community! To contribute:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📜 License

MIT

## 📞 Contact & Support

- **Website**: [https://blockcoop.finance](https://blockcoop.finance)
- **Twitter**: [@BlockCoopDeFi](https://twitter.com/BlockCoopDeFi)
- **Discord**: [BlockCoop Community](https://discord.gg/blockcoop)
- **Email**: team@blockcoop.finance

---

_BlockCoop - Bringing Cooperative Finance to Web3_
