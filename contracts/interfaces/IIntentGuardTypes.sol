// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIntentGuardTypes {
    enum Verdict {
        MATCH,
        MISMATCH,
        CANNOT_VERIFY
    }

    enum TargetStatus {
        UNLISTED,
        RECOGNIZED,
        BLOCKED
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

    struct TargetRecord {
        address target;
        bytes4 selector;
        TargetStatus status;
        bytes32 metadataHash;
        uint64 version;
        string metadataURI;
    }
}

interface IIntentGuardPolicyRegistry is IIntentGuardTypes {
    function getPolicy(bytes32 policyId)
        external
        view
        returns (PolicyCommitment memory commitment, bool revoked);

    function isPolicyActive(bytes32 policyId) external view returns (bool);
}
