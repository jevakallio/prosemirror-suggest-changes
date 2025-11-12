import type { Transaction } from "prosemirror-state";
import type { MarkType } from "prosemirror-model";
import { detectZwspPairs, deleteRanges, joinBlocks } from "./phases.js";
import type { Range } from "./utils.js";

/**
 * Detects and handles block joins when zero-width space (ZWSP) pairs are deleted.
 *
 * CORE PRINCIPLE: Removing an insertion suggestion should revert the document
 * to the state before the suggestion was created.
 *
 * When Enter creates a paragraph split:
 * - ZWSP inserted at end of first block (zwsp_end)
 * - ZWSP inserted at start of second block (zwsp_start)
 * - Both share the same insertion mark ID
 *
 * When either ZWSP is deleted, this function:
 * 1. Detects the paired ZWSP at the block boundary (both forward and backward)
 * 2. Deletes both ZWSP markers
 * 3. Joins the blocks back together
 *
 * @param trackedTransaction - The transaction being built (mutated)
 * @param insertedRanges - Ranges of insertion-marked content being deleted
 * @param insertion - The insertion mark type from the schema
 * @returns true if blocks were joined, false otherwise
 */
export function handleBlockJoinOnZwspDeletion(
  trackedTransaction: Transaction,
  insertedRanges: Range[],
  insertion: MarkType,
): boolean {
  // Phase 1: Detect ZWSP pairs at block boundaries
  const { additionalRangesToDelete, blockJoinsToMake } = detectZwspPairs(
    insertedRanges,
    trackedTransaction,
    insertion,
  );

  // Phase 2: Delete all ZWSP ranges
  const hadInsertedContent = insertedRanges.length > 0;
  const deletionStartStep = deleteRanges(
    insertedRanges,
    additionalRangesToDelete,
    trackedTransaction,
  );

  // Phase 3: Join blocks at recorded positions
  const didBlockJoin = blockJoinsToMake.length > 0;
  if (didBlockJoin) {
    joinBlocks(blockJoinsToMake, deletionStartStep, trackedTransaction);
  }

  return hadInsertedContent && didBlockJoin;
}
