// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./BlockCoopTokens.sol";
import "./IPriceFeed.sol";

contract MyLoanManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant INTEREST_RATE_DECIMALS = 2;
    uint256 public constant COLLATERAL_RATIO_DECIMALS = 2;
    uint256 public constant MAX_LOAN_DURATION = 365 days;
    uint256 public constant MIN_LOAN_DURATION = 7 days;
    uint256 public constant MAX_LTV_RATIO = 7000; // 70.00% maximum loan-to-value ratio

    // Error messages
    string constant ERR_ZERO_ADDRESS = "Zero address not allowed";
    string constant ERR_UNAUTHORIZED = "Unauthorized access";
    string constant ERR_INVALID_AMOUNT = "Invalid amount";
    string constant ERR_INVALID_DURATION = "Invalid duration";
    string constant ERR_ARRAY_MISMATCH = "Array length mismatch";
    string constant ERR_INSUFFICIENT_COLLATERAL = "Insufficient collateral";
    string constant ERR_TOKEN_NOT_WHITELISTED = "Token not whitelisted";
    string constant ERR_NO_PRICE_FEED = "No price feed for token";
    string constant ERR_UNSUPPORTED_TOKEN = "Token not supported for loans";
    string constant ERR_LOAN_NOT_ACTIVE = "Loan not active";
    string constant ERR_LOAN_LIQUIDATED = "Loan has been liquidated";

    struct LoanRequest {
        address borrower;
        address loanToken; // Token they want to borrow
        uint256 loanAmount; // Amount in loan token decimals
        address[] collateralTokens;
        uint256[] collateralAmounts;
        uint256 duration;
        bool approved;
        bool processed;
    }

    struct Loan {
        address borrower;
        address loanToken; // Token they borrowed
        uint256 loanAmount; // Amount in loan token
        address[] collateralTokens;
        uint256[] collateralAmounts;
        uint256 interestRate;
        uint256 startTime;
        uint256 duration;
        bool isActive;
        bool isLiquidated;
        uint256 lastRepayment;
        uint256 totalRepaid;
        uint256 id; // Added loan ID field
    }

    // State variables
    BlockCoopTokens public saccoContract;
    uint256 public baseLoanInterestRate = 500; // 5.00% annual interest rate
    uint256 public requiredCollateralRatio = 15000; // 150.00% collateral ratio
    uint256 public loanCount = 0;

    // Mappings
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => LoanRequest) public loanRequests;
    mapping(address => uint256[]) public userLoans;
    mapping(address => uint256[]) public userLoanRequests;
    // USD price feeds for tokens
    mapping(address => address) public tokenPriceFeeds;
    // Tokens that can be borrowed
    mapping(address => bool) public supportedLoanTokens;

    // Events
    event LoanRequested(
        uint256 indexed requestId,
        address indexed borrower,
        address loanToken,
        uint256 loanAmount,
        uint256 duration
    );
    event LoanApproved(uint256 indexed requestId, uint256 indexed loanId);
    event LoanRejected(uint256 indexed requestId, address indexed borrower);
    event LoanRepaid(uint256 indexed loanId, uint256 amount);
    event CollateralReturned(uint256 indexed loanId, address indexed borrower);
    event TokenSupportAdded(address indexed token);
    event TokenSupportRemoved(address indexed token);

    constructor(address _saccoContract) Ownable(msg.sender) {
        require(_saccoContract != address(0), ERR_ZERO_ADDRESS);
        saccoContract = BlockCoopTokens(_saccoContract);
    }

    modifier onlyFundManager() {
        require(saccoContract.isFundManager(msg.sender), ERR_UNAUTHORIZED);
        _;
    }

    modifier onlyOwnerOrFundManager() {
        require(
            msg.sender == owner() || saccoContract.isFundManager(msg.sender),
            ERR_UNAUTHORIZED
        );
        _;
    }

    function requestLoan(
        address _loanToken,
        uint256 _loanAmount,
        address[] calldata _collateralTokens,
        uint256[] calldata _collateralAmounts,
        uint256 _duration
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(_loanAmount > 0, ERR_INVALID_AMOUNT);
        require(supportedLoanTokens[_loanToken], ERR_UNSUPPORTED_TOKEN);
        require(
            _duration >= MIN_LOAN_DURATION && _duration <= MAX_LOAN_DURATION,
            ERR_INVALID_DURATION
        );
        require(
            _collateralTokens.length == _collateralAmounts.length,
            ERR_ARRAY_MISMATCH
        );
        require(_collateralTokens.length > 0, "No collateral provided");

        uint256 requestId = loanCount++;
        loanRequests[requestId] = LoanRequest({
            borrower: msg.sender,
            loanToken: _loanToken,
            loanAmount: _loanAmount,
            collateralTokens: _collateralTokens,
            collateralAmounts: _collateralAmounts,
            duration: _duration,
            approved: false,
            processed: false
        });

        userLoanRequests[msg.sender].push(requestId);
        emit LoanRequested(
            requestId,
            msg.sender,
            _loanToken,
            _loanAmount,
            _duration
        );
        return requestId;
    }

    function approveLoanRequest(
        uint256 _requestId
    ) external onlyFundManager whenNotPaused {
        LoanRequest storage request = loanRequests[_requestId];
        require(!request.processed, "Request already processed");
        require(!request.approved, "Request already approved");

        // Step 1: Calculate total collateral value in USD
        uint256 totalCollateralValueUSD = _calculateCollateralValue(
            request.collateralTokens,
            request.collateralAmounts
        );

        // Step 2: Calculate loan value in USD
        uint256 loanValueUSD = _calculateTokenValue(
            request.loanToken,
            request.loanAmount
        );

        // Step 3: Verify loan amount is within LTV limits
        uint256 maxLoanValueUSD = (totalCollateralValueUSD * MAX_LTV_RATIO) /
            10000;
        require(
            loanValueUSD <= maxLoanValueUSD,
            "Loan value exceeds maximum LTV"
        );

        // Step 4: Verify collateral deposits
        require(
            _verifyCollateral(
                request.borrower,
                request.collateralTokens,
                request.collateralAmounts
            ),
            ERR_INSUFFICIENT_COLLATERAL
        );

        // Step 5: Calculate risk-adjusted interest rate
        uint256 adjustedRate = _calculateAdjustedInterestRate(
            request.borrower,
            totalCollateralValueUSD,
            loanValueUSD
        );

        // Step 6: Create loan record
        uint256 loanId = loanCount++;
        loans[loanId] = Loan({
            borrower: request.borrower,
            loanToken: request.loanToken,
            loanAmount: request.loanAmount,
            collateralTokens: request.collateralTokens,
            collateralAmounts: request.collateralAmounts,
            interestRate: adjustedRate,
            startTime: block.timestamp,
            duration: request.duration,
            isActive: true,
            isLiquidated: false,
            lastRepayment: block.timestamp,
            totalRepaid: 0,
            id: loanId // Store the loan ID
        });

        // Step 7: Update request status
        request.processed = true;
        request.approved = true;
        userLoans[request.borrower].push(loanId);

        // Step 8: Lock collateral
        for (uint256 i = 0; i < request.collateralTokens.length; i++) {
            IERC20 token = IERC20(request.collateralTokens[i]);
            require(
                token.transferFrom(
                    address(saccoContract),
                    address(this),
                    request.collateralAmounts[i]
                ),
                "Collateral transfer failed"
            );
        }

        // Step 9: Transfer loan tokens to borrower
        IERC20 loanToken = IERC20(request.loanToken);
        require(
            loanToken.transfer(request.borrower, request.loanAmount),
            "Loan token transfer failed"
        );

        emit LoanApproved(_requestId, loanId);
    }

    function repayLoan(
        uint256 _loanId,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        Loan storage loan = loans[_loanId];
        require(loan.isActive, ERR_LOAN_NOT_ACTIVE);
        require(!loan.isLiquidated, ERR_LOAN_LIQUIDATED);

        IERC20 loanToken = IERC20(loan.loanToken);

        // Transfer repayment tokens from borrower
        require(
            loanToken.transferFrom(msg.sender, address(this), _amount),
            "Repayment transfer failed"
        );

        loan.totalRepaid += _amount;
        loan.lastRepayment = block.timestamp;

        emit LoanRepaid(_loanId, _amount);

        // If fully repaid, return collateral
        if (loan.totalRepaid >= _calculateTotalDue(loan)) {
            _returnCollateral(loan);
            loan.isActive = false;
        }
    }

    function _returnCollateral(Loan storage loan) internal {
        for (uint256 i = 0; i < loan.collateralTokens.length; i++) {
            IERC20 token = IERC20(loan.collateralTokens[i]);
            require(
                token.transfer(loan.borrower, loan.collateralAmounts[i]),
                "Collateral return failed"
            );
        }
        emit CollateralReturned(loan.id, loan.borrower);
    }

    function _calculateTotalDue(
        Loan memory loan
    ) internal view returns (uint256) {
        uint256 timeElapsed = block.timestamp - loan.startTime;
        uint256 interest = (loan.loanAmount * loan.interestRate * timeElapsed) /
            (365 days * 10000);
        return loan.loanAmount + interest;
    }

    function _calculateCollateralValue(
        address[] memory tokens,
        uint256[] memory amounts
    ) internal view returns (uint256) {
        uint256 totalValueUSD = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            totalValueUSD += _calculateTokenValue(tokens[i], amounts[i]);
        }
        return totalValueUSD;
    }

    function _calculateTokenValue(
        address token,
        uint256 amount
    ) internal view returns (uint256) {
        address priceFeed = tokenPriceFeeds[token];
        require(priceFeed != address(0), ERR_NO_PRICE_FEED);

        // Get token price in USD (8 decimals precision)
        uint256 tokenPriceUSD = IPriceFeed(priceFeed).getLatestPrice();
        return (amount * tokenPriceUSD) / 1e18;
    }

    function _calculateAdjustedInterestRate(
        address borrower,
        uint256 collateralValueUSD,
        uint256 loanValueUSD
    ) internal view returns (uint256) {
        // Start with base interest rate
        uint256 rate = baseLoanInterestRate;

        // Adjust based on LTV ratio (multiply by 10000 for precision)
        uint256 ltvRatio = (loanValueUSD * 10000) / collateralValueUSD;

        // Add 2% (200 basis points) for high LTV loans (>50%)
        if (ltvRatio > 5000) {
            rate += 200;
        }

        // Reduce rate by 1% (100 basis points) for borrowers with history
        uint256 completedLoans = userLoans[borrower].length;
        if (completedLoans > 0) {
            rate = rate > 100 ? rate - 100 : 0;
        }

        return rate;
    }

    function _verifyCollateral(
        address borrower,
        address[] memory tokens,
        uint256[] memory amounts
    ) internal view returns (bool) {
        require(tokens.length == amounts.length, ERR_ARRAY_MISMATCH);
        require(tokens.length > 0, "No collateral provided");

        for (uint256 i = 0; i < tokens.length; i++) {
            (, , bool isWhitelisted) = saccoContract.whiteListedTokens(
                tokens[i]
            );
            (uint256 balance, ) = saccoContract.userDeposits(
                borrower,
                tokens[i]
            );

            if (!isWhitelisted || balance < amounts[i]) {
                return false;
            }
        }
        return true;
    }

    // Admin functions
    function addSupportedLoanToken(address _token) external onlyOwnerOrFundManager {
        require(_token != address(0), ERR_ZERO_ADDRESS);
        supportedLoanTokens[_token] = true;
        emit TokenSupportAdded(_token);
    }

    function removeSupportedLoanToken(address _token) external onlyOwnerOrFundManager {
        supportedLoanTokens[_token] = false;
        emit TokenSupportRemoved(_token);
    }

    function setTokenPriceFeed(
        address token,
        address priceFeed
    ) external onlyOwnerOrFundManager {
        require(
            token != address(0) && priceFeed != address(0),
            ERR_ZERO_ADDRESS
        );
        tokenPriceFeeds[token] = priceFeed;
    }

    // View functions
    function getLoanDetails(
        uint256 _loanId
    )
        external
        view
        returns (
            address borrower,
            address loanToken,
            uint256 loanAmount,
            uint256 startTime,
            uint256 duration,
            bool isActive,
            uint256 totalRepaid
        )
    {
        Loan storage loan = loans[_loanId];
        return (
            loan.borrower,
            loan.loanToken,
            loan.loanAmount,
            loan.startTime,
            loan.duration,
            loan.isActive,
            loan.totalRepaid
        );
    }

    function getUserLoans(
        address _user
    ) external view returns (uint256[] memory) {
        return userLoans[_user];
    }

    function getUserLoanRequests(
        address _user
    ) external view returns (uint256[] memory) {
        return userLoanRequests[_user];
    }
}
