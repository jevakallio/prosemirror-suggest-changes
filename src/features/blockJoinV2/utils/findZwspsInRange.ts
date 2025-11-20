import { type Node as PMNode, type MarkType } from "prosemirror-model";
import { type ZwspInfo, type SuggestionId } from "./types.js";

const ZWSP = "\u200B";

export function findZwspsInRange(
  doc: PMNode,
  from: number,
  to: number,
  insertionMarkType: MarkType,
): ZwspInfo[] {
  const zwsps: ZwspInfo[] = [];

  doc.nodesBetween(from, to, (node, pos, parent, index) => {
    if (!node.isText) {
      return true;
    }

    const text = node.text ?? "";
    const nodeStart = pos;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === ZWSP) {
        const zwspPos = nodeStart + i;

        if (zwspPos < from || zwspPos >= to) {
          continue;
        }

        const insertionMark = insertionMarkType.isInSet(node.marks);
        const id = insertionMark?.attrs["id"] as SuggestionId | undefined;

        const isBlockStart = isAtBlockStart(parent, index, i);
        const isBlockEnd = isAtBlockEnd(parent, index, i, text.length);

        if (isBlockStart || isBlockEnd) {
          zwsps.push({
            pos: zwspPos,
            id: id ?? null,
            isBlockStart,
            isBlockEnd,
            blockDepth: getBlockDepth(doc, zwspPos),
            parentNode: parent ?? doc,
          });
        }
      }
    }

    return true;
  });

  return zwsps;
}

function isAtBlockStart(
  parent: PMNode | null,
  nodeIndex: number,
  charIndex: number,
): boolean {
  if (!parent?.isBlock) {
    return false;
  }

  if (nodeIndex !== 0) {
    return false;
  }

  if (charIndex !== 0) {
    return false;
  }

  return true;
}

function isAtBlockEnd(
  parent: PMNode | null,
  nodeIndex: number,
  charIndex: number,
  textLength: number,
): boolean {
  if (!parent?.isBlock) {
    return false;
  }

  if (charIndex !== textLength - 1) {
    return false;
  }

  let lastChildIndex = -1;
  parent.forEach((_, __, index) => {
    lastChildIndex = index;
  });

  return nodeIndex === lastChildIndex;
}

function getBlockDepth(doc: PMNode, pos: number): number {
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d >= 0; d--) {
    if ($pos.node(d).isBlock) {
      return d;
    }
  }
  return 0;
}
