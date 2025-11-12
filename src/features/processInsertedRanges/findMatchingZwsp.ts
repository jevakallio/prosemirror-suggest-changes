import type { MarkType, ResolvedPos } from "prosemirror-model";
import {
  getBlockContentNode,
  resolveAdjacentBlockPosition,
  type Range,
} from "./utils.js";

/**
 * Result of finding a matching ZWSP in an adjacent block
 */
export interface ZwspMatch {
  /** Range of the matching ZWSP in the adjacent block */
  zwspRange: Range;
  /** Position where blocks should be joined */
  joinPos: number;
}

/**
 * Find a matching ZWSP in an adjacent block
 *
 * @param $rangePos - Resolved position at the boundary (start for backward, end for forward)
 * @param direction - Direction to look for matching ZWSP
 * @param expectedId - Expected insertion mark ID
 * @param insertion - Insertion mark type
 * @returns Match info if found, null otherwise
 */
export function findMatchingZwsp(
  $rangePos: ResolvedPos,
  direction: "forward" | "backward",
  expectedId: string | number,
  insertion: MarkType,
): ZwspMatch | null {
  // Check if ZWSP is at block boundary
  const isAtBoundary =
    direction === "forward" ? !$rangePos.nodeAfter : !$rangePos.nodeBefore;

  if (!isAtBoundary) return null;

  // Get adjacent block position
  const adjacentBlock = resolveAdjacentBlockPosition($rangePos, direction);
  if (!adjacentBlock) return null;

  const { pos: blockBoundaryPos, $resolved: $adjacentBlock } = adjacentBlock;

  // Get the adjacent node and navigate to content if it's a block
  const adjacentNode =
    direction === "forward"
      ? $adjacentBlock.nodeAfter
      : $adjacentBlock.nodeBefore;

  const contentNode = getBlockContentNode(adjacentNode, direction);

  // Check if content node has ZWSP at the expected position
  const hasMatchingZwsp =
    direction === "forward"
      ? contentNode?.textContent.startsWith("\u200B")
      : contentNode?.textContent.endsWith("\u200B");

  if (!hasMatchingZwsp || !contentNode) return null;

  // Check if the ZWSP has matching insertion mark ID
  const mark = insertion.isInSet(contentNode.marks);
  if (mark?.attrs["id"] !== expectedId) return null;

  // Calculate ZWSP range in the adjacent block
  const adjacentBlockNode =
    direction === "forward"
      ? $adjacentBlock.nodeAfter
      : $adjacentBlock.nodeBefore;

  if (!adjacentBlockNode?.isBlock) return null;

  let zwspStart: number;
  let zwspEnd: number;

  if (direction === "forward") {
    // ZWSP at start of next block
    zwspStart = $adjacentBlock.pos + 1; // +1 for opening tag
    zwspEnd = zwspStart + 1;
  } else {
    // ZWSP at end of previous block
    zwspEnd = $adjacentBlock.pos - 1; // -1 for closing tag
    zwspStart = zwspEnd - 1;
  }

  return {
    zwspRange: { from: zwspStart, to: zwspEnd, id: expectedId },
    joinPos: direction === "forward" ? blockBoundaryPos : $adjacentBlock.pos,
  };
}
