// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPriceFeed {
    /**
     * @dev Returns the latest price of the token in USD (US Dollars)
     * @return The price with 8 decimals of precision (Chainlink standard)
     */
    function getLatestPrice() external view returns (uint256);
}

interface IKESPriceFeed {
    /**
     * @dev Returns the latest USD/KES exchange rate
     * @return The exchange rate with 8 decimals of precision
     */
    function getUSDKESRate() external view returns (uint256);
}
