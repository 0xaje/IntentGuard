import { TRPCError } from "@trpc/server";
import { Contract, JsonRpcProvider, Wallet, getAddress, keccak256, AbiCoder } from "ethers";
import { z } from "zod";
import { structuredIntentSchema, transactionHashSchema, type AgentTraceStep } from "@shared/intentguard";
import { BaseRpcError, getBaseHealth, inspectBaseTransaction, resolveTokenMetadata } from "../intentguard/baseRpc";
import { buildTrustReceipt, hashIntent, receiptTypedDataForRegistry, recoverReceiptEvaluator } from "../intentguard/crypto";
import { IntentParseError, parseStructuredIntent } from "../intentguard/intent";
import { evaluateIntentAgainstTransaction, makeUnverifiableResult } from "../intentguard/policy";
import { receiptStruct } from "../../engine/src/receipt";
import { getKnownToken, formatTokenUnits, parseTokenUnits } from "../../engine/src/tokens";
import { ENV } from "../_core/env";
import { publicProcedure, router } from "../_core/trpc";

const intentInput = z.object({ text: z.string().trim().min(8).max(600) });
const verificationInput = intentInput.extend({ transactionHash: transactionHashSchema });
const policyCommitInput = z.object({
  intent: structuredIntentSchema,
  validForSeconds: z.number().int().min(300).max(2_592_000),
  metadataUri: z.string().max(2_048).optional().default(""),
});
const receiptAnchorInput = z.object({
  text: z.string().trim().min(8).max(600),
  transactionHash: transactionHashSchema,
  policyId: transactionHashSchema,
  receiptValidForSeconds: z.number().int().min(300).max(604_800),
});

const BASE_SEPOLIA_CHAIN_ID = 84532;
const POLICY_REGISTRY_ABI = [
  "function commitPolicy(bytes32 intentHash,address policyOwner,uint64 version,uint64 validFrom,uint64 validUntil,string metadataURI) returns (bytes32 policyId)",
  "function getPolicy(bytes32 policyId) view returns ((bytes32 policyId,bytes32 intentHash,address policyOwner,address committer,uint64 validFrom,uint64 validUntil,uint256 nonce,uint64 version,string metadataURI),bool revoked)",
  "function isPolicyActive(bytes32 policyId) view returns (bool)",
  "function nextNonce(address owner) view returns (uint256)",
] as const;
const RECEIPT_REGISTRY_ABI = [
  "function EVALUATOR_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
  "function anchorReceipt((bytes32 receiptId,bytes32 policyId,bytes32 intentHash,bytes32 requestHash,bytes32 evidenceHash,uint256 chainId,address transactionSubject,address evaluator,uint8 verdict,uint64 policyVersion,uint64 evaluatedAt,uint64 expiresAt,uint32 engineVersion,uint32 decoderVersion) receipt,bytes evaluatorSignature) returns (bytes32)",
  "function getReceipt(bytes32 receiptId) view returns ((bytes32 receiptId,bytes32 policyId,bytes32 intentHash,bytes32 requestHash,bytes32 evidenceHash,uint256 chainId,address transactionSubject,address evaluator,uint8 verdict,uint64 policyVersion,uint64 evaluatedAt,uint64 expiresAt,uint32 engineVersion,uint32 decoderVersion),bool revoked)",
  "function isReceiptValid(bytes32 receiptId) view returns (bool)",
] as const;

type TrustLoopRuntime = {
  provider: JsonRpcProvider;
  evaluator: Wallet;
  policy: Contract;
  receipt: Contract;
  policyRegistryAddress: string;
  receiptRegistryAddress: string;
};

function trustLoopConfigurationError(message: string): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}

