/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 *
 * COMPATIBILITY SHIM (Phase 3 migration): re-exports the shared LLM/tool contract from the "wrexlyn"
 * package instead of hand-declaring a trimmed copy. Kept as a same-path shim — rather than rewriting
 * every one of the ~16 files that `import ... from "./types"`/`"../types"` — specifically because this
 * file previously WAS the hand-trimmed copy (94 of Core's 358 lines) that silently dropped
 * VerificationResult/TransactionRecord/TaskItem/etc.; re-exporting from source is what "restoring the
 * dropped types" (Phase 1 migration-sequence item 5) means in practice. Nothing here is meant to be
 * temporary — this is a barrel, not a stopgap — but it is the one file worth flagging so a future
 * reader isn't surprised to find a "types" file with no interface bodies of its own.
 *
 * Verification, TransactionRecord, ActionLogEntry, and TaskItem are re-exported even though nothing in
 * this codebase consumes them yet — see docs/sdk/COMPATIBILITY.md in the wrexlyn package for why they
 * matter (Phase 5/6's deterministic-finance validation and audit trail depend on them existing here).
 */
export type {
  ChatRole,
  ToolCallRequest,
  TokenUsage,
  ChatCompletionResult,
  LlmProvider,
  LlmConfig,
  ChatMessage,
  ToolDefinition,
  ToolQualityGateResult,
  ToolExecResult,
  RiskLevel,
  ToolSpec,
  ToolContext,
  RetryNotice,
  // Restored — dropped from the pre-migration trimmed copy of this file (see Phase 1 audit).
  TaskStatus,
  TaskItem,
  TransactionOutcome,
  ActionLogEntry,
  VerificationCheck,
  VerificationResult,
  VerificationSource,
  VerificationCheckEntry,
  VerificationContract,
  TransactionRecord,
} from "wrexlyn";
