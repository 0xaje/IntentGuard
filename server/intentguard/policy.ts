import { BASE_MAINNET_CHAIN_ID_HEX, BASE_USDC_ADDRESS, type EvidenceItem, type StructuredIntent, type VerificationResult } from "@shared/intentguard";
import { displayUsdc, type TransactionInspection } from "./baseRpc";

function evidence(id: string, label: string, state: EvidenceItem["state"], detail: string, source: EvidenceItem["source"]): EvidenceItem {
  return { id, label, state, detail, source };
}

function buildResult(transactionHash: string, evidenceItems: EvidenceItem[]): VerificationResult {
  const failedChecks = evidenceItems.filter((item) => item.state === "failed").length;
  const unavailableChecks = evidenceItems.filter((item) => item.state === "unavailable").length;
  const passedChecks = evidenceItems.filter((item) => item.state === "verified").length;
  const verdict = failedChecks > 0 ? "MISMATCH" : unavailableChecks > 0 ? "UNVERIFIABLE" : "MATCH";

  const summary = verdict === "MATCH"
    ? "The observed transaction satisfies every constraint that IntentGuard can verify from the available Base evidence."
    : verdict === "MISMATCH"
      ? "The observed transaction conflicts with one or more explicit intent constraints. No transaction has been approved by IntentGuard."
      : "IntentGuard could not establish every required fact from the available Base evidence. No transaction has been approved.";

  return {
    receiptId: `IG-${transactionHash.slice(2, 10).toUpperCase()}`,
    verdict,
    summary,
    evidence: evidenceItems,
    passedChecks,
    failedChecks,
    unavailableChecks,
    observedAt: new Date().toISOString(),
  };
}

export function makeUnverifiableResult(transactionHash: string, detail: string): VerificationResult {
  return buildResult(transactionHash, [
    evidence("base-data", "Base transaction data", "unavailable", detail, "Base RPC"),
  ]);
}

