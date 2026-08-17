import { z } from "zod";
import { addressSchema, transactionHashSchema } from "@shared/intentguard";

export const sanitizeAddress = (val: string) => addressSchema.parse(val.toLowerCase());
export const sanitizeTransactionHash = (val: string) => transactionHashSchema.parse(val.toLowerCase());

export const SECURITY_INVARIANTS = {
  NO_CUSTODY: true,
  NO_PRIVATE_KEYS_CLIENT: true,
  NO_LLM_FINAL_VERDICT: true,
  DETERMINISTIC_EVALUATION: true,
  FAIL_CLOSED_UNCERTAINTY: true,
} as const;
