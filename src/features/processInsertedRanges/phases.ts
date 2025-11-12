import type { Transaction } from "prosemirror-state";
import type { MarkType } from "prosemirror-model";
import { canJoin, Mapping } from "prosemirror-transform";
import { findMatchingZwsp } from "./findMatchingZwsp.js";
import { isRangeAlreadyTracked, isValidRange, type Range } from "./utils.js";

/**
 * Phase 1: Detect ZWSP pairs at block boundaries
 *
 * For each ZWSP being deleted, check both directions for matching pairs.
 * Returns additional ranges to delete and positions where blocks should be joined.
 */
export function detectZwspPairs(
  insertedRanges: Range[],
  transaction: Transaction,
  insertion: MarkType,
): {
  additionalRangesToDelete: Range[];
  blockJoinsToMake: { pos: number; id: string | number }[];
} {
  const blockJoinsToMake: { pos: number; id: string | number }[] = [];
  const additionalRangesToDelete: Range[] = [];

  for (const range of insertedRanges) {
    const content = transaction.doc.textBetween(range.from, range.to);

    // Only process zero-width spaces with valid IDs
    if (content !== "\u200B" || range.id === undefined) continue;

    const $rangeStart = transaction.doc.resolve(range.from);
    const $rangeEnd = transaction.doc.resolve(range.to);

    // Check forward direction (Delete key from end of block)
    const forwardMatch = findMatchingZwsp(
      $rangeEnd,
      "forward",
      range.id,
      insertion,
    );

    if (forwardMatch) {
      blockJoinsToMake.push({ pos: forwardMatch.joinPos, id: range.id });

      // Add matching ZWSP to deletion list if not already tracked
      if (
        !isRangeAlreadyTracked(
          forwardMatch.zwspRange,
          insertedRanges,
          additionalRangesToDelete,
        )
      ) {
        additionalRangesToDelete.push(forwardMatch.zwspRange);
      }
    }

    // Check backward direction (Backspace key from start of block)
    const backwardMatch = findMatchingZwsp(
      $rangeStart,
      "backward",
      range.id,
      insertion,
    );

    if (backwardMatch) {
      // Avoid duplicate join positions
      const alreadyAdded = blockJoinsToMake.some(
        (j) => j.pos === backwardMatch.joinPos && j.id === range.id,
      );

      if (!alreadyAdded) {
        blockJoinsToMake.push({ pos: backwardMatch.joinPos, id: range.id });
      }

      // Add matching ZWSP to deletion list if not already tracked
      if (
        !isRangeAlreadyTracked(
          backwardMatch.zwspRange,
          insertedRanges,
          additionalRangesToDelete,
        )
      ) {
        additionalRangesToDelete.push(backwardMatch.zwspRange);
      }
    }
  }

  return { additionalRangesToDelete, blockJoinsToMake };
}

/**
 * Phase 2: Delete all ZWSP ranges
 *
 * Combines and sorts ranges, then deletes them in reverse order.
 * Returns the starting step index for position mapping.
 */
export function deleteRanges(
  insertedRanges: Range[],
  additionalRanges: Range[],
  transaction: Transaction,
): number {
  // Combine and sort ranges in reverse order for safe deletion
  const allRangesToDelete = [...insertedRanges, ...additionalRanges];
  allRangesToDelete.sort((a, b) => b.from - a.from);

  // Track step index before deletions
  const startStep = transaction.steps.length;

  // Delete each valid range
  for (const range of allRangesToDelete) {
    if (isValidRange(range, transaction.doc)) {
      transaction.delete(range.from, range.to);
    }
  }

  return startStep;
}

/**
 * Phase 3: Join blocks at recorded positions
 *
 * Maps positions through deletion steps and joins blocks where valid.
 */
export function joinBlocks(
  blockJoinsToMake: { pos: number; id: string | number }[],
  deletionStartStep: number,
  transaction: Transaction,
): void {
  // Process from end to start to maintain position validity
  blockJoinsToMake.reverse();

  // Create mapping for deletion steps
  const deletionSteps = transaction.steps.slice(deletionStartStep);
  const deletionMapping = new Mapping(deletionSteps.map((s) => s.getMap()));

  for (const joinInfo of blockJoinsToMake) {
    // Map position through deletions
    const mappedPos = deletionMapping.map(joinInfo.pos);

    // Validate and join
    if (mappedPos > 0 && mappedPos < transaction.doc.content.size) {
      try {
        if (canJoin(transaction.doc, mappedPos)) {
          transaction.join(mappedPos);
        }
      } catch {
        // Position no longer valid for joining, skip
        continue;
      }
    }
  }
}
