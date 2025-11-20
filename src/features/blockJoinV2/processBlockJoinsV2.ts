import { type Transaction } from "prosemirror-state";
import { type MarkType } from "prosemirror-model";
import { canJoin, Mapping } from "prosemirror-transform";
import { findZwspsInRange } from "./utils/findZwspsInRange.js";
import { findBorderZwsps } from "./utils/findBorderZwsps.js";
import { findZwspPairs } from "./utils/findZwspPairs.js";
import { groupPairsByBlock } from "./utils/groupPairsByBlock.js";

/**
 * Processes block joins for ZWSP pairs in a deletion range.
 *
 * This function combines two responsibilities:
 * 1. Delete all insertion-marked content in the deletion range (reverting previous insertions)
 * 2. Detect ZWSP pairs at block boundaries, delete them, and join the blocks
 *
 * The function mutates the transaction directly and returns void.
 * After this function completes, normal deletion mark processing continues.
 *
 * Algorithm:
 * 1. Find all insertion-marked content in the deletion range
 * 2. Find ZWSPs in the deletion range
 * 3. Find ZWSPs at range borders (±4 positions)
 * 4. Combine all ZWSPs
 * 5. Find valid ZWSP pairs (same ID, different blocks, blockEnd→blockStart)
 * 6. Group pairs into block join operations
 * 7. Delete all content (insertion ranges + ZWSP positions) in reverse order
 * 8. Join blocks in reverse order using position mapping
 */
export function processBlockJoinsV2(
  trackedTransaction: Transaction,
  stepFrom: number,
  stepTo: number,
  insertionMarkType: MarkType,
): void {
  const doc = trackedTransaction.doc;

  // Step 1: Find all insertion-marked content in the deletion range
  // These ranges will be actually deleted (reverting the insertion)
  const insertedRanges: { from: number; to: number }[] = [];
  doc.nodesBetween(stepFrom, stepTo, (node, pos) => {
    if (insertionMarkType.isInSet(node.marks)) {
      insertedRanges.push({
        from: Math.max(pos, stepFrom),
        to: Math.min(pos + node.nodeSize, stepTo),
      });
      return false;
    }
    return true;
  });

  // Steps 2-3: Find ZWSPs in range and at borders
  const zwspsInRange = findZwspsInRange(doc, stepFrom, stepTo, insertionMarkType);
  const borderInfo = findBorderZwsps(
    doc,
    stepFrom,
    stepTo,
    zwspsInRange,
    insertionMarkType,
  );

  // Step 4: Combine all ZWSPs
  const allZwsps = [
    ...zwspsInRange,
    ...borderInfo.leftZwsps,
    ...borderInfo.rightZwsps,
  ];

  // Step 5: Find all valid ZWSP pairs
  const pairs = findZwspPairs(allZwsps);

  // Step 6: Group pairs into block join operations
  const groups = groupPairsByBlock(pairs);

  // Recalculate join positions using doc.resolve() to get correct block boundaries
  // The joinPos from groupPairsByBlock is zwsp2.pos, but we need the position AFTER zwsp1's block
  const recalculatedGroups = groups.map((group) => {
    // Find the pair that created this group (assumes one pair per group for now)
    const pair = pairs.find((p) => p.joinPos === group.joinPos);
    if (!pair) return group;

    // Resolve zwsp1's position and get the position after its parent block
    const $zwsp1 = doc.resolve(pair.zwsp1.pos);
    const joinPos = $zwsp1.after($zwsp1.depth);

    return { ...group, joinPos };
  });

  // Step 7: Collect all positions to delete
  // Combine insertion ranges and ZWSP positions
  const zwspPositions = recalculatedGroups.flatMap((g) => g.zwspPositions);

  // Deduplicate ZWSP positions (a ZWSP might be in multiple groups)
  const uniqueZwspPositions = [...new Set(zwspPositions)];
  const uniqueZwspPositionsSet = new Set(uniqueZwspPositions);

  // Record the step index before we start deleting
  const startStep = trackedTransaction.steps.length;

  // Filter out insertion ranges that overlap with ZWSP positions
  // ZWSPs will be deleted separately as part of block join handling
  const filteredInsertedRanges = insertedRanges.filter((range) => {
    // Check if this range contains a ZWSP that we're going to delete
    for (const zwspPos of uniqueZwspPositions) {
      if (zwspPos >= range.from && zwspPos < range.to) {
        // This range contains a ZWSP - skip it
        return false;
      }
    }
    return true;
  });

  // Delete insertion-marked ranges first (in reverse order)
  // This matches the main branch behavior
  const sortedInsertedRanges = [...filteredInsertedRanges].sort(
    (a, b) => b.from - a.from,
  );
  for (const range of sortedInsertedRanges) {
    trackedTransaction.delete(range.from, range.to);
  }

  // Delete ZWSP positions (in reverse order)
  // ZWSPs are single characters, so we delete pos to pos+1
  const sortedZwspPositions = [...uniqueZwspPositions].sort((a, b) => b - a);
  for (const pos of sortedZwspPositions) {
    trackedTransaction.delete(pos, pos + 1);
  }

  // Step 8: Join blocks (if any pairs were found)
  if (recalculatedGroups.length === 0) {
    return;
  }

  // Create mapping from all deletion steps
  const deletionSteps = trackedTransaction.steps.slice(startStep);
  const deletionMapping = new Mapping(deletionSteps.map((s) => s.getMap()));

  // Sort groups by join position in reverse order (high to low)
  const sortedGroups = [...recalculatedGroups].sort((a, b) => b.joinPos - a.joinPos);

  // Join blocks at mapped positions
  for (const group of sortedGroups) {
    // Use bias=1 to map to the position after deletions at the same position
    const mappedPos = deletionMapping.map(group.joinPos, 1);

    // Validate position is within document bounds
    if (mappedPos <= 0 || mappedPos >= trackedTransaction.doc.content.size) {
      continue;
    }

    // Attempt to join blocks at the mapped position
    try {
      if (canJoin(trackedTransaction.doc, mappedPos)) {
        trackedTransaction.join(mappedPos);
      }
    } catch {
      // Position no longer valid for joining, skip
    }
  }
}