async function trustLoopRuntime(): Promise<TrustLoopRuntime> {
  const missing = [
    ["BASE_SEPOLIA_RPC_URL", ENV.baseSepoliaRpcUrl],
    ["EVALUATOR_PRIVATE_KEY", ENV.evaluatorPrivateKey],
    ["POLICY_REGISTRY_ADDRESS", ENV.policyRegistryAddress],
    ["RECEIPT_REGISTRY_ADDRESS", ENV.receiptRegistryAddress],
  ].filter(([, value]) => !value);
  if (missing.length > 0) {
    trustLoopConfigurationError(`Trust-loop infrastructure is not configured. Missing: ${missing.map(([key]) => key).join(", ")}.`);
  }

  const provider = new JsonRpcProvider(ENV.baseSepoliaRpcUrl);
  const network = await provider.getNetwork().catch(() => null);
  if (!network || Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
    trustLoopConfigurationError(`Configured RPC did not resolve to Base Sepolia (84532). Observed: ${network?.chainId ?? "unreachable"}`);
  }

  const evaluator = new Wallet(ENV.evaluatorPrivateKey, provider);
  const policyRegistryAddress = getAddress(ENV.policyRegistryAddress);
  const receiptRegistryAddress = getAddress(ENV.receiptRegistryAddress);
  const [policyCode, receiptCode] = await Promise.all([
    provider.getCode(policyRegistryAddress),
    provider.getCode(receiptRegistryAddress),
  ]);
  if (!policyCode || policyCode === "0x") trustLoopConfigurationError(`Policy registry contract not found at ${policyRegistryAddress}`);
  if (!receiptCode || receiptCode === "0x") trustLoopConfigurationError(`Receipt registry contract not found at ${receiptRegistryAddress}`);

  return {
    provider,
    evaluator,
    policy: new Contract(policyRegistryAddress, POLICY_REGISTRY_ABI, evaluator),
    receipt: new Contract(receiptRegistryAddress, RECEIPT_REGISTRY_ABI, evaluator),
    policyRegistryAddress,
    receiptRegistryAddress,
  };
}

function computePolicyId(policyOwner: string, committer: string, nonce: bigint, intentHash: string, version: number) {
  return keccak256(AbiCoder.defaultAbiCoder().encode(["address", "address", "uint256", "bytes32", "uint64"], [policyOwner, committer, nonce, intentHash, version]));
}

function mutableReceiptTypes(typedData: ReturnType<typeof receiptTypedDataForRegistry>) {
  return { Receipt: typedData.types.Receipt.map(({ name, type }) => ({ name, type })) };
}

function traceForVerification(args: {
  parsed: boolean;
  transactionFound: boolean;
  decoded: boolean;
  providerFailure?: string;
}): AgentTraceStep[] {
  return [
    { id: "01", label: "Intent constraints extracted", state: args.parsed ? "completed" : "blocked", detail: args.parsed ? "Structured intent passed deterministic schema validation." : "Intent constraints could not be extracted." },
    { id: "02", label: "Base transaction requested", state: args.providerFailure ? "unavailable" : "completed", detail: args.providerFailure ?? "Live Base RPC request completed." },
    { id: "03", label: "Transaction decoded", state: args.decoded ? "completed" : args.transactionFound ? "unavailable" : "unavailable", detail: args.decoded ? "Supported calldata fields were decoded." : args.transactionFound ? "No supported direct ERC-20 decoder matched this transaction." : "No Base transaction was available to decode." },
    { id: "04", label: "Receipt evidence inspected", state: args.providerFailure ? "unavailable" : "completed", detail: args.providerFailure ?? "Receipt logs and execution state were evaluated when available." },
    { id: "05", label: "Deterministic policy compared", state: args.parsed ? "completed" : "blocked", detail: "Final verdict is calculated from deterministic checks, never an LLM safety judgment." },
  ];
}

const parseProcedure = publicProcedure.input(intentInput).mutation(({ input }) => {
  try {
    return { intent: parseStructuredIntent(input.text) };
  } catch (error) {
    const message = error instanceof IntentParseError ? error.message : "The intent could not be interpreted safely.";
    throw new Error(message);
  }
});

const verifyProcedure = publicProcedure.input(verificationInput).mutation(async ({ input }) => {
  const intent = parseStructuredIntent(input.text);
  try {
    const inspection = await inspectBaseTransaction(input.transactionHash);
    const verification = evaluateIntentAgainstTransaction(intent, inspection);
    return {
      intent,
      inspection,
      verification,
      trace: traceForVerification({
        parsed: true,
        transactionFound: Boolean(inspection.transaction),
        decoded: inspection.decoded.kind !== "unknown",
      }),
    };
  } catch (error) {
    const message = error instanceof BaseRpcError ? error.message : "Unable to inspect the transaction with Base RPC.";
    return {
      intent,
      inspection: null,
      verification: makeUnverifiableResult(input.transactionHash, message),
      trace: traceForVerification({ parsed: true, transactionFound: false, decoded: false, providerFailure: message }),
    };
  }
});

