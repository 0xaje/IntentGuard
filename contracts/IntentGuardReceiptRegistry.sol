// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {
    IIntentGuardTypes,
    IIntentGuardPolicyRegistry
} from "./interfaces/IIntentGuardTypes.sol";

contract IntentGuardReceiptRegistry is
    AccessControl,
    EIP712,
    Pausable,
    IIntentGuardTypes
{
    bytes32 public constant EVALUATOR_ROLE = keccak256("EVALUATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    bytes32 public constant RECEIPT_TYPEHASH = keccak256(
        "Receipt(bytes32 receiptId,bytes32 policyId,bytes32 intentHash,bytes32 requestHash,bytes32 evidenceHash,uint256 chainId,address transactionSubject,address evaluator,uint8 verdict,uint64 policyVersion,uint64 evaluatedAt,uint64 expiresAt,uint32 engineVersion,uint32 decoderVersion)"
    );

    IIntentGuardPolicyRegistry public immutable policyRegistry;

    mapping(bytes32 receiptId => Receipt receipt) private _receipts;
    mapping(bytes32 receiptId => bool revoked) private _revoked;
    mapping(address evaluator => uint64 keyVersion) public evaluatorKeyVersion;

    error ReceiptAlreadyExists(bytes32 receiptId);
    error ReceiptNotFound(bytes32 receiptId);
    error ReceiptExpired(bytes32 receiptId);
    error ReceiptAlreadyRevoked(bytes32 receiptId);
    error InvalidReceipt();
    error InvalidSubject();
    error InvalidEvaluator();
    error PolicyNotActive(bytes32 policyId);
    error InvalidSignature();
    error WrongChain(uint256 expected, uint256 received);
    error EvaluatedInFuture();
    error InvalidValidityWindow();

    event ReceiptAnchored(
        bytes32 indexed receiptId,
        bytes32 indexed policyId,
        bytes32 indexed intentHash,
        address transactionSubject,
        address evaluator,
        Verdict verdict,
        uint64 evaluatedAt,
        uint64 expiresAt,
        bytes32 evidenceHash
    );

    event ReceiptRevoked(
        bytes32 indexed receiptId,
        address indexed revoker,
        uint64 revokedAt
    );

    event EvaluatorKeyVersionUpdated(
        address indexed evaluator,
        uint64 keyVersion
    );

    constructor(address admin, address policyRegistryAddress)
        EIP712("IntentGuard Receipt Registry", "1")
    {
        if (admin == address(0) || policyRegistryAddress == address(0)) {
            revert InvalidReceipt();
        }
        policyRegistry = IIntentGuardPolicyRegistry(policyRegistryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function anchorReceipt(
        Receipt calldata receipt,
        bytes calldata evaluatorSignature
    ) external whenNotPaused returns (bytes32 receiptId) {
        _validateReceiptShape(receipt);

        receiptId = receipt.receiptId;
        if (_receipts[receiptId].receiptId != bytes32(0)) {
            revert ReceiptAlreadyExists(receiptId);
        }

        if (!hasRole(EVALUATOR_ROLE, receipt.evaluator)) {
            revert InvalidEvaluator();
        }
        if (receipt.chainId != block.chainid) {
            revert WrongChain(block.chainid, receipt.chainId);
        }
        if (receipt.evaluatedAt > block.timestamp) revert EvaluatedInFuture();
        if (receipt.expiresAt != 0 && receipt.expiresAt < receipt.evaluatedAt) {
            revert InvalidValidityWindow();
        }
        if (receipt.expiresAt != 0 && receipt.expiresAt <= block.timestamp) {
            revert ReceiptExpired(receiptId);
        }

        if (receipt.policyId != bytes32(0)) {
            if (!policyRegistry.isPolicyActive(receipt.policyId)) {
                revert PolicyNotActive(receipt.policyId);
            }
        }

        bytes32 digest = _hashTypedDataV4(_hashReceiptStruct(receipt));
        address recovered = ECDSA.recover(digest, evaluatorSignature);
        if (recovered != receipt.evaluator) revert InvalidSignature();

        _receipts[receiptId] = receipt;
        emit ReceiptAnchored(
            receipt.receiptId,
            receipt.policyId,
            receipt.intentHash,
            receipt.transactionSubject,
            receipt.evaluator,
            receipt.verdict,
            receipt.evaluatedAt,
            receipt.expiresAt,
            receipt.evidenceHash
        );
    }

    function revokeReceipt(bytes32 receiptId) external {
        Receipt memory receipt = _receipts[receiptId];
        if (receipt.receiptId == bytes32(0)) revert ReceiptNotFound(receiptId);
        if (_revoked[receiptId]) revert ReceiptAlreadyRevoked(receiptId);
        if (
            msg.sender != receipt.transactionSubject &&
            msg.sender != receipt.evaluator &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert InvalidEvaluator();
        }

        _revoked[receiptId] = true;
        emit ReceiptRevoked(receiptId, msg.sender, uint64(block.timestamp));
    }

    function getReceipt(bytes32 receiptId)
        external
        view
        returns (Receipt memory receipt, bool revoked)
    {
        receipt = _receipts[receiptId];
        revoked = _revoked[receiptId];
    }

    function isReceiptValid(bytes32 receiptId) public view returns (bool) {
        Receipt memory receipt = _receipts[receiptId];
        if (receipt.receiptId == bytes32(0) || _revoked[receiptId]) return false;
        if (receipt.expiresAt != 0 && receipt.expiresAt <= block.timestamp) return false;
        if (
            receipt.policyId != bytes32(0) &&
            !policyRegistry.isPolicyActive(receipt.policyId)
        ) return false;
        return true;
    }

    function hashReceipt(Receipt calldata receipt)
        external
        view
        returns (bytes32 digest)
    {
        digest = _hashTypedDataV4(_hashReceiptStruct(receipt));
    }

    function setEvaluatorKeyVersion(address evaluator, uint64 keyVersion)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (evaluator == address(0)) revert InvalidEvaluator();
        evaluatorKeyVersion[evaluator] = keyVersion;
        emit EvaluatorKeyVersionUpdated(evaluator, keyVersion);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _validateReceiptShape(Receipt calldata receipt) internal pure {
        if (
            receipt.receiptId == bytes32(0) ||
            receipt.intentHash == bytes32(0) ||
            receipt.requestHash == bytes32(0) ||
            receipt.evidenceHash == bytes32(0)
        ) revert InvalidReceipt();
        if (receipt.transactionSubject == address(0)) revert InvalidSubject();
        if (receipt.evaluator == address(0)) revert InvalidEvaluator();
        if (uint8(receipt.verdict) > uint8(Verdict.CANNOT_VERIFY)) {
            revert InvalidReceipt();
        }
    }

    function _hashReceiptStruct(Receipt calldata receipt)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                RECEIPT_TYPEHASH,
                receipt.receiptId,
                receipt.policyId,
                receipt.intentHash,
                receipt.requestHash,
                receipt.evidenceHash,
                receipt.chainId,
                receipt.transactionSubject,
                receipt.evaluator,
                uint8(receipt.verdict),
                receipt.policyVersion,
                receipt.evaluatedAt,
                receipt.expiresAt,
                receipt.engineVersion,
                receipt.decoderVersion
            )
        );
    }
}
