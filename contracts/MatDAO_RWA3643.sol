// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/**
 * @title MatDAO_RWA3643
 * @dev ERC-3643 (T-REX PROTOCOL) compliant token for permissioned RWA tokenization
 * Implements regulatory compliance, identity verification (KYC/AML/KYB), and transfer restrictions
 * Only accredited investors and registered entities can hold the fractionalized TTO assets
 */
contract MatDAO_RWA3643 is ERC20, AccessControl, ERC20Pausable {
    // Role definitions for ERC-3643 compliance
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    // Identity registry for KYC/KYB verification
    mapping(address => bool) public isIdentityVerified;
    mapping(address => bool) isAccreditedInvestor;
    mapping(address => bool) isRegisteredEntity;
    
    // Transfer restrictions
    mapping(address => bool) public frozenAccounts;
    mapping(address => uint256) public transferAllowance; // Daily transfer limit
    
    // Offering rules
    bool public offeringActive;
    uint256 public offeringStartTime;
    uint256 public offeringEndTime;
    uint256 public maxTotalSupply;
    
    // Events for compliance tracking
    event IdentityVerified(address indexed account, bool verified);
    event AccreditedInvestorStatus(address indexed account, bool accredited);
    event EntityRegistered(address indexed account, bool registered);
    event AccountFrozen(address indexed account, bool frozen);
    event OfferingStatusChanged(bool active, uint256 startTime, uint256 endTime);
    event ComplianceTransfer(address indexed from, address indexed to, uint256 amount);
    
    /**
     * @dev Constructor
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial token supply
     * @param maxSupply Maximum token supply
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint256 maxSupply
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        
        maxTotalSupply = maxSupply;
        
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }
    
    /**
     * @dev Verify identity for KYC/KYB compliance
     * @param account Address to verify
     * @param verified Verification status
     */
    function setIdentityVerified(address account, bool verified) external onlyRole(COMPLIANCE_ROLE) {
        isIdentityVerified[account] = verified;
        emit IdentityVerified(account, verified);
    }
    
    /**
     * @dev Set accredited investor status
     * @param account Address to update
     * @param accredited Accredited investor status
     */
    function setAccreditedInvestor(address account, bool accredited) external onlyRole(COMPLIANCE_ROLE) {
        isAccreditedInvestor[account] = accredited;
        emit AccreditedInvestorStatus(account, accredited);
    }
    
    /**
     * @dev Register entity for KYB compliance
     * @param account Entity address
     * @param registered Registration status
     */
    function setRegisteredEntity(address account, bool registered) external onlyRole(COMPLIANCE_ROLE) {
        isRegisteredEntity[account] = registered;
        emit EntityRegistered(account, registered);
    }
    
    /**
     * @dev Freeze account for regulatory reasons
     * @param account Address to freeze
     * @param frozen Freeze status
     */
    function freezeAccount(address account, bool frozen) external onlyRole(COMPLIANCE_ROLE) {
        frozenAccounts[account] = frozen;
        emit AccountFrozen(account, frozen);
    }
    
    /**
     * @dev Set daily transfer allowance for account
     * @param account Address to set allowance for
     * @param allowance Daily transfer limit
     */
    function setTransferAllowance(address account, uint256 allowance) external onlyRole(COMPLIANCE_ROLE) {
        transferAllowance[account] = allowance;
    }
    
    /**
     * @dev Configure offering period
     * @param active Offering active status
     * @param startTime Offering start timestamp
     * @param endTime Offering end timestamp
     */
    function setOfferingPeriod(
        bool active,
        uint256 startTime,
        uint256 endTime
    ) external onlyRole(ADMIN_ROLE) {
        offeringActive = active;
        offeringStartTime = startTime;
        offeringEndTime = endTime;
        emit OfferingStatusChanged(active, startTime, endTime);
    }
    
    /**
     * @dev Check if transfer is compliant with ERC-3643 rules
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function isTransferCompliant(
        address from,
        address to,
        uint256 amount
    ) public view returns (bool) {
        // Check if accounts are frozen
        if (frozenAccounts[from] || frozenAccounts[to]) {
            return false;
        }
        
        // Check if recipient is identity verified
        if (!isIdentityVerified[to]) {
            return false;
        }
        
        // Check if recipient is either accredited investor or registered entity
        if (!isAccreditedInvestor[to] && !isRegisteredEntity[to]) {
            return false;
        }
        
        // Check transfer allowance
        if (transferAllowance[from] > 0 && amount > transferAllowance[from]) {
            return false;
        }
        
        // Check offering period restrictions
        if (offeringActive) {
            uint256 currentTime = block.timestamp;
            if (currentTime < offeringStartTime || currentTime > offeringEndTime) {
                return false;
            }
        }
        
        // NOTE: the max-supply constraint is enforced in mint() only. Transfers
        // never change totalSupply, so checking it here made every transfer
        // fail once supply approached the cap.
        return true;
    }
    
    /**
     * @dev Override transfer to include compliance checks
     */
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        require(isTransferCompliant(msg.sender, to, amount), "Transfer not compliant with ERC-3643");
        emit ComplianceTransfer(msg.sender, to, amount);
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Override transferFrom to include compliance checks
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override whenNotPaused returns (bool) {
        require(isTransferCompliant(from, to, amount), "Transfer not compliant with ERC-3643");
        emit ComplianceTransfer(from, to, amount);
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev Mint tokens (only MINTER_ROLE)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= maxTotalSupply, "Exceeds max supply");
        require(isIdentityVerified[to], "Recipient not identity verified");
        require(isAccreditedInvestor[to] || isRegisteredEntity[to], "Recipient not qualified");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens (only BURNER_ROLE)
     * @param account Account to burn from
     * @param amount Amount to burn
     */
    function burn(address account, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(account, amount);
    }
    
    /**
     * @dev Pause token transfers (only ADMIN_ROLE)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers (only ADMIN_ROLE)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Required override: both ERC20 and ERC20Pausable define this hook.
     * ERC20Pausable enforces `whenNotPaused` on every mint/burn/transfer.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Get comprehensive compliance status for an account
     * @param account Address to check
     */
    function getComplianceStatus(address account) external view returns (
        bool identityVerified,
        bool accreditedInvestor,
        bool registeredEntity,
        bool frozen,
        uint256 transferAllowanceAmount
    ) {
        return (
            isIdentityVerified[account],
            isAccreditedInvestor[account],
            isRegisteredEntity[account],
            frozenAccounts[account],
            transferAllowance[account]
        );
    }
    
    /**
     * @dev Batch verify identities for efficiency
     * @param accounts Addresses to verify
     * @param verified Verification status for all accounts
     */
    function batchSetIdentityVerified(
        address[] calldata accounts,
        bool verified
    ) external onlyRole(COMPLIANCE_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            isIdentityVerified[accounts[i]] = verified;
            emit IdentityVerified(accounts[i], verified);
        }
    }
    
    /**
     * @dev Batch set accredited investor status
     * @param accounts Addresses to update
     * @param accredited Accredited status for all accounts
     */
    function batchSetAccreditedInvestor(
        address[] calldata accounts,
        bool accredited
    ) external onlyRole(COMPLIANCE_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            isAccreditedInvestor[accounts[i]] = accredited;
            emit AccreditedInvestorStatus(accounts[i], accredited);
        }
    }
}
