// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIntentGuardTypes {
    enum Verdict {
        MATCH,
        MISMATCH,
        CANNOT_VERIFY
    }

    struct PolicyCommitment {
        bytes32 policyHash;
        address owner;
        uint64 version;
        uint64 validAfter;
        uint64 validUntil;
        string metadataURI;
    }

    struct Receipt {
        bytes32 receiptId;
        bytes32 policyId;
        bytes32 intentHash;
        bytes32 requestHash;
        bytes32 evidenceHash;
        uint256 chainId;
        address subject;
        address evaluator;
        Verdict verdict;
        uint64 policyVersion;
        uint64 evaluatedAt;
        uint64 expiresAt;
        uint32 engineVersion;
        uint32 decoderVersion;
    }
}

interface IIntentGuardPolicyRegistry is IIntentGuardTypes {
    function commitPolicy(
        bytes32 policyHash,
        uint64 version,
        uint64 validAfter,
        uint64 validUntil,
        string calldata metadataURI
    ) external returns (bytes32 policyId);

    function revokePolicy(bytes32 policyId) external;

    function getPolicy(bytes32 policyId)
        external
        view
        returns (PolicyCommitment memory commitment, bool revoked);

    function policyOwner(bytes32 policyId) external view returns (address);

    function policyCommitter(bytes32 policyId) external view returns (address);

    function isPolicyActive(bytes32 policyId) external view returns (bool);
}
