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
): boolean {
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

  // Step 4: Find pairs within range
  const pairsInRange = findZwspPairs(zwspsInRange);

  // Step 5: Find pairs from border ZWSPs
  // The deletion range might be BETWEEN the ZWSPs (not ON them)
  const allBorderZwsps = [...borderInfo.leftZwsps, ...borderInfo.rightZwsps];
  const allBorderPairs = findZwspPairs(allBorderZwsps);

  // Filter border pairs to only include those where ZWSPs bracket the deletion range
  // This prevents joining blocks from unrelated splits that happen to be within ±15 positions
  const relevantBorderPairs = allBorderPairs.filter((pair) => {
    // Check if zwsp1 is before/at the range start and zwsp2 is after/at the range end
    // This ensures the deletion range is between or overlapping the ZWSPs
    const zwsp1BeforeRange = pair.zwsp1.pos <= stepFrom;
    const zwsp2AfterRange = pair.zwsp2.pos >= stepTo;
    return zwsp1BeforeRange && zwsp2AfterRange;
  });

  // Step 6: Combine all relevant pairs
  const pairs = [...pairsInRange, ...borderInfo.pairsAcrossBorder, ...relevantBorderPairs];

  // Step 6: Group pairs into block join operations
  const groups = groupPairsByBlock(pairs);

  // Recalculate join positions using doc.resolve() to get correct block boundaries
  // The joinPos from groupPairsByBlock is zwsp2.pos, but we need the position AFTER zwsp1's block
  const recalculatedGroups = groups.map((group) => {
    // Find the pair that created this group (assumes one pair per group for now)
    const pair = pairs.find((p) => p.joinPos === group.joinPos);
    if (!pair) return group;

    // Resolve zwsp1's position and find the correct joinable block level
    const $zwsp1 = doc.resolve(pair.zwsp1.pos);
    const $zwsp2 = doc.resolve(pair.zwsp2.pos);

    // Walk up from the maximum common depth to find the highest block level where:
    // 1. zwsp1 is at the end of its ancestor block
    // 2. zwsp2 is at the start of its ancestor block
    // 3. Both blocks are children of the same parent
    const maxDepth = Math.min($zwsp1.depth, $zwsp2.depth);
    let joinDepth = maxDepth;
    for (let d = maxDepth; d >= 1; d--) {
      const node1 = $zwsp1.node(d);
      const node2 = $zwsp2.node(d);

      // Check if these are different blocks with the same parent
      if (node1 !== node2 && $zwsp1.node(d - 1) === $zwsp2.node(d - 1)) {
        // Check if zwsp1 is at the end of this block
        const afterPos1 = $zwsp1.after(d);
        if (afterPos1 > pair.zwsp1.pos) {
          // Check if zwsp2 is at or after the start of its block
          const beforePos2 = $zwsp2.before(d);
          if (beforePos2 <= pair.zwsp2.pos) {
            joinDepth = d;
          }
        }
      }
    }

    const joinPos = $zwsp1.after(joinDepth);

    // Determine if we need a nested join by checking if EITHER ZWSP is deeper than join depth
    // If the ZWSPs are in nested blocks (e.g., paragraphs inside list_items),
    // and we're joining at a higher level (e.g., list_item level),
    // then we should also attempt to join the nested content
    const needsNestedJoin = $zwsp1.depth > joinDepth || $zwsp2.depth > joinDepth;

    // If nested join is needed, calculate where the nested blocks will meet
    // after the outer join. The nested blocks are at zwsp1.depth and zwsp2.depth.
    let nestedJoinPos: number | undefined;
    if (needsNestedJoin) {
      // The nested join position is where the zwsp1's deepest block ends
      // After joining the outer blocks, this will be where the nested blocks meet
      nestedJoinPos = $zwsp1.after($zwsp1.depth);
    }

    return { ...group, joinPos, needsNestedJoin, nestedJoinPos };
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

  // Map ZWSP positions through the insertion deletion steps
  const insertionDeletionSteps = trackedTransaction.steps.slice(startStep);
  const insertionDeletionMapping = new Mapping(insertionDeletionSteps.map((s) => s.getMap()));

  const mappedZwspPositions = uniqueZwspPositions.map((pos) =>
    insertionDeletionMapping.map(pos, 1)
  );

  // Delete ZWSP positions (in reverse order)
  // ZWSPs are single characters, so we delete pos to pos+1
  const sortedZwspPositions = [...mappedZwspPositions].sort((a, b) => b - a);
  for (const pos of sortedZwspPositions) {
    trackedTransaction.delete(pos, pos + 1);
  }

  // Step 8: Join blocks (if any pairs were found)
  if (recalculatedGroups.length === 0) {
    return false;
  }

  // Create mapping from all deletion steps (both insertion deletions and ZWSP deletions)
  const allDeletionSteps = trackedTransaction.steps.slice(startStep);
  const deletionMapping = new Mapping(allDeletionSteps.map((s) => s.getMap()));

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

        // If this pair needs a nested join, join the nested blocks that belonged
        // to this specific ZWSP pair
        if (group.needsNestedJoin && group.nestedJoinPos !== undefined) {
          // Map the nested join position through the deletions AND the join we just did
          const joinStep = trackedTransaction.steps[trackedTransaction.steps.length - 1];
          const mappedNestedPos = deletionMapping.map(group.nestedJoinPos, 1);
          const finalNestedPos = joinStep?.getMap().map(mappedNestedPos, 1) ?? mappedNestedPos;

          try {
            // Check if we can join at the calculated nested position
            if (
              finalNestedPos > 0 &&
              finalNestedPos < trackedTransaction.doc.content.size &&
              canJoin(trackedTransaction.doc, finalNestedPos)
            ) {
              trackedTransaction.join(finalNestedPos);
            }
          } catch {
            // Nested join position not valid
          }
        }
      }
    } catch {
      // Position no longer valid for joining, skip
    }
  }

  // Return true to indicate that block joins were processed
  return true;
}
