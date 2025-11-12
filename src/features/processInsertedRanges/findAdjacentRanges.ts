import type { Node as ProseMirrorNode, MarkType } from "prosemirror-model";
import { extractInsertionMark, type Range } from "./utils.js";

/**
 * Determine if we should check adjacent positions for insertion-marked content
 *
 * We only check adjacent positions for:
 * - Single character deletions (stepTo - stepFrom === 1), OR
 * - Small deletions (≤2 chars) that cross block boundaries
 *
 * This handles the case where a paragraph split creates zero-width spaces
 * at block boundaries, and backspacing/deleting should remove them.
 *
 * @param stepFrom - Start position of the deletion
 * @param stepTo - End position of the deletion
 * @param doc - The ProseMirror document
 * @returns true if we should check adjacent boundaries
 */
export function shouldCheckAdjacentBoundaries(
  stepFrom: number,
  stepTo: number,
  doc: ProseMirrorNode,
): boolean {
  const isPureInsertion = stepFrom === stepTo;
  if (isPureInsertion) return false;

  const $stepFrom = doc.resolve(stepFrom);
  const $stepTo = doc.resolve(stepTo);
  const crossesBlockBoundary = $stepFrom.parent !== $stepTo.parent;
  const isSmallDeletion = stepTo - stepFrom <= 2;

  return isSmallDeletion && (stepTo - stepFrom === 1 || crossesBlockBoundary);
}

/**
 * Find insertion-marked content adjacent to deletion boundaries
 *
 * When deleting at block boundaries, we need to check for insertion-marked content
 * (typically ZWSPs) in adjacent nodes that should also be removed.
 *
 * @param doc - The ProseMirror document
 * @param stepFrom - Start position of the deletion
 * @param stepTo - End position of the deletion
 * @param insertion - The insertion mark type
 * @returns Array of adjacent ranges with insertion marks
 */
export function findAdjacentInsertionRanges(
  doc: ProseMirrorNode,
  stepFrom: number,
  stepTo: number,
  insertion: MarkType,
): Range[] {
  const ranges: Range[] = [];
  const $from = doc.resolve(stepFrom);
  const $to = doc.resolve(stepTo);

  // Look backward from stepFrom
  const backwardRange = findAdjacentInsertionMarkBackward(
    $from,
    stepFrom,
    insertion,
  );
  if (backwardRange) {
    ranges.push(backwardRange);
  }

  // Look forward from stepTo
  const forwardRange = findAdjacentInsertionMarkForward(
    $to,
    stepTo,
    doc.content.size,
    insertion,
  );
  if (forwardRange) {
    ranges.push(forwardRange);
  }

  return ranges;
}

/**
 * Check for insertion-marked content before the deletion boundary
 */
function findAdjacentInsertionMarkBackward(
  $pos: ReturnType<ProseMirrorNode["resolve"]>,
  stepFrom: number,
  insertion: MarkType,
): Range | null {
  if (stepFrom === 0 || !$pos.nodeBefore) return null;

  const markInfo = extractInsertionMark($pos.nodeBefore, insertion);
  if (!markInfo) return null;

  const rangeFrom = stepFrom - $pos.nodeBefore.nodeSize;
  if (rangeFrom < 0) return null;

  return { from: rangeFrom, to: stepFrom, id: markInfo.id };
}

/**
 * Check for insertion-marked content after the deletion boundary
 */
function findAdjacentInsertionMarkForward(
  $pos: ReturnType<ProseMirrorNode["resolve"]>,
  stepTo: number,
  docSize: number,
  insertion: MarkType,
): Range | null {
  if (stepTo >= docSize || !$pos.nodeAfter) return null;

  // Navigate to content node (may be inside a block)
  let nodeToCheck = $pos.nodeAfter;
  let posOffset = 0;

  // If nodeAfter is a block node, check its first child
  if (nodeToCheck.isBlock && nodeToCheck.firstChild) {
    nodeToCheck = nodeToCheck.firstChild;
    posOffset = 1; // Account for the opening tag
  }

  const markInfo = extractInsertionMark(nodeToCheck, insertion);
  if (!markInfo) return null;

  const rangeFrom = stepTo + posOffset;
  const rangeTo = rangeFrom + nodeToCheck.nodeSize;

  if (rangeTo > docSize) return null;

  return { from: rangeFrom, to: rangeTo, id: markInfo.id };
}
