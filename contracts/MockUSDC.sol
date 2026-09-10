// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token (6 decimals) for testing and demo purposes.
 *
 * - The deployer receives an initial supply (INITIAL_SUPPLY) and becomes owner.
 * - The owner can mint arbitrary amounts (`mint`) for seeding demos.
 * - Anyone can call `faucet()` for FAUCET_AMOUNT, limited to once per
 *   FAUCET_COOLDOWN per address.
 */
contract MockUSDC is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 10000 * 10**6; // 10,000 USDC
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**6; // 1,000,000 USDC

    /// @notice Timestamp of the last faucet claim per address (0 = never).
    mapping(address => uint256) public lastFaucetClaim;

    event FaucetClaimed(address indexed account, uint256 amount, uint256 nextClaimAt);

    constructor() ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    /**
     * @dev Faucet function to mint tokens for testing.
     * Each address may claim FAUCET_AMOUNT once every FAUCET_COOLDOWN.
     */
    function faucet() public {
        uint256 nextAllowed = lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN;
        require(
            lastFaucetClaim[msg.sender] == 0 || block.timestamp >= nextAllowed,
            "MockUSDC: faucet cooldown active"
        );
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT, block.timestamp + FAUCET_COOLDOWN);
    }

    /**
     * @dev Seconds until `account` may call the faucet again (0 = now).
     */
    function faucetCooldownRemaining(address account) external view returns (uint256) {
        uint256 last = lastFaucetClaim[account];
        if (last == 0) return 0;
        uint256 nextAllowed = last + FAUCET_COOLDOWN;
        return block.timestamp >= nextAllowed ? 0 : nextAllowed - block.timestamp;
    }

    /**
     * @dev Owner-only mint used by deploy/seed scripts.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev USDC uses 6 decimals.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
