import type { Transaction } from "prosemirror-state";
import type { MarkType } from "prosemirror-model";
import { handleBlockJoinOnZwspDeletion } from "./blockJoinOnZwspDeletion.js";

export const processInsertedRanges = (
  trackedTransaction: Transaction,
  stepFrom: number,
  stepTo: number,
  insertion: MarkType,
) => {
  // Make a list of any existing insertions that fall within the
  // range that this step is trying to delete. These will be actually
  // deleted, rather than marked as deletions.
  // Skip this for pure insertions (where from === to), but do it for deletions and replacements
  const isPureInsertion = stepFrom === stepTo;
  // insertedRanges extends the step to contain block boundaries and neighbouring ZWSP
  const insertedRanges: { from: number; to: number; id: string | number }[] =
    [];

  if (!isPureInsertion) {
    trackedTransaction.doc.nodesBetween(stepFrom, stepTo, (node, pos) => {
      const insertionMark = insertion.isInSet(node.marks);
      const markId = insertionMark?.attrs["id"] as
        | string
        | number
        | undefined;
      if (insertionMark && markId !== undefined) {
        const range: { from: number; to: number; id: string | number } = {
          from: Math.max(pos, stepFrom),
          to: Math.min(pos + node.nodeSize, stepTo),
          id: markId,
        };
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
    // TODO: Maybe we should just remove the last ZWSP instead of the whole insertion?
    // The ZWSP might be missing  & the insertion content before the ZWSP should stay as it is
    const insertionMark = $from.nodeBefore && insertion.isInSet($from.nodeBefore.marks);
    const markId = insertionMark?.attrs["id"] as string | number | undefined;
    // This case looks back and adds the whole range between the ZWSPs
    if (
      stepFrom > 0 &&
      $from.nodeBefore &&
      insertionMark && markId
    ) {
      const rangeFrom = stepFrom - $from.nodeBefore.nodeSize;
      if (rangeFrom >= 0) {
        const range = {
          from: rangeFrom,
          to: stepFrom,
          id: markId,
        };
        insertedRanges.push(range);
      }
    }

    // For $to.nodeAfter, we need to check if it's a block node with insertion-marked content
    // at the start, or if it's directly an insertion-marked text node
    let nodeToCheck = $to.nodeAfter;
    if (stepTo < trackedTransaction.doc.content.size && nodeToCheck) {
      let posOffset = 0;
      // If nodeAfter is a block node (like paragraph), check its first child
      if (nodeToCheck.isBlock && nodeToCheck.firstChild) {
        nodeToCheck = nodeToCheck.firstChild;
        posOffset = 1; // Account for the opening tag
      }
      const insertionMark = insertion.isInSet(nodeToCheck.marks);
      const markId = insertionMark?.attrs["id"] as
        | string
        | number
        | undefined;
      if (insertionMark && markId) {

        const rangeFrom = stepTo + posOffset;
        const rangeTo = stepTo + posOffset + nodeToCheck.nodeSize;
        if (rangeTo <= trackedTransaction.doc.content.size) {
          const range = {
            from: rangeFrom,
            to: rangeTo,
            id: markId,
          };
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