const healthProcedure = publicProcedure.query(async () => {
  try {
    const health = await getBaseHealth();
    return { status: health.reachable ? "reachable" : "wrong-network", chainId: health.chainId } as const;
  } catch {
    return { status: "unreachable", chainId: null } as const;
  }
});

const commitPolicyProcedure = publicProcedure.input(policyCommitInput).mutation(async ({ input }) => {
  const runtime = await trustLoopRuntime();
  const latest = await runtime.provider.getBlock("latest");
  if (!latest) trustLoopConfigurationError("Unable to read the current Base Sepolia block for the policy validity window.");

  const policyVersion = 1;
  const validFrom = Number(latest.timestamp);
  const validUntil = validFrom + input.validForSeconds;
  const intentHash = hashIntent(input.intent, policyVersion);
  const committer = await runtime.evaluator.getAddress();
  const policyOwner = committer;
  const nonce = BigInt(await runtime.policy.nextNonce(policyOwner));
  const policyId = computePolicyId(policyOwner, committer, nonce, intentHash, policyVersion);

  let transaction;
  try {
    transaction = await runtime.policy.commitPolicy(intentHash, policyOwner, policyVersion, validFrom, validUntil, input.metadataUri);
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base Sepolia policy commitment submission failed; no policy is reported as committed." });
  }
  const confirmed = await transaction.wait(1);
  if (!confirmed) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base Sepolia policy commitment was not confirmed; no policy is reported as committed." });

  const [stored, revoked] = await runtime.policy.getPolicy(policyId);
  const active = await runtime.policy.isPolicyActive(policyId);
  if (revoked || !active || stored.intentHash.toLowerCase() !== intentHash.toLowerCase() || stored.policyOwner.toLowerCase() !== policyOwner.toLowerCase() || stored.committer.toLowerCase() !== committer.toLowerCase() || Number(stored.version) !== policyVersion) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Confirmed policy commitment did not pass on-chain readback validation." });
  }

  return {
    status: "COMMITTED" as const,
    policyId,
    intentHash,
    policyVersion,
    policyOwner: policyOwner.toLowerCase(),
    policyCommitter: committer.toLowerCase(),
    validFrom,
    validUntil,
    registryAddress: runtime.policyRegistryAddress,
    transactionHash: confirmed.hash,
    blockNumber: confirmed.blockNumber.toString(),
    explorerUrl: `https://sepolia.basescan.org/tx/${confirmed.hash}`,
  };
});

