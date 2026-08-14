export type Address = string;
export type Hex = `0x${string}`;
export type ChainId = 8453 | 84532;

export enum Verdict {
  MATCH = "MATCH",
  MISMATCH = "MISMATCH",
  CANNOT_VERIFY = "CANNOT_VERIFY",
}

export type Action =
  | "SWAP"
  | "TRANSFER"
  | "APPROVE"
  | "PERMIT"
  | "CLAIM"
  | "BRIDGE"
  | "UNKNOWN";

export type ApprovalPolicy =
  | "EXACT_ONLY"
  | "BOUNDED"
  | "UNLIMITED_ALLOWED"
  | "NOT_APPLICABLE";

export type PermitPolicy = "DISALLOW" | "BOUNDED" | "ALLOW" | "NOT_APPLICABLE";

export type AssetConstraint = {
  address?: Address;
  symbol?: string;
  decimals?: number;
};

export type AmountConstraint = {
  token: Address | "NATIVE";
  maxRaw?: string;
  minRaw?: string;
};

export type AddressConstraint = {
  exact?: Address;
  allowlist?: Address[];
};

export type IntentSpec = {
  schemaVersion: 1;
  subject?: Address;
  chainId: ChainId;
  action: Action;
  asset?: AssetConstraint;
  spendCap?: AmountConstraint;
  receiveMinimum?: AmountConstraint;
  recipient?: AddressConstraint;
  protocol?: AddressConstraint;
  spender?: AddressConstraint;
  approvalPolicy: ApprovalPolicy;
  permitPolicy: PermitPolicy;
  allowNativeValue: boolean;
  allowUnknownSelectors: boolean;
  permitMaxDeadlineSeconds?: number;
  validAfter?: number;
  validUntil?: number;
  rawText?: string;
};

export type Eip712Type = { name: string; type: string };

export type Eip712TypedData = {
  types: Record<string, Eip712Type[]>;
  primaryType: string;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
};

export type ProposedRequest = {
  schemaVersion: 1;
  chainId: number;
  from?: Address;
  to?: Address;
  valueWei?: string;
  data?: Hex;
  typedData?: Eip712TypedData;
  source: "PASTE" | "FIXTURE" | "WALLET_ADAPTER";
};

export type AssetAmount = {
  token: Address | "NATIVE";
  amountRaw: string;
};

export type DecodedEffect = {
  kind:
    | "NATIVE_TRANSFER"
    | "ERC20_TRANSFER"
    | "ERC20_APPROVE"
    | "ERC2612_PERMIT"
    | "KNOWN_SWAP"
    | "UNKNOWN_CALL";
  chainId: number;
  from?: Address;
  target?: Address;
  selector?: Hex;
  token?: Address;
  spender?: Address;
  recipient?: Address;
  amountRaw?: string;
  amountMaxRaw?: string;
  deadline?: number;
  nonce?: string;
  assetsIn?: AssetAmount[];
  assetsOut?: AssetAmount[];
  nativeValueWei?: string;
  abiSource: "LOCAL_VERIFIED" | "REGISTRY" | "RAW_SELECTOR" | "NONE";
  decodeConfidence: "EXACT" | "PARTIAL" | "UNKNOWN";
  typedDataDomain?: Record<string, unknown>;
};

export type EvidenceKind =
  | "CHAIN_ID"
  | "CODE_PRESENT"
  | "CALLDATA_DECODE"
  | "EIP712_DECODE"
  | "TOKEN_METADATA"
  | "ALLOWANCE"
  | "TARGET_REGISTRY"
  | "SIMULATION"
  | "POLICY_COMPARISON";

export type EvidenceStatus = "PASS" | "FAIL" | "WARNING" | "UNAVAILABLE";

export type EvidenceItem = {
  id: string;
  kind: EvidenceKind;
  source: string;
  blockNumber?: number;
  blockHash?: Hex;
  inputHash: Hex;
  outputHash: Hex;
  status: EvidenceStatus;
  redactedSummary: string;
};

export type RuleSeverity = "HARD_BLOCK" | "UNCERTAINTY" | "WARNING";

export type RuleResult = {
  code: string;
  severity: RuleSeverity;
  passed: boolean;
  message: string;
  evidenceIds: string[];
};

export type AnalysisInput = {
  intent: IntentSpec;
  request: ProposedRequest;
  options?: {
    simulate?: boolean;
    blockNumber?: number;
  };
};

export type AnalysisResult = {
  status: "COMPLETED";
  verdict: Verdict;
  primaryReasonCode?: string;
  intentHash: Hex;
  requestHash: Hex;
  evidenceHash: Hex;
  intent: IntentSpec;
  request: ProposedRequest;
  decodedEffect: DecodedEffect;
  rules: RuleResult[];
  evidence: EvidenceItem[];
  explanation: string;
  engineVersion: string;
  decoderVersion: string;
  evaluatedAt: number;
  expiresAt: number;
};

export type CanonicalReceipt = {
  schemaVersion: 1;
  receiptId: Hex;
  policyId: Hex;
  intentHash: Hex;
  requestHash: Hex;
  evidenceHash: Hex;
  chainId: number;
  subject: Address;
  evaluator: Address;
  verdict: Verdict;
  policyVersion: number;
  evaluatedAt: number;
  expiresAt: number;
  engineVersion: number;
  decoderVersion: number;
  limitations: string[];
};

export type PolicyOptions = {
  chainId: number;
  now?: number;
  blockNumber?: number;
  blockHash?: Hex;
};
