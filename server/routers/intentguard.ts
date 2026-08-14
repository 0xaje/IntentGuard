import { z } from "zod";
import { transactionHashSchema, type AgentTraceStep } from "@shared/intentguard";
import { BaseRpcError, getBaseHealth, inspectBaseTransaction } from "../intentguard/baseRpc";
import { IntentParseError, parseStructuredIntent } from "../intentguard/intent";
import { evaluateIntentAgainstTransaction, makeUnverifiableResult } from "../intentguard/policy";
import { publicProcedure, router } from "../_core/trpc";

const intentInput = z.object({ text: z.string().trim().min(8).max(600) });
const verificationInput = intentInput.extend({ transactionHash: transactionHashSchema });

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

export const intentGuardRouter = router({
  parse: publicProcedure.input(intentInput).mutation(({ input }) => {
    try {
      return { intent: parseStructuredIntent(input.text) };
    } catch (error) {
      const message = error instanceof IntentParseError ? error.message : "The intent could not be interpreted safely.";
      throw new Error(message);
    }
  }),

  verify: publicProcedure.input(verificationInput).mutation(async ({ input }) => {
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
  }),

  health: publicProcedure.query(async () => {
    try {
      const health = await getBaseHealth();
      return { status: health.reachable ? "reachable" : "wrong-network", chainId: health.chainId } as const;
    } catch {
      return { status: "unreachable", chainId: null } as const;
    }
  }),
});