export function evaluateIntentAgainstTransaction(intent: StructuredIntent, inspection: TransactionInspection): VerificationResult {
  const items: EvidenceItem[] = [];
  const transaction = inspection.transaction;
  const decoded = inspection.decoded;
  const observedSpendRaw = inspection.observations.spentUsdcRaw ?? decoded.amountRaw;
  const observedSpend = observedSpendRaw ? Number(displayUsdc(observedSpendRaw)) : null;
  const hasUsdcActivity = decoded.token === "USDC" || inspection.observations.approvals.length > 0 || inspection.observations.transfers.length > 0;
  const unlimitedApproval = inspection.observations.approvals.find((approval) => approval.unlimited);

  items.push(
    inspection.networkChainId.toLowerCase() === BASE_MAINNET_CHAIN_ID_HEX
      ? evidence("chain", "Network is Base", "verified", "Base RPC reported chain ID 8453 (0x2105).", "Base RPC")
      : evidence("chain", "Network is Base", "failed", `Base RPC reported ${inspection.networkChainId}, not Base Mainnet.`, "Base RPC")
  );

  if (!transaction) {
    items.push(evidence("transaction", "Transaction retrieval", "unavailable", "No transaction was found for the supplied hash on Base Mainnet.", "Base RPC"));
    return buildResult(inspection.transactionHash, items);
  }

  if (inspection.receipt.state === "success") {
    items.push(evidence("execution", "Mined execution", "verified", `The transaction receipt succeeded in block ${inspection.receipt.blockNumber ?? "unknown"}.`, "Transaction receipt"));
  } else if (inspection.receipt.state === "failed") {
    items.push(evidence("execution", "Mined execution", "failed", "The transaction receipt reports a reverted execution.", "Transaction receipt"));
  } else {
    items.push(evidence("execution", "Mined execution", "unavailable", "No mined receipt is available. The transaction may still be pending.", "Base RPC"));
  }

  if (intent.action === "transfer") {
    if (decoded.kind === "transfer" && decoded.token === "USDC") {
      items.push(evidence("action", "Requested action", "verified", "Decoded calldata is a direct USDC transfer.", "Decoded calldata"));
    } else if (decoded.kind === "approve") {
      items.push(evidence("action", "Requested action", "failed", "Decoded calldata is a USDC approval, not the requested transfer.", "Decoded calldata"));
    } else {
      items.push(evidence("action", "Requested action", "unavailable", "The transaction is not a supported direct USDC transfer decoder path.", "Decoded calldata"));
    }
  } else if (decoded.kind === "approve") {
    items.push(evidence("action", "Requested action", "failed", "Decoded calldata is a direct USDC approval, not a swap.", "Decoded calldata"));
  } else {
    items.push(evidence("action", "Requested action", "unavailable", "A router-level swap cannot yet be proven by the limited calldata decoder.", "Decoded calldata"));
  }

  items.push(
    hasUsdcActivity
      ? evidence("input-asset", "Input asset", "verified", "Observed USDC calldata or USDC receipt logs on Base.", "Transaction receipt")
      : evidence("input-asset", "Input asset", "unavailable", "No Base USDC calldata or receipt log was available to inspect.", "Transaction receipt")
  );

  if (observedSpend === null || !Number.isFinite(observedSpend)) {
    items.push(evidence("spend-limit", "Maximum spend", "unavailable", "The USDC amount spent by this action could not be established from supported evidence.", "Deterministic policy"));
  } else if (observedSpend <= intent.maxSpendUsdc) {
    items.push(evidence("spend-limit", "Maximum spend", "verified", `${observedSpend} USDC observed, within the ${intent.maxSpendUsdc} USDC limit.`, "Deterministic policy"));
  } else {
    items.push(evidence("spend-limit", "Maximum spend", "failed", `${observedSpend} USDC observed, exceeding the ${intent.maxSpendUsdc} USDC limit.`, "Deterministic policy"));
  }

  if (intent.action === "swap" && intent.maxSlippagePercent !== null) {
    items.push(evidence("slippage", "Maximum slippage", "unavailable", `The ${intent.maxSlippagePercent}% limit cannot be checked until a supported swap decoder or simulation source is connected.`, "Deterministic policy"));
  } else {
    items.push(evidence("slippage", "Maximum slippage", "verified", "No swap slippage comparison is required for this transfer intent.", "Deterministic policy"));
  }

  if (!intent.prohibitUnlimitedApproval) {
    items.push(evidence("approval", "Unlimited approval", "verified", "The reviewed intent does not prohibit unlimited approvals.", "Deterministic policy"));
  } else if (unlimitedApproval) {
    items.push(evidence("approval", "Unlimited approval", "failed", `Observed an unlimited USDC approval for ${unlimitedApproval.spender ?? "an unresolved spender"}.`, "Transaction receipt"));
  } else {
    items.push(evidence("approval", "Unlimited approval", "verified", "No unlimited USDC approval was observed in this transaction.", "Transaction receipt"));
  }

  if (intent.action === "transfer" && intent.recipient) {
    const recipient = decoded.recipient ?? inspection.observations.transfers.find((transfer) => transfer.to === intent.recipient)?.to ?? null;
    if (!recipient) {
      items.push(evidence("recipient", "Recipient", "unavailable", "The transfer recipient could not be extracted from supported transaction evidence.", "Decoded calldata"));
    } else if (recipient === intent.recipient.toLowerCase()) {
      items.push(evidence("recipient", "Recipient", "verified", `Observed recipient ${recipient}.`, "Decoded calldata"));
    } else {
      items.push(evidence("recipient", "Recipient", "failed", `Observed recipient ${recipient}; intent requires ${intent.recipient.toLowerCase()}.`, "Decoded calldata"));
    }
  } else if (intent.action === "swap") {
    items.push(
      transaction.to
        ? evidence("contract", "Destination contract", "unavailable", `Observed destination ${transaction.to}, but v0.1 has no configured Base swap-protocol allowlist to compare against.`, "Base RPC")
        : evidence("contract", "Destination contract", "unavailable", "The transaction does not expose a destination contract for swap comparison.", "Base RPC")
    );
    items.push(evidence("expected-output", "Expected output", "unavailable", "ETH output cannot be established without a supported swap decoder or simulation response.", "Deterministic policy"));
  }

  return buildResult(inspection.transactionHash, items);
}

export function baseTokenReference() {
  return BASE_USDC_ADDRESS;
}
