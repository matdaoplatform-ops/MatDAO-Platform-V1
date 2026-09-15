// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockIPT
 * @dev Mock Investment Participation Token (18 decimals) used by
 * MatDAO_Escrow (refunds / dividends) and MatDAO_Swap (secondary market).
 *
 * Only the owner (deployer / MatDAO admin) can mint. In the demo flow the
 * admin distributes IPT to investors off-chain after they fund the escrow;
 * see the NatSpec in MatDAO_Escrow for the known limitations of that model.
 */
contract MockIPT is ERC20, ERC20Burnable, Ownable {
    constructor(uint256 initialSupply) ERC20("MatDAO Investment Participation Token", "IPT") {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    /**
     * @dev Owner-only mint.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
