import { type Transaction } from "prosemirror-state";
import { type MarkType } from "prosemirror-model";
import { canJoin } from "prosemirror-transform";

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
 * 1. Detects the paired ZWSP at the block boundary
 * 2. Deletes both ZWSP markers
 * 3. Joins the blocks back together
 *
 * Key Findings from E2E Tests:
 * - Case 1 (Delete from first block): Cursor at end of first block, deletes ending ZWSP
 *   → Need FORWARD detection: check if next block starts with matching ZWSP
 * - Case 2 (Backspace from second block): Cursor at start of second block, deletes starting ZWSP
 *   → Need BACKWARD detection: check if previous block ends with matching ZWSP
 *
 * Algorithm:
 * 1. For each ZWSP being deleted, check BOTH directions for matching pair
 * 2. Forward: If ZWSP at end of block, look for matching ZWSP at start of next block
 * 3. Backward: If ZWSP at start of block, look for matching ZWSP at end of previous block
 * 4. Record block boundary positions where joins should occur
 * 5. Delete all ZWSP ranges (avoiding duplicate deletions)
 * 6. Join blocks at recorded positions
 *
 * @param trackedTransaction - The transaction being built (mutated)
 * @param insertedRanges - Ranges of insertion-marked content being deleted
 * @param insertion - The insertion mark type from the schema
 * @returns true if blocks were joined, false otherwise
 */
export function handleBlockJoinOnZwspDeletion(
  trackedTransaction: Transaction,
  insertedRanges: { from: number; to: number; id?: string | number }[],
  insertion: MarkType,
): boolean {
  const blockJoinsToMake: { pos: number; id: string | number }[] = [];
  const additionalRangesToDelete: {
    from: number;
    to: number;
    id?: string | number;
  }[] = [];
  // Phase 1: Detect ZWSP pairs at block boundaries
  // Check BOTH forward and backward directions
  for (const range of insertedRanges) {
    const content = trackedTransaction.doc.textBetween(range.from, range.to);

    // Check if this is a zero-width space at a block boundary
    if (content === "\u200B" && range.id !== undefined) {
      const $rangeEnd = trackedTransaction.doc.resolve(range.to);
      const $rangeStart = trackedTransaction.doc.resolve(range.from);

      // CASE 1: Forward-looking detection (existing logic)
      // Delete pressed at end of first block
      if (!$rangeEnd.nodeAfter) {
        const afterBlockPos = $rangeEnd.after($rangeEnd.depth);

        if (afterBlockPos <= trackedTransaction.doc.content.size) {
          const $afterBlock = trackedTransaction.doc.resolve(afterBlockPos);
          let nextNode = $afterBlock.nodeAfter;

          if (nextNode?.isBlock && nextNode.firstChild) {
            nextNode = nextNode.firstChild;
          }

          if (nextNode?.textContent.startsWith("\u200B")) {
            const nextNodeMark = insertion.isInSet(nextNode.marks);
            if (nextNodeMark?.attrs["id"] === range.id) {
              blockJoinsToMake.push({ pos: afterBlockPos, id: range.id });
            }
          }
        }
      }

      // CASE 2: Backward-looking detection (NEW - fixes the bug!)
      // Backspace pressed at start of second block
      if (!$rangeStart.nodeBefore) {
        const beforeBlockPos = $rangeStart.before($rangeStart.depth);

        if (beforeBlockPos > 0) {
          const $beforeBlock = trackedTransaction.doc.resolve(beforeBlockPos);
          let prevNode = $beforeBlock.nodeBefore;

          if (prevNode?.isBlock && prevNode.lastChild) {
            prevNode = prevNode.lastChild;
          }

          if (prevNode?.textContent.endsWith("\u200B")) {
            const prevNodeMark = insertion.isInSet(prevNode.marks);
            if (prevNodeMark?.attrs["id"] === range.id) {
              // Add join at the block boundary position
              // beforeBlockPos is the position right before the current block's opening tag
              // After the previous block ends, this is the correct join position
              const joinPos = $beforeBlock.pos; // Position at the boundary
              const alreadyAdded = blockJoinsToMake.some(
                (j) => j.pos === joinPos && j.id === range.id,
              );
              if (!alreadyAdded) {
                blockJoinsToMake.push({ pos: joinPos, id: range.id });
              }

              // CRITICAL: Add the matching ZWSP from previous block to deletion list
              // We need to find the exact position of the ending ZWSP in the previous block
              // The prevNode is the text node, and the ZWSP is at its end
              // We can find it by traversing the previous block
              const prevBlock = $beforeBlock.nodeBefore;
              if (prevBlock?.isBlock) {
                // Find the ending position of the previous block's content
                const prevBlockEnd = $beforeBlock.pos - 1; // -1 for closing tag

                // The ZWSP should be the last character before the closing tag
                const zwspEnd = prevBlockEnd;
                const zwspStart = zwspEnd - 1;

                // Only add if not already in ranges
                const alreadyInRanges =
                  insertedRanges.some(
                    (r) => r.from === zwspStart && r.to === zwspEnd,
                  ) ||
                  additionalRangesToDelete.some(
                    (r) => r.from === zwspStart && r.to === zwspEnd,
                  );

                if (!alreadyInRanges) {
                  additionalRangesToDelete.push({
                    from: zwspStart,
                    to: zwspEnd,
                    id: range.id,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // Phase 2: Delete the ZWSP ranges
  // Combine all ranges to delete and sort by position (reverse order)
  const allRangesToDelete = [...insertedRanges, ...additionalRangesToDelete];
  allRangesToDelete.sort((a, b) => b.from - a.from); // Sort in reverse order

  const hadInsertedContent = allRangesToDelete.length > 0;
  for (const range of allRangesToDelete) {
    // Validate range before deletion
    if (
      range.from >= 0 &&
      range.to <= trackedTransaction.doc.content.size &&
      range.from < range.to
    ) {
      trackedTransaction.delete(range.from, range.to);
    }
  }

  // Phase 3: Join blocks at recorded positions
  // Process from end to start to maintain position validity
  blockJoinsToMake.reverse();
  const didBlockJoin = blockJoinsToMake.length > 0;
  for (const joinInfo of blockJoinsToMake) {
    // Map the position through all the changes we've made
    const mappedPos = trackedTransaction.mapping.map(joinInfo.pos);

    // Only join if the position is still valid
    if (mappedPos > 0 && mappedPos < trackedTransaction.doc.content.size) {
      try {
        if (canJoin(trackedTransaction.doc, mappedPos)) {
          trackedTransaction.join(mappedPos);
        }
      } catch {
        // Position may no longer be valid for joining, skip
        continue;
      }
    }
  }

  return hadInsertedContent && didBlockJoin;
}
