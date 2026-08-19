import {
  BASE_MAINNET_CHAIN_ID_HEX,
  BASE_USDC_ADDRESS,
  BASE_WETH_ADDRESS,
  UNISWAP_V3_SWAP_ROUTER_02_ADDRESS,
  PROTOCOL_VERSION,
  POLICY_VERSION,
  ENGINE_VERSION,
  DECODER_VERSION,
  RECEIPT_SCHEMA_VERSION,
  type EvidenceItem,
  type EvidenceProvenance,
  type StructuredIntent,
  type VerificationResult,
} from "@shared/intentguard";
import { hashCanonical } from "../../engine/src/canonical";
import { displayEth, displayUsdc, type TransactionInspection } from "./baseRpc";

function evidence(
  id: string,
  label: string,
  state: EvidenceItem["state"],
  detail: string,
  source: EvidenceItem["source"],
  blockNumber?: number | null,
  blockHash?: string | null,
): EvidenceItem {
  return { id, label, state, detail, source, blockNumber: blockNumber ?? null, blockHash: blockHash ?? null };
}

function buildResult(
  transactionHash: string,
  evidenceItems: EvidenceItem[],
  inspection?: TransactionInspection | null,
): VerificationResult {
  const conflictingChecks = evidenceItems.filter((item) => item.state === "CONFLICTING" || item.state === "failed").length;
  const insufficientChecks = evidenceItems.filter((item) => item.state === "INSUFFICIENT" || item.state === "unavailable").length;
  const verifiedChecks = evidenceItems.filter((item) => item.state === "VERIFIED" || item.state === "verified").length;
  const verdict: VerificationResult["verdict"] = conflictingChecks > 0 ? "MISMATCH" : insufficientChecks > 0 ? "CANNOT_VERIFY" : "MATCH";
  const summary = verdict === "MATCH"
    ? "Intent Fidelity Confirmed: The transaction is 100% faithful to the declared human intent under all observable Base evidence."
    : verdict === "MISMATCH"
      ? `Intent Fidelity Violation: IntentGuard identified ${conflictingChecks} conflicting check${conflictingChecks > 1 ? "s" : ""}. The proposed action cannot be considered faithful to the declared intent.`
      : `Intent Fidelity Unverifiable: ${insufficientChecks} required check${insufficientChecks > 1 ? "s" : ""} could not be resolved from available Base RPC evidence.`;

  const chainId = inspection?.networkChainId ? (Number.isNaN(Number(inspection.networkChainId)) ? parseInt(inspection.networkChainId, 16) : Number(inspection.networkChainId)) : 8453;
  const rawBlockNumber = inspection?.receipt.blockNumber ?? inspection?.transaction?.blockNumber ?? null;
  const blockNumber = rawBlockNumber ? Number(rawBlockNumber) : null;
  const rawReceipt = inspection?.raw.receipt as { blockHash?: string; transactionIndex?: string | number } | undefined;
  const rawTx = inspection?.raw.transaction as { transactionIndex?: string | number } | undefined;
  const blockHash = rawReceipt?.blockHash ?? null;
  const rawTxIndex = rawReceipt?.transactionIndex ?? rawTx?.transactionIndex ?? null;
  const transactionIndex = rawTxIndex !== null && rawTxIndex !== undefined
    ? (typeof rawTxIndex === "string" && rawTxIndex.startsWith("0x") ? parseInt(rawTxIndex, 16) : Number(rawTxIndex))
    : null;
  const contractAddress = inspection?.decoded?.routerSwap ? UNISWAP_V3_SWAP_ROUTER_02_ADDRESS : inspection?.transaction?.to ?? null;

  let decoderLabel = "None";
  if (inspection?.decoded.kind === "transfer") decoderLabel = "ERC-20 transfer(address,uint256)";
  else if (inspection?.decoded.kind === "approve") decoderLabel = "ERC-20 approve(address,uint256)";
  else if (inspection?.decoded.routerSwap) decoderLabel = "Uniswap V3 SwapRouter02 exactInputSingle";
  else if (inspection?.decoded.kind === "unknown" && inspection.transaction) decoderLabel = "Raw Base Transaction Calldata";

  const rawReceiptState = inspection?.receipt.state;
  const receiptStatus = rawReceiptState === "success"
    ? "mined_success" as const
    : rawReceiptState === "failed"
      ? "mined_reverted" as const
      : rawReceiptState === "pending"
        ? "pending" as const
        : rawReceiptState === "missing"
          ? "missing" as const
          : null;

  const canonicalEvidencePayload = {
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    policyVersion: POLICY_VERSION,
    engineVersion: ENGINE_VERSION,
    decoderVersion: DECODER_VERSION,
    receiptSchemaVersion: RECEIPT_SCHEMA_VERSION,
    chainId,
    blockNumber,
    blockHash,
    transactionHash: inspection?.transactionHash ?? transactionHash,
    transactionIndex,
    receiptStatus,
    verdict,
    verifiedChecks,
    conflictingChecks,
    insufficientChecks,
    passedChecks: verifiedChecks,
    failedChecks: conflictingChecks,
    unavailableChecks: insufficientChecks,
    evidence: [...evidenceItems]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        label: item.label,
        state: item.state,
        detail: item.detail,
        source: item.source,
        blockNumber: item.blockNumber ?? blockNumber,
        blockHash: item.blockHash ?? blockHash,
      })),
  };
  const evidenceHash = hashCanonical(canonicalEvidencePayload);

  const provenance: EvidenceProvenance = {
    source: "Base JSON-RPC",
    chainId,
    protocolVersion: PROTOCOL_VERSION,
    policyVersion: POLICY_VERSION,
    engineVersion: ENGINE_VERSION,
    decoderVersion: DECODER_VERSION,
    receiptSchemaVersion: RECEIPT_SCHEMA_VERSION,
    blockNumber,
    blockHash,
    transactionHash: inspection?.transactionHash ?? transactionHash,
    transactionIndex,
    receiptStatus,
    contractAddress,
    decoder: decoderLabel,
    evidenceHash,
  };

  return {
    receiptId: `IG-${transactionHash.slice(2, 10).toUpperCase()}`,
    verdict,
    summary,
    evidence: evidenceItems,
    provenance,
    protocolVersion: PROTOCOL_VERSION,
    policyVersion: POLICY_VERSION,
    engineVersion: ENGINE_VERSION,
    decoderVersion: DECODER_VERSION,
    receiptSchemaVersion: RECEIPT_SCHEMA_VERSION,
    verifiedChecks,
    conflictingChecks,
    insufficientChecks,
    passedChecks: verifiedChecks,
    failedChecks: conflictingChecks,
    unavailableChecks: insufficientChecks,
    observedAt: new Date().toISOString(),
  };
}

