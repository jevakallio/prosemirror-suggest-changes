import type { Node as ProseMirrorNode, MarkType } from "prosemirror-model";
import { extractInsertionMark, type Range } from "./utils.js";

/**
 * Collect all insertion-marked content within a deletion range
 *
 * Scans the document between stepFrom and stepTo for nodes with insertion marks.
 * These nodes will be actually deleted rather than marked as deletions.
 *
 * @param doc - The ProseMirror document
 * @param stepFrom - Start position of the deletion
 * @param stepTo - End position of the deletion
 * @param insertion - The insertion mark type
 * @returns Array of ranges with insertion marks to delete
 */
export function collectInsertedRangesInDeletion(
  doc: ProseMirrorNode,
  stepFrom: number,
  stepTo: number,
  insertion: MarkType,
): Range[] {
  const ranges: Range[] = [];

  doc.nodesBetween(stepFrom, stepTo, (node, pos) => {
    const markInfo = extractInsertionMark(node, insertion);

    if (markInfo) {
      ranges.push({
        from: Math.max(pos, stepFrom),
        to: Math.min(pos + node.nodeSize, stepTo),
        id: markInfo.id,
      });
      return false; // Don't descend into this node
    }

    return true; // Continue traversal
  });

  return ranges;
}
