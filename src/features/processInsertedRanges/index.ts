import type { Transaction } from "prosemirror-state";
import type { MarkType } from "prosemirror-model";
import { handleBlockJoinOnZwspDeletion } from "./blockJoinOnZwspDeletion.js";
import { collectInsertedRangesInDeletion } from "./collectRanges.js";
import {
  findAdjacentInsertionRanges,
  shouldCheckAdjacentBoundaries,
} from "./findAdjacentRanges.js";
import type { Range } from "./utils.js";

/**
 * Process inserted ranges within a deletion and handle block joins
 *
 * This function orchestrates three phases:
 * 1. Collect insertion-marked content that falls within the deletion range
 * 2. Find adjacent insertion-marked content at block boundaries (typically ZWSPs)
 * 3. Delegate to block join handler to remove ZWSPs and join blocks
 *
 * @param trackedTransaction - The transaction being built (mutated)
 * @param stepFrom - Start position of the deletion
 * @param stepTo - End position of the deletion
 * @param insertion - The insertion mark type from the schema
 * @returns true if blocks were joined, false otherwise
 */
export const processInsertedRanges = (
  trackedTransaction: Transaction,
  stepFrom: number,
  stepTo: number,
  insertion: MarkType,
): boolean => {
  const isPureInsertion = stepFrom === stepTo;
  const insertedRanges: Range[] = [];

  // Phase 1: Collect insertion-marked content within the deletion range
  if (!isPureInsertion) {
    const rangesInDeletion = collectInsertedRangesInDeletion(
      trackedTransaction.doc,
      stepFrom,
      stepTo,
      insertion,
    );
    insertedRanges.push(...rangesInDeletion);
  }

  // Phase 2: Check adjacent positions for boundary ZWSPs
  if (shouldCheckAdjacentBoundaries(stepFrom, stepTo, trackedTransaction.doc)) {
    const adjacentRanges = findAdjacentInsertionRanges(
      trackedTransaction.doc,
      stepFrom,
      stepTo,
      insertion,
    );
    insertedRanges.push(...adjacentRanges);
  }

  // Phase 3: Handle block joins when ZWSP pairs are deleted
  return handleBlockJoinOnZwspDeletion(
    trackedTransaction,
    insertedRanges,
    insertion,
  );
};
