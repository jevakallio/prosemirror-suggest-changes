import type {
  Node as ProseMirrorNode,
  ResolvedPos,
  MarkType,
  Mark,
} from "prosemirror-model";

/**
 * Range with optional insertion mark ID
 */
export interface Range {
  from: number;
  to: number;
  id?: string | number;
}

/**
 * Check if a range is already tracked in existing range lists
 */
export function isRangeAlreadyTracked(
  range: Range,
  ...rangeLists: Range[][]
): boolean {
  for (const list of rangeLists) {
    const found = list.some(
      (r) =>
        (r.from === range.from && r.to === range.to) ||
        (r.from <= range.from && r.to >= range.to),
    );
    if (found) return true;
  }
  return false;
}

/**
 * Validate that a range is within document bounds and non-empty
 */
export function isValidRange(range: Range, doc: ProseMirrorNode): boolean {
  return (
    range.from >= 0 && range.to <= doc.content.size && range.from < range.to
  );
}

/**
 * Get the actual content node from a block boundary position.
 * If the node is a block, returns its first/last child depending on direction.
 */
export function getBlockContentNode(
  node: ProseMirrorNode | null | undefined,
  direction: "forward" | "backward",
): ProseMirrorNode | null | undefined {
  if (!node) return null;
  if (node.isBlock) {
    return direction === "forward" ? node.firstChild : node.lastChild;
  }
  return node;
}

/**
 * Resolve the position of an adjacent block in the given direction
 */
export function resolveAdjacentBlockPosition(
  $pos: ResolvedPos,
  direction: "forward" | "backward",
): { pos: number; $resolved: ResolvedPos } | null {
  const pos =
    direction === "forward" ? $pos.after($pos.depth) : $pos.before($pos.depth);

  if (direction === "forward" && pos > $pos.doc.content.size) {
    return null;
  }
  if (direction === "backward" && pos <= 0) {
    return null;
  }

  const $resolved = $pos.doc.resolve(pos);
  return { pos, $resolved };
}

/**
 * Extract insertion mark and ID from a node
 * Returns null if the node doesn't have an insertion mark or if the ID is undefined
 */
export function extractInsertionMark(
  node: ProseMirrorNode | null | undefined,
  insertion: MarkType,
): { mark: Mark; id: string | number } | null {
  if (!node) return null;

  const insertionMark = insertion.isInSet(node.marks);
  const markId = insertionMark?.attrs["id"] as string | number | undefined;

  if (!insertionMark || markId === undefined) return null;

  return { mark: insertionMark, id: markId };
}
