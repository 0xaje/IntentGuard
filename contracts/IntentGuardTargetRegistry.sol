// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIntentGuardTypes} from "./interfaces/IIntentGuardTypes.sol";

contract IntentGuardTargetRegistry is AccessControl, IIntentGuardTypes {
    bytes32 public constant TARGET_MANAGER_ROLE = keccak256("TARGET_MANAGER_ROLE");
    uint256 public constant MAX_METADATA_URI_LENGTH = 2048;

    mapping(address target => mapping(bytes4 selector => TargetRecord record)) private _targets;
    mapping(address target => mapping(bytes4 selector => uint64 version)) private _versions;

    error InvalidTarget();
    error InvalidSelector();
    error InvalidMetadataHash();
    error VersionNotIncreasing();
    error MetadataURITooLong();

    event TargetUpdated(
        address indexed target,
        bytes4 indexed selector,
        TargetStatus status,
        bytes32 metadataHash,
        uint64 version,
        string metadataURI
    );

    event TargetRemoved(
        address indexed target,
        bytes4 indexed selector,
        uint64 version
    );

    constructor(address admin) {
        if (admin == address(0)) revert InvalidTarget();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TARGET_MANAGER_ROLE, admin);
    }

    function setTarget(
        address target,
        bytes4 selector,
        TargetStatus status,
        bytes32 metadataHash,
        uint64 version,
        string calldata metadataURI
    ) external onlyRole(TARGET_MANAGER_ROLE) {
        if (target == address(0)) revert InvalidTarget();
        if (selector == bytes4(0)) revert InvalidSelector();
        if (metadataHash == bytes32(0)) revert InvalidMetadataHash();
        if (bytes(metadataURI).length > MAX_METADATA_URI_LENGTH) {
            revert MetadataURITooLong();
        }

        uint64 previousVersion = _versions[target][selector];
        if (version <= previousVersion) revert VersionNotIncreasing();

        _versions[target][selector] = version;
        _targets[target][selector] = TargetRecord({
            target: target,
            selector: selector,
            status: status,
            metadataHash: metadataHash,
            version: version,
            metadataURI: metadataURI
        });

        emit TargetUpdated(
            target,
            selector,
            status,
            metadataHash,
            version,
            metadataURI
        );
    }

    function removeTarget(address target, bytes4 selector)
        external
        onlyRole(TARGET_MANAGER_ROLE)
    {
        if (target == address(0)) revert InvalidTarget();
        if (selector == bytes4(0)) revert InvalidSelector();

        uint64 previousVersion = _versions[target][selector];
        if (previousVersion == 0) return;
        uint64 nextVersion = previousVersion + 1;
        _versions[target][selector] = nextVersion;
        delete _targets[target][selector];
        emit TargetRemoved(target, selector, nextVersion);
    }

    function getTarget(address target, bytes4 selector)
        external
        view
        returns (TargetRecord memory record)
    {
        record = _targets[target][selector];
    }

    function targetStatus(address target, bytes4 selector)
        external
        view
        returns (TargetStatus)
    {
        return _targets[target][selector].status;
    }
}
