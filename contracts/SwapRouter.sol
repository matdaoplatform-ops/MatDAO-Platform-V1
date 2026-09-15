// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SwapRouter
 * @dev Simple swap router for exchanging tokens
 * In production, this would integrate with Uniswap or similar DEX
 * For demo purposes, this provides a simple fixed-rate swap
 */
contract SwapRouter is Ownable {
    using SafeERC20 for IERC20;

    constructor() {
        // Constructor sets the deployer as the initial owner
    }

    // Fixed exchange rate: 1 USDC = 0.0003 ETH (approximate)
    uint256 public constant ETH_PER_USDC = 3e14; // 0.0003 ETH in wei, per 1 whole USDC
    uint256 public constant USDC_PER_ETH = 3333; // whole USDC per 1 ETH
    // USDC (and MockUSDC) use 6 decimals. All USDC amounts handled by this
    // contract are in base units (1 USDC = 1e6).
    uint256 public constant USDC_DECIMALS_SCALE = 1e6;

    // Events
    event Swapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /**
     * @dev Swap ETH for USDC
     * @param usdcAddress The address of the USDC token
     */
    function swapETHForUSDC(address usdcAddress) external payable {
        require(msg.value > 0, "Must send ETH");
        
        // wei * (whole USDC / ETH) * 1e6 / 1e18 -> USDC base units (6 decimals)
        uint256 usdcAmount = (msg.value * USDC_PER_ETH * USDC_DECIMALS_SCALE) / 1e18;
        require(usdcAmount > 0, "Amount too small");
        
        IERC20 usdc = IERC20(usdcAddress);
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient USDC liquidity");
        
        usdc.safeTransfer(msg.sender, usdcAmount);
        
        emit Swapped(msg.sender, address(0), usdcAddress, msg.value, usdcAmount);
    }

    /**
     * @dev Swap USDC for ETH
     * @param usdcAddress The address of the USDC token
     * @param usdcAmount The amount of USDC to swap
     */
    function swapUSDCForETH(address usdcAddress, uint256 usdcAmount) external {
        require(usdcAmount > 0, "Must specify USDC amount");
        
        IERC20 usdc = IERC20(usdcAddress);
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        
        // USDC base units * wei-per-whole-USDC / 1e6 -> wei
        uint256 ethAmount = (usdcAmount * ETH_PER_USDC) / USDC_DECIMALS_SCALE;
        require(ethAmount > 0, "Amount too small");
        require(address(this).balance >= ethAmount, "Insufficient ETH liquidity");
        
        payable(msg.sender).transfer(ethAmount);
        
        emit Swapped(msg.sender, usdcAddress, address(0), usdcAmount, ethAmount);
    }

    /**
     * @dev Add liquidity (owner only)
     * @param usdcAddress The address of the USDC token
     * @param usdcAmount The amount of USDC to add
     */
    function addLiquidity(address usdcAddress, uint256 usdcAmount) external payable onlyOwner {
        require(msg.value > 0 && usdcAmount > 0, "Must provide both ETH and USDC");
        
        IERC20 usdc = IERC20(usdcAddress);
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
    }

    /**
     * @dev Remove liquidity (owner only)
     * @param usdcAddress The address of the USDC token
     * @param usdcAmount The amount of USDC to remove
     * @param ethAmount The amount of ETH to remove
     */
    function removeLiquidity(address usdcAddress, uint256 usdcAmount, uint256 ethAmount) external onlyOwner {
        IERC20 usdc = IERC20(usdcAddress);
        usdc.safeTransfer(msg.sender, usdcAmount);
        payable(msg.sender).transfer(ethAmount);
    }

    /**
     * @dev Get current exchange rate
     */
    function getExchangeRate() external pure returns (uint256 ethPerUsdc, uint256 usdcPerEth) {
        return (ETH_PER_USDC, USDC_PER_ETH);
    }

    /**
     * @dev Get quote for ETH to USDC swap
     */
    function getQuoteETHForUSDC(uint256 ethAmount) external pure returns (uint256 usdcAmount) {
        return (ethAmount * USDC_PER_ETH * USDC_DECIMALS_SCALE) / 1e18;
    }

    /**
     * @dev Get quote for USDC to ETH swap
     */
    function getQuoteUSDCForETH(uint256 usdcAmount) external pure returns (uint256 ethAmount) {
        return (usdcAmount * ETH_PER_USDC) / USDC_DECIMALS_SCALE;
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