export function makeUnverifiableResult(transactionHash: string, detail: string): VerificationResult {
  return buildResult(transactionHash, [evidence("base-data", "Base transaction data", "INSUFFICIENT", detail, "Base RPC")], null);
}

function displayQuoteOutput(inspection: TransactionInspection) {
  const raw = inspection.simulation.amountOutRaw;
  const tokenOut = inspection.decoded.routerSwap?.tokenOut;
  if (!raw) return "an unresolved amount";
  if (tokenOut === BASE_WETH_ADDRESS) return `${displayEth(raw) ?? "an unresolved amount"} ETH`;
  if (tokenOut === BASE_USDC_ADDRESS) return `${displayUsdc(raw) ?? "an unresolved amount"} USDC`;
  return `${raw} raw units of ${tokenOut ?? "an unresolved token"}`;
}

export function evaluateIntentAgainstTransaction(intent: StructuredIntent, inspection: TransactionInspection): VerificationResult {
  const items: EvidenceItem[] = [];
  const transaction = inspection.transaction;
  const decoded = inspection.decoded;
  const routerSwap = decoded.routerSwap;
  const decodedUsdcSpend = decoded.token === "USDC" || routerSwap?.tokenIn === BASE_USDC_ADDRESS ? decoded.amountRaw : null;
  const observedSpendRaw = decodedUsdcSpend ?? inspection.observations.spentUsdcRaw;
  const observedSpend = observedSpendRaw ? Number(displayUsdc(observedSpendRaw)) : null;
  const hasUsdcInput = decoded.token === "USDC"
    || routerSwap?.tokenIn === BASE_USDC_ADDRESS
    || inspection.observations.approvals.some((approval) => approval.owner === transaction?.from)
    || inspection.observations.transfers.some((transfer) => transfer.from === transaction?.from);
  const unlimitedApproval = inspection.observations.approvals.find((approval) => approval.unlimited);

  items.push(inspection.networkChainId.toLowerCase() === BASE_MAINNET_CHAIN_ID_HEX
    ? evidence("chain", "Network is Base", "VERIFIED", "Base RPC reported chain ID 8453 (0x2105).", "Base RPC")
    : evidence("chain", "Network is Base", "CONFLICTING", `Base RPC reported ${inspection.networkChainId}, not Base Mainnet.`, "Base RPC"));

  if (!transaction) {
    items.push(evidence("transaction", "Transaction retrieval", "INSUFFICIENT", "No transaction was found for the supplied hash on Base Mainnet.", "Base RPC"));
    return buildResult(inspection.transactionHash, items);
  }

  if (inspection.receipt.state === "success") items.push(evidence("execution", "Mined execution", "VERIFIED", `The transaction receipt succeeded in block ${inspection.receipt.blockNumber ?? "unknown"}.`, "Transaction receipt"));
  else if (inspection.receipt.state === "failed") items.push(evidence("execution", "Mined execution", "CONFLICTING", "The transaction receipt reports a reverted execution.", "Transaction receipt"));
  else items.push(evidence("execution", "Mined execution", "INSUFFICIENT", "No mined receipt is available. The transaction may still be pending.", "Base RPC"));

  if (intent.action === "transfer") {
    if (decoded.kind === "transfer" && decoded.token === "USDC") items.push(evidence("action", "Requested action", "VERIFIED", "Decoded calldata is a direct USDC transfer.", "Decoded calldata"));
    else if (decoded.kind === "approve") items.push(evidence("action", "Requested action", "CONFLICTING", "Decoded calldata is a USDC approval, not the requested transfer.", "Decoded calldata"));
    else items.push(evidence("action", "Requested action", "INSUFFICIENT", "The transaction is not a supported direct USDC transfer decoder path.", "Decoded calldata"));
  } else if (routerSwap?.tokenIn === BASE_USDC_ADDRESS && routerSwap.tokenOut === BASE_WETH_ADDRESS) {
    items.push(evidence("action", "Requested action", "VERIFIED", `Decoded allowlisted Uniswap v3 SwapRouter02 exactInputSingle call at fee tier ${routerSwap.fee}.`, "Decoded calldata"));
  } else if (decoded.kind === "approve") {
    items.push(evidence("action", "Requested action", "CONFLICTING", "Decoded calldata is a direct USDC approval, not a swap.", "Decoded calldata"));
  } else {
    items.push(evidence("action", "Requested action", "INSUFFICIENT", "The action is not the allowlisted USDC-to-WETH Uniswap v3 exactInputSingle path.", "Decoded calldata"));
  }

  items.push(hasUsdcInput
    ? evidence("input-asset", "Input asset", "VERIFIED", "Observed USDC as the transaction input in supported calldata or a sender-originated USDC receipt transfer.", "Transaction receipt")
    : evidence("input-asset", "Input asset", "INSUFFICIENT", "No supported evidence establishes USDC as the action input; an output-side USDC transfer does not qualify.", "Transaction receipt"));

  if (observedSpend === null || !Number.isFinite(observedSpend)) items.push(evidence("spend-limit", "Maximum spend", "INSUFFICIENT", "The USDC amount spent by this action could not be established from supported evidence.", "Deterministic policy"));
  else if (observedSpend <= intent.maxSpendUsdc) items.push(evidence("spend-limit", "Maximum spend", "VERIFIED", `${observedSpend} USDC observed, within the ${intent.maxSpendUsdc} USDC limit.`, "Deterministic policy"));
  else items.push(evidence("spend-limit", "Maximum spend", "CONFLICTING", `${observedSpend} USDC observed, exceeding the ${intent.maxSpendUsdc} USDC limit.`, "Deterministic policy"));

  if (intent.action === "swap" && inspection.simulation.state === "available") {
    items.push(evidence("quote-simulation", "Read-only current quote", "VERIFIED", `QuoterV2 estimates ${displayQuoteOutput(inspection)} at the latest Base state; this is not mined-output evidence or a guarantee.`, "Read-only QuoterV2"));
  } else if (intent.action === "swap" && inspection.simulation.state === "unavailable") {
    items.push(evidence("quote-simulation", "Read-only current quote", "INSUFFICIENT", inspection.simulation.detail, "Read-only QuoterV2"));
  }

  if (intent.action === "swap" && intent.maxSlippagePercent !== null) {
    const detail = inspection.simulation.state === "available"
      ? `A current QuoterV2 estimate is available, but it cannot prove historical or mined slippage against the stated ${intent.maxSlippagePercent}% limit.`
      : `The ${intent.maxSlippagePercent}% limit cannot be checked without a successful supported quote or historical execution evidence.`;
    items.push(evidence("slippage", "Maximum slippage", "INSUFFICIENT", detail, inspection.simulation.state === "available" ? "Read-only QuoterV2" : "Deterministic policy"));
  } else {
    items.push(evidence("slippage", "Maximum slippage", "VERIFIED", "No swap slippage comparison is required for this transfer intent.", "Deterministic policy"));
  }

  if (!intent.prohibitUnlimitedApproval) items.push(evidence("approval", "Unlimited approval", "VERIFIED", "The reviewed intent does not prohibit unlimited approvals.", "Deterministic policy"));
  else if (unlimitedApproval) items.push(evidence("approval", "Unlimited approval", "CONFLICTING", `Observed an unlimited USDC approval for ${unlimitedApproval.spender ?? "an unresolved spender"}.`, "Transaction receipt"));
  else items.push(evidence("approval", "Unlimited approval", "VERIFIED", "No unlimited USDC approval was observed in this transaction.", "Transaction receipt"));

  if (intent.action === "transfer" && intent.recipient) {
    const recipient = decoded.recipient ?? inspection.observations.transfers.find((transfer) => transfer.to === intent.recipient)?.to ?? null;
    if (!recipient) items.push(evidence("recipient", "Recipient", "INSUFFICIENT", "The transfer recipient could not be extracted from supported transaction evidence.", "Decoded calldata"));
    else if (recipient === intent.recipient.toLowerCase()) items.push(evidence("recipient", "Recipient", "VERIFIED", `Observed recipient ${recipient}.`, "Decoded calldata"));
    else items.push(evidence("recipient", "Recipient", "CONFLICTING", `Observed recipient ${recipient}; intent requires ${intent.recipient.toLowerCase()}.`, "Decoded calldata"));
  } else if (intent.action === "swap") {
    if (transaction.to === UNISWAP_V3_SWAP_ROUTER_02_ADDRESS && routerSwap) items.push(evidence("contract", "Destination contract", "VERIFIED", `Observed allowlisted Uniswap v3 SwapRouter02 ${transaction.to}.`, "Decoded calldata"));
    else if (transaction.to) items.push(evidence("contract", "Destination contract", "INSUFFICIENT", `Observed destination ${transaction.to}, which is not the allowlisted Uniswap v3 exactInputSingle router path.`, "Base RPC"));
    else items.push(evidence("contract", "Destination contract", "INSUFFICIENT", "The transaction does not expose a destination contract for swap comparison.", "Base RPC"));
    const outputDetail = inspection.simulation.state === "available"
      ? `Current QuoterV2 simulation estimates ${displayQuoteOutput(inspection)}, but the mined output cannot be proven from this quote.`
      : "ETH output cannot be established without a successful supported quote or mined transfer evidence.";
    items.push(evidence("expected-output", "Expected output", "INSUFFICIENT", outputDetail, inspection.simulation.state === "available" ? "Read-only QuoterV2" : "Deterministic policy"));
  }

  return buildResult(inspection.transactionHash, items, inspection);
}

export function baseTokenReference() {
  return BASE_USDC_ADDRESS;
}
