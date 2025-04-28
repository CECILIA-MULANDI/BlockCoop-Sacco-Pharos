// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract BlockCoopTokens is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Error messages
    string constant ERR_ZERO_ADDRESS = "Zero address not allowed";
    string constant ERR_UNAUTHORIZED = "Unauthorized access";
    string constant ERR_TOKEN_NOT_WHITELISTED = "Token not whitelisted";
    string constant ERR_TOKEN_ALREADY_WHITELISTED = "Token already whitelisted";
    string constant ERR_INVALID_PRICE_FEED = "Invalid price feed";
    string constant ERR_STALE_PRICE = "Price data is stale";
    string constant ERR_NO_PRICE_FEED = "No price feed available";
    string constant ERR_ZERO_AMOUNT = "Amount must be greater than 0";
    string constant ERR_INSUFFICIENT_ALLOWANCE = "Insufficient token allowance";
    string constant ERR_INVALID_PRICE = "Invalid price from oracle";
    string constant ERR_PRICE_FEED_STALE = "Price feed data is stale";
    string constant ERR_PRICE_FEED_ROUND_INCOMPLETE =
        "Price feed round is not complete";
    string constant ERR_PRICE_FEED_ROUND_STALE = "Price feed round is stale";
    string constant ERR_PRICE_FEED_REGISTRY_ERROR =
        "Failed to fetch price from registry: ";
    string constant ERR_INSUFFICIENT_BALANCE = "Insufficient balance";

    // Maximum tokens to iterate in a single call to prevent DOS
    uint256 public constant MAX_ITERATION_COUNT = 100;

    uint256 public stalePriceThreshold = 24 hours;
    // Loan parameters
    uint256 public constant LTV_RATIO = 5000; // 50% Loan-to-Value ratio
    uint256 public constant INTEREST_RATE = 500; // 5% annual interest
    uint256 public constant LIQUIDATION_THRESHOLD = 7500; // 75% threshold
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    // Lending token address (set in constructor or via setter)
    address public lendingToken;
    // Track lending pool balance
    uint256 public lendingPoolBalance;

    constructor(address _lendingToken) Ownable(msg.sender) {
        require(_lendingToken != address(0), ERR_ZERO_ADDRESS);
        lendingToken = _lendingToken;
        // Set deployer as initial fund manager
        isFundManager[msg.sender] = true;
        activeFundManagers.push(msg.sender);
    }

    // Setter for lendingToken (for testing flexibility)
    function setLendingToken(address _lendingToken) external onlyOwner {
        require(_lendingToken != address(0), ERR_ZERO_ADDRESS);
        lendingToken = _lendingToken;
    }

    struct TokenInfo {
        address tokenAddress;
        address priceFeed;
        bool isWhitelisted;
    }

    struct UserDeposit {
        uint256 amount;
        uint256 depositTimestamp;
    }

    struct Loan {
        address collateralToken;
        uint256 collateralAmount;
        uint256 borrowedAmount;
        uint256 accruedInterest;
        uint256 startTimestamp;
        bool active;
    }

    mapping(address => TokenInfo) public whiteListedTokens;
    mapping(address => mapping(address => UserDeposit)) public userDeposits;
    mapping(address => address[]) public userDepositedTokens;
    address[] public tokenList;
    mapping(address => bool) public isFundManager;
    mapping(address => mapping(uint256 => Loan)) public userLoans;
    mapping(address => uint256) public userLoanCount;
    uint256 public activeTokenCount;
    address[] public activeFundManagers;

    event TokenWhitelisted(
        address indexed tokenAddress,
        address indexed priceFeed
    );
    event FundManagerRemoved(address indexed fundManager);
    event TokenRemoved(address indexed tokenAddress);
    event FundManagerAdded(address indexed fundManager);
    event DepositMade(
        address indexed user,
        address indexed tokenAddress,
        uint256 amount
    );
    event WithdrawalMade(
        address indexed user,
        address indexed tokenAddress,
        uint256 amount
    );
    event StalePriceThresholdUpdated(
        uint256 oldThreshold,
        uint256 newThreshold
    );
    event PriceFeedUpdated(
        address indexed tokenAddress,
        address indexed oldPriceFeed,
        address indexed newPriceFeed
    );
    event LoanCreated(
        address indexed user,
        uint256 loanId,
        address indexed collateralToken,
        uint256 collateralAmount,
        uint256 borrowedAmount
    );
    event LoanRepaid(
        address indexed user,
        uint256 loanId,
        uint256 repaidAmount
    );
    event LoanLiquidated(
        address indexed user,
        uint256 loanId,
        address indexed collateralToken,
        uint256 collateralAmount
    );

    modifier tokenRequirements(address _tokenAddress) {
        require(_tokenAddress != address(0), ERR_ZERO_ADDRESS);
        require(
            !whiteListedTokens[_tokenAddress].isWhitelisted,
            ERR_TOKEN_ALREADY_WHITELISTED
        );
        _;
    }

    modifier onlyOwnerOrFundManager() {
        require(
            msg.sender == owner() || isFundManager[msg.sender],
            ERR_UNAUTHORIZED
        );
        _;
    }

    // === Management Functions ===

    function addFundManager(address _manager) external onlyOwner {
        require(_manager != address(0), ERR_ZERO_ADDRESS);
        require(!isFundManager[_manager], "Already a fund manager");
        isFundManager[_manager] = true;
        activeFundManagers.push(_manager);
        emit FundManagerAdded(_manager);
    }

    function removeFundManager(address _manager) external onlyOwner {
        require(isFundManager[_manager], "Not a fund manager");
        isFundManager[_manager] = false;
        for (uint256 i = 0; i < activeFundManagers.length; i++) {
            if (activeFundManagers[i] == _manager) {
                activeFundManagers[i] = activeFundManagers[
                    activeFundManagers.length - 1
                ];
                activeFundManagers.pop();
                break;
            }
        }
        emit FundManagerRemoved(_manager);
    }

    function updateStalePriceThreshold(
        uint256 _newThreshold
    ) external onlyOwner {
        require(_newThreshold > 0, "Threshold must be greater than 0");
        uint256 oldThreshold = stalePriceThreshold;
        stalePriceThreshold = _newThreshold;
        emit StalePriceThresholdUpdated(oldThreshold, _newThreshold);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function whitelistToken(
        address _tokenAddress,
        address _priceFeed
    ) external tokenRequirements(_tokenAddress) onlyOwnerOrFundManager {
        require(_tokenAddress != address(0), ERR_ZERO_ADDRESS);
        if (_priceFeed != address(0)) {
            try AggregatorV3Interface(_priceFeed).latestRoundData() returns (
                uint80 /* roundId */,
                int256 price,
                uint256 /* startedAt */,
                uint256 /* updatedAt */,
                uint80 /* answeredInRound */
            ) {
                require(price > 0, "Invalid price feed");
            } catch {
                revert(ERR_INVALID_PRICE_FEED);
            }
        }
        whiteListedTokens[_tokenAddress] = TokenInfo({
            tokenAddress: _tokenAddress,
            priceFeed: _priceFeed,
            isWhitelisted: true
        });
        tokenList.push(_tokenAddress);
        activeTokenCount++;
        emit TokenWhitelisted(_tokenAddress, _priceFeed);
    }

    function updatePriceFeed(
        address _tokenAddress,
        address _newPriceFeed
    ) external onlyOwnerOrFundManager {
        require(_tokenAddress != address(0), ERR_ZERO_ADDRESS);
        TokenInfo storage tokenInfo = whiteListedTokens[_tokenAddress];
        require(tokenInfo.isWhitelisted, ERR_TOKEN_NOT_WHITELISTED);
        address oldPriceFeed = tokenInfo.priceFeed;
        tokenInfo.priceFeed = _newPriceFeed;
        emit PriceFeedUpdated(_tokenAddress, oldPriceFeed, _newPriceFeed);
    }

    function unWhitelistToken(
        address _tokenAddress
    ) external onlyOwnerOrFundManager {
        TokenInfo storage token = whiteListedTokens[_tokenAddress];
        require(token.isWhitelisted, ERR_TOKEN_NOT_WHITELISTED);
        token.isWhitelisted = false;
        activeTokenCount--;
        emit TokenRemoved(_tokenAddress);
    }

    // === User Functions ===

    function deposit(
        address _tokenAddress,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        TokenInfo storage token = whiteListedTokens[_tokenAddress];
        require(token.isWhitelisted, ERR_TOKEN_NOT_WHITELISTED);
        require(_amount > 0, ERR_ZERO_AMOUNT);
        IERC20 erc20 = IERC20(_tokenAddress);
        require(
            erc20.allowance(msg.sender, address(this)) >= _amount,
            ERR_INSUFFICIENT_ALLOWANCE
        );
        erc20.safeTransferFrom(msg.sender, address(this), _amount);
        if (userDeposits[msg.sender][_tokenAddress].amount == 0) {
            userDepositedTokens[msg.sender].push(_tokenAddress);
        }
        userDeposits[msg.sender][_tokenAddress].amount += _amount;
        userDeposits[msg.sender][_tokenAddress].depositTimestamp = block
            .timestamp;
        emit DepositMade(msg.sender, _tokenAddress, _amount);
    }

    function withdraw(
        address _tokenAddress,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        require(_amount > 0, ERR_ZERO_AMOUNT);
        uint256 availableBalance = userDeposits[msg.sender][_tokenAddress]
            .amount;
        for (uint256 i = 0; i < userLoanCount[msg.sender]; i++) {
            Loan storage loan = userLoans[msg.sender][i];
            if (loan.active && loan.collateralToken == _tokenAddress) {
                availableBalance -= loan.collateralAmount;
            }
        }
        require(availableBalance >= _amount, ERR_INSUFFICIENT_BALANCE);
        userDeposits[msg.sender][_tokenAddress].amount -= _amount;
        if (userDeposits[msg.sender][_tokenAddress].amount == 0) {
            removeTokenFromUserList(msg.sender, _tokenAddress);
        }
        IERC20(_tokenAddress).safeTransfer(msg.sender, _amount);
        emit WithdrawalMade(msg.sender, _tokenAddress, _amount);
    }

    function removeTokenFromUserList(address _user, address _token) internal {
        address[] storage userTokens = userDepositedTokens[_user];
        for (uint256 i = 0; i < userTokens.length; i++) {
            if (userTokens[i] == _token) {
                userTokens[i] = userTokens[userTokens.length - 1];
                userTokens.pop();
                break;
            }
        }
    }

    // === View Functions ===

    function getTokensInfo(
        uint256 _offset,
        uint256 _limit
    )
        external
        view
        returns (
            address[] memory tokens,
            string[] memory names,
            string[] memory symbols,
            uint8[] memory decimals,
            uint256[] memory prices
        )
    {
        uint256 limit = _limit > MAX_ITERATION_COUNT
            ? MAX_ITERATION_COUNT
            : _limit;
        uint256 actualLimit = 0;
        uint256 count = 0;
        for (uint256 i = _offset; i < tokenList.length && count < limit; i++) {
            address tokenAddr = tokenList[i];
            if (whiteListedTokens[tokenAddr].isWhitelisted) {
                actualLimit++;
            }
            count++;
        }
        tokens = new address[](actualLimit);
        names = new string[](actualLimit);
        symbols = new string[](actualLimit);
        decimals = new uint8[](actualLimit);
        prices = new uint256[](actualLimit);
        count = 0;
        uint256 resultIndex = 0;
        for (uint256 i = _offset; i < tokenList.length && count < limit; i++) {
            address tokenAddr = tokenList[i];
            TokenInfo storage token = whiteListedTokens[tokenAddr];
            if (token.isWhitelisted) {
                tokens[resultIndex] = tokenAddr;
                try IERC20Metadata(tokenAddr).name() returns (
                    string memory name
                ) {
                    names[resultIndex] = name;
                } catch {
                    names[resultIndex] = "Unknown";
                }
                try IERC20Metadata(tokenAddr).symbol() returns (
                    string memory symbol
                ) {
                    symbols[resultIndex] = symbol;
                } catch {
                    symbols[resultIndex] = "???";
                }
                try IERC20Metadata(tokenAddr).decimals() returns (
                    uint8 decimal
                ) {
                    decimals[resultIndex] = decimal;
                } catch {
                    decimals[resultIndex] = 18;
                }
                try this.getTokenPrice(tokenAddr) returns (uint256 price) {
                    prices[resultIndex] = price;
                } catch {
                    prices[resultIndex] = 0;
                }
                resultIndex++;
            }
            count++;
        }
        return (tokens, names, symbols, decimals, prices);
    }

    function getUserTotalValueUSD(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256 totalValue, uint256 processedTokens) {
        address[] memory tokens = userDepositedTokens[_user];
        uint256 limit = _limit > MAX_ITERATION_COUNT
            ? MAX_ITERATION_COUNT
            : _limit;
        uint256 end = _offset + limit > tokens.length
            ? tokens.length
            : _offset + limit;
        for (uint256 i = _offset; i < end; i++) {
            address tokenAddr = tokens[i];
            uint256 amount = userDeposits[_user][tokenAddr].amount;
            if (amount > 0) {
                try this.getTokenPrice(tokenAddr) returns (uint256 price) {
                    totalValue += (amount * price) / 1e18;
                } catch {
                    // Skip tokens with price errors
                }
            }
            processedTokens++;
        }
        return (totalValue, processedTokens);
    }

    function getTokenPrice(
        address _tokenAddress
    ) public view returns (uint256) {
        if (_tokenAddress == lendingToken) {
            return 1e18; // $1 in 18 decimals
        }
        TokenInfo storage tokenInfo = whiteListedTokens[_tokenAddress];
        require(tokenInfo.isWhitelisted, ERR_TOKEN_NOT_WHITELISTED);
        require(tokenInfo.priceFeed != address(0), ERR_NO_PRICE_FEED);
        try
            AggregatorV3Interface(tokenInfo.priceFeed).latestRoundData()
        returns (
            uint80 /* roundId */,
            int256 price,
            uint256 /* startedAt */,
            uint256 updatedAt,
            uint80 /* answeredInRound */
        ) {
            require(price > 0, ERR_INVALID_PRICE);
            require(updatedAt > 0, ERR_PRICE_FEED_ROUND_INCOMPLETE);
            require(
                block.timestamp - updatedAt <= stalePriceThreshold,
                ERR_PRICE_FEED_STALE
            );
            return uint256(price) * 1e10; // Convert 8-decimal price to 18 decimals
        } catch {
            revert(ERR_PRICE_FEED_REGISTRY_ERROR);
        }
    }

    function borrow(
        address _collateralToken,
        uint256 _collateralAmount,
        uint256 _borrowAmount
    ) external nonReentrant whenNotPaused {
        require(
            whiteListedTokens[_collateralToken].isWhitelisted,
            ERR_TOKEN_NOT_WHITELISTED
        );
        require(_collateralAmount > 0 && _borrowAmount > 0, ERR_ZERO_AMOUNT);
        require(
            userDeposits[msg.sender][_collateralToken].amount >=
                _collateralAmount,
            "Insufficient collateral"
        );
        require(
            _borrowAmount <= lendingPoolBalance,
            "Insufficient lending pool balance"
        );
        uint256 collateralValueUSD = (getTokenPrice(_collateralToken) *
            _collateralAmount) / 1e18;
        uint256 maxBorrow = (collateralValueUSD * LTV_RATIO) / 10000;
        require(_borrowAmount <= maxBorrow, "Borrow amount exceeds LTV limit");
        userDeposits[msg.sender][_collateralToken].amount -= _collateralAmount;
        uint256 loanId = userLoanCount[msg.sender]++;
        userLoans[msg.sender][loanId] = Loan({
            collateralToken: _collateralToken,
            collateralAmount: _collateralAmount,
            borrowedAmount: _borrowAmount,
            accruedInterest: 0,
            startTimestamp: block.timestamp,
            active: true
        });
        lendingPoolBalance -= _borrowAmount;
        IERC20(lendingToken).safeTransfer(msg.sender, _borrowAmount);
        emit LoanCreated(
            msg.sender,
            loanId,
            _collateralToken,
            _collateralAmount,
            _borrowAmount
        );
    }

    function repay(
        uint256 _loanId,
        uint256 _repayAmount
    ) external nonReentrant whenNotPaused {
        Loan storage loan = userLoans[msg.sender][_loanId];
        require(loan.active, "Loan not active");
        require(_repayAmount > 0, ERR_ZERO_AMOUNT);
        uint256 timeElapsed = block.timestamp - loan.startTimestamp;
        uint256 interest = (loan.borrowedAmount * INTEREST_RATE * timeElapsed) /
            (10000 * SECONDS_PER_YEAR);
        uint256 totalOwed = loan.borrowedAmount + interest;
        uint256 repay = _repayAmount > totalOwed ? totalOwed : _repayAmount;
        IERC20(lendingToken).safeTransferFrom(msg.sender, address(this), repay);
        if (repay >= totalOwed) {
            loan.active = false;
            lendingPoolBalance += repay;
            userDeposits[msg.sender][loan.collateralToken].amount += loan
                .collateralAmount;
        } else {
            if (repay > interest) {
                loan.borrowedAmount -= (repay - interest);
            }
            loan.accruedInterest =
                interest -
                (repay > interest ? interest : repay);
            lendingPoolBalance += repay;
        }
        emit LoanRepaid(msg.sender, _loanId, repay);
    }

    function fundLendingPool(uint256 _amount) external onlyOwner {
        require(_amount > 0, ERR_ZERO_AMOUNT);
        IERC20(lendingToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        lendingPoolBalance += _amount;
    }

    // for future use
    /*
    function liquidate(address _user, uint256 _loanId) external onlyOwnerOrFundManager nonReentrant whenNotPaused {
        Loan storage loan = userLoans[_user][_loanId];
        require(loan.active, "Loan not active");
        uint256 timeElapsed = block.timestamp - loan.startTimestamp;
        uint256 interest = (loan.borrowedAmount * INTEREST_RATE * timeElapsed) / (10000 * SECONDS_PER_YEAR);
        uint256 totalOwed = loan.borrowedAmount + interest;
        uint256 collateralValueUSD = (getTokenPrice(loan.collateralToken) * loan.collateralAmount) / 1e18;
        uint256 totalOwedUSD = totalOwed; // lendingToken is $1
        uint256 minCollateralValueUSD = (totalOwedUSD * LIQUIDATION_THRESHOLD) / 10000;
        require(collateralValueUSD < minCollateralValueUSD, "Loan is sufficiently collateralized");
        loan.active = false;
        lendingPoolBalance += totalOwed; // Assume collateral covers debt
        emit LoanLiquidated(_user, _loanId, loan.collateralToken, loan.collateralAmount);
    }
    */

    function hasUserDepositedToken(
        address _user,
        address _token
    ) external view returns (bool) {
        return userDeposits[_user][_token].amount > 0;
    }

    function getUserDepositedTokens(
        address _user
    ) external view returns (address[] memory) {
        return userDepositedTokens[_user];
    }

    function getWhitelistedTokenCount() external view returns (uint256) {
        return activeTokenCount;
    }

    function getAllActiveFundManagers()
        external
        view
        returns (address[] memory)
    {
        return activeFundManagers;
    }
}