const anchorReceiptProcedure = publicProcedure.input(receiptAnchorInput).mutation(async ({ input }) => {
  const runtime = await trustLoopRuntime();
  const intent = parseStructuredIntent(input.text);
  const inspection = await inspectBaseTransaction(input.transactionHash).catch((error) => {
    const message = error instanceof BaseRpcError ? error.message : "Unable to inspect the supplied Base transaction.";
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Receipt cannot be anchored: ${message}` });
  });
  if (!inspection.transaction || !inspection.raw.transaction || !inspection.raw.receipt || inspection.receipt.state === "pending" || inspection.receipt.state === "missing") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Receipt cannot be anchored until the supplied Base transaction has a confirmed on-chain receipt." });
  }

  const [policyData, active] = await Promise.all([
    runtime.policy.getPolicy(input.policyId),
    runtime.policy.isPolicyActive(input.policyId),
  ]);
  const policy = policyData[0];
  const revoked = policyData[1] as boolean;
  const policyVersion = Number(policy.version);
  const expectedIntentHash = hashIntent(intent, policyVersion);
  if (!active || revoked) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Receipt cannot be anchored because the referenced policy is not active." });
  if (policy.intentHash.toLowerCase() !== expectedIntentHash.toLowerCase()) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Receipt cannot be anchored because the supplied intent does not match the committed canonical policy hash." });
  }

  const evaluatorAddress = await runtime.evaluator.getAddress();
  const evaluatorRole = await runtime.receipt.EVALUATOR_ROLE();
  if (!(await runtime.receipt.hasRole(evaluatorRole, evaluatorAddress))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Receipt cannot be anchored because the configured evaluator does not hold EVALUATOR_ROLE on the registry." });
  }

  const latest = await runtime.provider.getBlock("latest");
  if (!latest) trustLoopConfigurationError("Unable to read the current Base Sepolia block for receipt timestamps.");
  const verification = evaluateIntentAgainstTransaction(intent, inspection);
  const trustReceipt = buildTrustReceipt({
    policyId: input.policyId.toLowerCase() as `0x${string}`,
    policyVersion,
    intent,
    inspection,
    verification,
    evaluator: evaluatorAddress,
    evaluatedAt: Number(latest.timestamp),
    expiresAt: Number(latest.timestamp) + input.receiptValidForSeconds,
  });
  const typedData = receiptTypedDataForRegistry(runtime.receiptRegistryAddress, trustReceipt.receipt);
  const signature = await runtime.evaluator.signTypedData(typedData.domain, mutableReceiptTypes(typedData), typedData.value);
  const recovered = recoverReceiptEvaluator(runtime.receiptRegistryAddress, trustReceipt.receipt, signature);
  if (recovered !== evaluatorAddress.toLowerCase()) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Receipt signature recovery failed; no receipt is submitted for anchoring." });
  }

  let transaction;
  try {
    transaction = await runtime.receipt.anchorReceipt(receiptStruct(trustReceipt.receipt), signature);
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base Sepolia receipt anchoring submission failed; the receipt is not reported as anchored." });
  }
  const confirmed = await transaction.wait(1);
  if (!confirmed) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base Sepolia receipt anchoring was not confirmed; the receipt is not reported as anchored." });

  const [stored, receiptRevoked] = await runtime.receipt.getReceipt(trustReceipt.receipt.receiptId);
  const valid = await runtime.receipt.isReceiptValid(trustReceipt.receipt.receiptId);
  if (receiptRevoked || !valid || stored.receiptId.toLowerCase() !== trustReceipt.receipt.receiptId.toLowerCase() || stored.transactionSubject.toLowerCase() !== trustReceipt.receipt.transactionSubject || stored.evaluator.toLowerCase() !== evaluatorAddress.toLowerCase() || stored.policyId.toLowerCase() !== input.policyId.toLowerCase()) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Confirmed receipt anchoring did not pass on-chain readback validation." });
  }

  return {
    status: "ANCHORED" as const,
    verification,
    receipt: trustReceipt.receipt,
    receiptHash: trustReceipt.receiptHash,
    signature,
    transactionHash: confirmed.hash,
    blockNumber: confirmed.blockNumber.toString(),
    registryAddress: runtime.receiptRegistryAddress,
    explorerUrl: `https://sepolia.basescan.org/tx/${confirmed.hash}`,
    policyOwner: policy.policyOwner.toLowerCase(),
    policyCommitter: policy.committer.toLowerCase(),
    transactionSubject: trustReceipt.receipt.transactionSubject,
  };
});

export const intentGuardRouter = router({
  parse: parseProcedure,
  verify: verifyProcedure,
  health: healthProcedure,
  commitPolicy: commitPolicyProcedure,
  anchorReceipt: anchorReceiptProcedure,

  // Structured Protocol Lifecycle Namespaces
  intent: router({
    parse: parseProcedure,
  }),
  policy: router({
    preview: parseProcedure,
    commit: commitPolicyProcedure,
  }),
  request: router({
    inspect: publicProcedure.input(z.object({ transactionHash: transactionHashSchema })).mutation(async ({ input }) => {
      return inspectBaseTransaction(input.transactionHash);
    }),
  }),
  verification: router({
    evaluate: verifyProcedure,
  }),
  receipt: router({
    anchor: anchorReceiptProcedure,
  }),
  token: router({
    getMetadata: publicProcedure
      .input(z.object({ addressOrSymbol: z.string().min(1).max(66) }))
      .query(async ({ input }) => {
        const known = getKnownToken(input.addressOrSymbol);
        if (known) {
          return {
            address: known.address,
            name: known.name,
            symbol: known.symbol,
            decimals: known.decimals,
            isKnown: true,
            source: "cache" as const,
            detail: "Instant resolved from Base verified token cache.",
          };
        }
        try {
          const resolved = await resolveTokenMetadata(input.addressOrSymbol);
          return {
            address: input.addressOrSymbol,
            name: resolved.symbol ?? "Unknown Token",
            symbol: resolved.symbol ?? "UNKNOWN",
            decimals: resolved.decimals ?? 18,
            isKnown: false,
            source: "rpc" as const,
            detail: resolved.detail,
          };
        } catch {
          return {
            address: input.addressOrSymbol,
            name: "Unknown Token",
            symbol: "UNKNOWN",
            decimals: 18,
            isKnown: false,
            source: "fallback" as const,
            detail: "Could not query on-chain ERC-20 metadata; defaulted to 18 decimals.",
          };
        }
      }),
  }),
});
