// SPDX-License-Identifier: MIT
//
pragma solidity ^0.8.19;

contract MockPriceFeed {
    int256 public price = 100000000; // $1.00, 8 decimals (Chainlink standard)
    uint256 public updatedAt = block.timestamp;
    uint80 public roundId = 1;
    uint256 public startedAt = block.timestamp;
    uint80 public answeredInRound = 1;

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, price, startedAt, block.timestamp, answeredInRound);
    }

    // Optional: For testing different prices
    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
        roundId++;
    }
}
