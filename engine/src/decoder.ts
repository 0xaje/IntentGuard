import { AbiCoder, Interface, isAddress } from "ethers";
import { decimalString, normalizeAddress, normalizeHex } from "./canonical";
import type {
  Address,
  DecodedEffect,
  Eip712TypedData,
  Hex,
  ProposedRequest,
} from "./types";

const ERC20_INTERFACE = new Interface([
  "function transfer(address to,uint256 amount)",
  "function approve(address spender,uint256 amount)",
]);

const ERC20_SELECTORS = new Map<string, "transfer" | "approve">([
  [ERC20_INTERFACE.getFunction("transfer")!.selector.toLowerCase(), "transfer"],
  [ERC20_INTERFACE.getFunction("approve")!.selector.toLowerCase(), "approve"],
]);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function asAddress(value: unknown, field: string): Address {
  const candidate = String(value);
  if (!isAddress(candidate)) throw new Error(`${field} is not an address`);
  return normalizeAddress(candidate);
}

function asDecimal(value: unknown, field: string): string {
  return decimalString(typeof value === "bigint" ? value : String(value), field);
}

function numericValue(value: unknown, field: string): number {
  const raw = typeof value === "bigint" ? value.toString(10) : String(value);
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error(`${field} is not an integer`);
  const numeric = Number(raw);
  if (!Number.isSafeInteger(numeric)) throw new Error(`${field} exceeds safe number range`);
  return numeric;
}

function selectorOf(data: Hex): Hex {
  if (data.length < 10) return "0x";
  return normalizeHex(data.slice(0, 10));
}

function decodePermit(request: ProposedRequest): DecodedEffect {
  const typedData = request.typedData!;
  const message = typedData.message;
  const domain = typedData.domain;
  const owner = asAddress(message.owner, "Permit.owner");
  const spender = asAddress(message.spender, "Permit.spender");
  const verifyingContract = asAddress(domain.verifyingContract, "EIP712Domain.verifyingContract");
  const value = asDecimal(message.value, "Permit.value");
  const deadline = numericValue(message.deadline, "Permit.deadline");
  const nonce = asDecimal(message.nonce, "Permit.nonce");

  return {
    kind: "ERC2612_PERMIT",
    chainId: request.chainId,
    from: owner,
    target: verifyingContract,
    token: verifyingContract,
    spender,
    amountRaw: value,
    amountMaxRaw: value,
    deadline,
    nonce,
    abiSource: "LOCAL_VERIFIED",
    decodeConfidence: "EXACT",
    typedDataDomain: domain,
  };
}

function isPermitTypedData(typedData: Eip712TypedData): boolean {
  if (typedData.primaryType !== "Permit") return false;
  const permitFields = typedData.types.Permit ?? [];
  const names = new Set(permitFields.map((field) => field.name));
  return ["owner", "spender", "value", "nonce", "deadline"].every((name) => names.has(name));
}

