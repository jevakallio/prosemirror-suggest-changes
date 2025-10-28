import type { ReplaceStep } from "prosemirror-transform";
import type { Transaction } from "prosemirror-state";
import type { MarkType } from "prosemirror-model";
import { handleBlockJoinOnZwspDeletion } from "./blockJoinOnZwspDeletion.js";

export const processInsertedRanges = (
  step: ReplaceStep,
  trackedTransaction: Transaction,
  stepFrom: number,
  stepTo: number,
  insertion: MarkType,
) => {
  // Make a list of any existing insertions that fall within the
  // range that this step is trying to delete. These will be actually
  // deleted, rather than marked as deletions.
  // Skip this for pure insertions (where from === to), but do it for deletions and replacements
  const isPureInsertion = step.from === step.to;
  const insertedRanges: { from: number; to: number; id?: string | number }[] =
    [];

  if (!isPureInsertion) {
    trackedTransaction.doc.nodesBetween(stepFrom, stepTo, (node, pos) => {
      if (insertion.isInSet(node.marks)) {
        const insertionMark = insertion.isInSet(node.marks);
        const markId = insertionMark?.attrs["id"] as
          | string
          | number
          | undefined;
        const range: { from: number; to: number; id?: string | number } = {
          from: Math.max(pos, stepFrom),
          to: Math.min(pos + node.nodeSize, stepTo),
        };
        if (markId !== undefined) {
          range.id = markId;
        }
        insertedRanges.push(range);
        return false;
      }
      return true;
    });
  }

  // Check for insertion-marked content adjacent to the deletion boundaries
  // This handles the case where a paragraph split creates zero-width spaces
  // at block boundaries, and backspacing should delete them
  // Only check adjacent positions when deleting at block boundaries:
  // - stepTo - stepFrom = 1: Single character deletion (may be ZWSP at boundary)
  // - stepTo - stepFrom = 2: Structural block join (Delete after ArrowLeft) - but only if at block boundary
  const $stepFrom = trackedTransaction.doc.resolve(stepFrom);
  const $stepTo = trackedTransaction.doc.resolve(stepTo);
  const crossesBlockBoundary = $stepFrom.parent !== $stepTo.parent;
  const isSmallDeletion = stepTo - stepFrom <= 2;
  const isBlockBoundaryDeletion =
    !isPureInsertion &&
    isSmallDeletion &&
    (stepTo - stepFrom === 1 || crossesBlockBoundary);

  if (isBlockBoundaryDeletion) {
    const $from = trackedTransaction.doc.resolve(stepFrom);
    const $to = trackedTransaction.doc.resolve(stepTo);

    if (
      stepFrom > 0 &&
      $from.nodeBefore &&
      insertion.isInSet($from.nodeBefore.marks)
    ) {
      const insertionMark = insertion.isInSet($from.nodeBefore.marks);
      const markId = insertionMark?.attrs["id"] as string | number | undefined;
      const rangeFrom = stepFrom - $from.nodeBefore.nodeSize;
      if (rangeFrom >= 0) {
        const range: { from: number; to: number; id?: string | number } = {
          from: rangeFrom,
          to: stepFrom,
        };
        if (markId !== undefined) {
          range.id = markId;
        }
        insertedRanges.push(range);
      }
    }

    // For $to.nodeAfter, we need to check if it's a block node with insertion-marked content
    // at the start, or if it's directly an insertion-marked text node
    if (stepTo < trackedTransaction.doc.content.size && $to.nodeAfter) {
      let nodeToCheck = $to.nodeAfter;
      let posOffset = 0;

      // If nodeAfter is a block node (like paragraph), check its first child
      if (nodeToCheck.isBlock && nodeToCheck.firstChild) {
        nodeToCheck = nodeToCheck.firstChild;
        posOffset = 1; // Account for the opening tag
      }

      if (insertion.isInSet(nodeToCheck.marks)) {
        const insertionMark = insertion.isInSet(nodeToCheck.marks);
        const markId = insertionMark?.attrs["id"] as
          | string
          | number
          | undefined;
        const rangeFrom = stepTo + posOffset;
        const rangeTo = stepTo + posOffset + nodeToCheck.nodeSize;
        if (rangeTo <= trackedTransaction.doc.content.size) {
          const range: { from: number; to: number; id?: string | number } = {
            from: rangeFrom,
            to: rangeTo,
          };
          if (markId !== undefined) {
            range.id = markId;
          }
          insertedRanges.push(range);
        }
      }
    }
  }

  // Handle block joins when ZWSP pairs are deleted
  // This handles the case where Enter creates a paragraph split (suggestion)
  // and Backspace/Delete removes it
  const didHandleBlockJoin = handleBlockJoinOnZwspDeletion(
    trackedTransaction,
    insertedRanges,
    insertion,
  );
  return didHandleBlockJoin;
};
