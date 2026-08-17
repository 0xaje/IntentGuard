// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIntentGuardTypes, IIntentGuardPolicyRegistry} from "./interfaces/IIntentGuardTypes.sol";

contract IntentGuardPolicyRegistry is AccessControl, IIntentGuardPolicyRegistry {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant MAX_METADATA_URI_LENGTH = 2048;

    mapping(bytes32 policyId => PolicyCommitment commitment) private _policies;
    mapping(bytes32 policyId => bool revoked) private _revoked;
    mapping(address owner => uint256 nonce) private _nonces;

    error InvalidPolicyHash();
    error InvalidOwner();
    error InvalidValidityWindow();
    error PolicyAlreadyExists(bytes32 policyId);
    error PolicyNotFound(bytes32 policyId);
    error PolicyIsRevoked(bytes32 policyId);
    error NotPolicyOwner();
    error MetadataURITooLong();

    event PolicyCommitted(
        bytes32 indexed policyId,
        bytes32 indexed intentHash,
        address indexed policyOwner,
        address committer,
        uint64 version,
        uint64 validFrom,
        uint64 validUntil,
        string metadataURI
    );

    event PolicyRevoked(
        bytes32 indexed policyId,
        address indexed policyOwner,
        address indexed revoker,
        uint64 revokedAt
    );

    constructor(address admin) {
        if (admin == address(0)) revert InvalidOwner();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function commitPolicy(
        bytes32 intentHash,
        address policyOwnerParam,
        uint64 version,
        uint64 validFrom,
        uint64 validUntil,
        string calldata metadataURI
    ) external returns (bytes32 policyId) {
        if (intentHash == bytes32(0)) revert InvalidPolicyHash();
        if (validUntil != 0 && validUntil < validFrom) {
            revert InvalidValidityWindow();
        }
        if (bytes(metadataURI).length > MAX_METADATA_URI_LENGTH) {
            revert MetadataURITooLong();
        }

        address effectiveOwner = policyOwnerParam == address(0) ? msg.sender : policyOwnerParam;
        uint256 nonce = _nonces[effectiveOwner]++;
        policyId = keccak256(abi.encode(effectiveOwner, msg.sender, nonce, intentHash, version));
        if (_policies[policyId].policyOwner != address(0)) {
            revert PolicyAlreadyExists(policyId);
        }

        _policies[policyId] = PolicyCommitment({
            policyId: policyId,
            intentHash: intentHash,
            policyOwner: effectiveOwner,
            committer: msg.sender,
            validFrom: validFrom,
            validUntil: validUntil,
            nonce: nonce,
            version: version,
            metadataURI: metadataURI
        });

        emit PolicyCommitted(
            policyId,
            intentHash,
            effectiveOwner,
            msg.sender,
            version,
            validFrom,
            validUntil,
            metadataURI
        );
    }

    function revokePolicy(bytes32 policyId) external {
        PolicyCommitment storage policy = _policies[policyId];
        if (policy.policyOwner == address(0)) revert PolicyNotFound(policyId);
        if (
            policy.policyOwner != msg.sender &&
            policy.committer != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert NotPolicyOwner();
        }
        if (_revoked[policyId]) revert PolicyIsRevoked(policyId);

        _revoked[policyId] = true;
        emit PolicyRevoked(policyId, policy.policyOwner, msg.sender, uint64(block.timestamp));
    }

    function getPolicy(bytes32 policyId)
        external
        view
        returns (PolicyCommitment memory commitment, bool revoked)
    {
        commitment = _policies[policyId];
        revoked = _revoked[policyId];
    }

    function policyOwner(bytes32 policyId) external view returns (address) {
        return _policies[policyId].policyOwner;
    }

    function policyCommitter(bytes32 policyId) external view returns (address) {
        return _policies[policyId].committer;
    }

    function isPolicyActive(bytes32 policyId) public view returns (bool) {
        PolicyCommitment memory policy = _policies[policyId];
        if (policy.policyOwner == address(0) || _revoked[policyId]) return false;
        if (block.timestamp < policy.validFrom) return false;
        if (policy.validUntil != 0 && block.timestamp > policy.validUntil) return false;
        return true;
    }

    function nextNonce(address owner) external view returns (uint256) {
        return _nonces[owner];
    }
}