export function decodeRequest(request: ProposedRequest): DecodedEffect {
  if (request.typedData !== undefined) {
    if (!isPermitTypedData(request.typedData)) {
      return {
        kind: "UNKNOWN_CALL",
        chainId: request.chainId,
        target: request.to,
        abiSource: "NONE",
        decodeConfidence: "UNKNOWN",
        typedDataDomain: request.typedData.domain,
      };
    }
    return decodePermit(request);
  }

  if (request.data === undefined) {
    const valueWei = request.valueWei ?? "0";
    if (valueWei !== "0" && request.to !== undefined) {
      return {
        kind: "NATIVE_TRANSFER",
        chainId: request.chainId,
        from: request.from,
        target: normalizeAddress(request.to),
        recipient: normalizeAddress(request.to),
        amountRaw: asDecimal(valueWei, "valueWei"),
        nativeValueWei: asDecimal(valueWei, "valueWei"),
        abiSource: "NONE",
        decodeConfidence: "EXACT",
      };
    }
    return {
      kind: "UNKNOWN_CALL",
      chainId: request.chainId,
      target: request.to,
      abiSource: "NONE",
      decodeConfidence: "UNKNOWN",
    };
  }

  const data = normalizeHex(request.data);
  const selector = selectorOf(data);
  const method = ERC20_SELECTORS.get(selector.toLowerCase());
  const target = request.to === undefined ? undefined : normalizeAddress(request.to);

  if (method === "transfer") {
    try {
      const decoded = ERC20_INTERFACE.decodeFunctionData("transfer", data);
      const recipient = asAddress(decoded[0], "transfer.to");
      const amount = asDecimal(decoded[1], "transfer.amount");
      return {
        kind: "ERC20_TRANSFER",
        chainId: request.chainId,
        from: request.from,
        target,
        selector,
        token: target,
        recipient,
        amountRaw: amount,
        nativeValueWei: asDecimal(request.valueWei ?? "0", "valueWei"),
        abiSource: "LOCAL_VERIFIED",
        decodeConfidence: "EXACT",
      };
    } catch {
      return {
        kind: "UNKNOWN_CALL",
        chainId: request.chainId,
        from: request.from,
        target,
        selector,
        nativeValueWei: asDecimal(request.valueWei ?? "0", "valueWei"),
        abiSource: "RAW_SELECTOR",
        decodeConfidence: "UNKNOWN",
      };
    }
  }

  if (method === "approve") {
    try {
      const decoded = ERC20_INTERFACE.decodeFunctionData("approve", data);
      const spender = asAddress(decoded[0], "approve.spender");
      const amount = asDecimal(decoded[1], "approve.amount");
      return {
        kind: "ERC20_APPROVE",
        chainId: request.chainId,
        from: request.from,
        target,
        selector,
        token: target,
        spender,
        amountRaw: amount,
        amountMaxRaw: amount,
        nativeValueWei: asDecimal(request.valueWei ?? "0", "valueWei"),
        abiSource: "LOCAL_VERIFIED",
        decodeConfidence: "EXACT",
      };
    } catch {
      return {
        kind: "UNKNOWN_CALL",
        chainId: request.chainId,
        from: request.from,
        target,
        selector,
        nativeValueWei: asDecimal(request.valueWei ?? "0", "valueWei"),
        abiSource: "RAW_SELECTOR",
        decodeConfidence: "UNKNOWN",
      };
    }
  }

  return {
    kind: "UNKNOWN_CALL",
    chainId: request.chainId,
    from: request.from,
    target,
    selector,
    nativeValueWei: asDecimal(request.valueWei ?? "0", "valueWei"),
    abiSource: "RAW_SELECTOR",
    decodeConfidence: "UNKNOWN",
  };
}

export function buildErc20ApproveData(spender: Address, amountRaw: string): Hex {
  return ERC20_INTERFACE.encodeFunctionData("approve", [spender, amountRaw]) as Hex;
}

export function buildErc20TransferData(recipient: Address, amountRaw: string): Hex {
  return ERC20_INTERFACE.encodeFunctionData("transfer", [recipient, amountRaw]) as Hex;
}

export function buildPermitTypedData(args: {
  token: Address;
  chainId: number;
  name: string;
  version: string;
  owner: Address;
  spender: Address;
  value: string;
  nonce: string;
  deadline: number;
}): Eip712TypedData {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    domain: {
      name: args.name,
      version: args.version,
      chainId: args.chainId,
      verifyingContract: normalizeAddress(args.token),
    },
    message: {
      owner: normalizeAddress(args.owner),
      spender: normalizeAddress(args.spender),
      value: args.value,
      nonce: args.nonce,
      deadline: args.deadline,
    },
  };
}

export function isUnlimited(value: string): boolean {
  return BigInt(value) === (1n << 256n) - 1n;
}

export function isZeroAddressValue(address: Address | undefined): boolean {
  return address?.toLowerCase() === ZERO_ADDRESS;
}

export function encodeUint256(value: string): string {
  return AbiCoder.defaultAbiCoder().encode(["uint256"], [value]);
}
