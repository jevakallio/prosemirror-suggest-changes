import { type Node as PMNode, type MarkType } from "prosemirror-model";
import { type ZwspInfo, type BorderZwspInfo } from "./types.js";
import { findZwspsInRange } from "./findZwspsInRange.js";
import { findZwspPairs } from "./findZwspPairs.js";

export function findBorderZwsps(
  doc: PMNode,
  rangeFrom: number,
  rangeTo: number,
  zwspsInRange: ZwspInfo[],
  insertionMarkType: MarkType,
): BorderZwspInfo {
  const leftZwsps: ZwspInfo[] = [];
  const rightZwsps: ZwspInfo[] = [];

  // Check for ZWSPs near the left border (expand search range)
  const leftBorderZwsps = findZwspsInRange(
    doc,
    Math.max(0, rangeFrom - 4),
    rangeFrom,
    insertionMarkType,
  );

  for (const zwsp of leftBorderZwsps) {
    if (!zwspsInRange.some((z) => z.pos === zwsp.pos)) {
      leftZwsps.push(zwsp);
    }
  }

  // Check for ZWSPs near the right border (expand search range)
  const rightBorderZwsps = findZwspsInRange(
    doc,
    rangeTo,
    Math.min(doc.content.size, rangeTo + 4),
    insertionMarkType,
  );

  for (const zwsp of rightBorderZwsps) {
    if (!zwspsInRange.some((z) => z.pos === zwsp.pos)) {
      rightZwsps.push(zwsp);
    }
  }

  // Find pairs that cross the border
  const allZwsps = [...zwspsInRange, ...leftZwsps, ...rightZwsps];
  const allPairs = findZwspPairs(allZwsps);

  const borderPairs = allPairs.filter((pair) => {
    const zwsp1InRange = zwspsInRange.some((z) => z.pos === pair.zwsp1.pos);
    const zwsp2InRange = zwspsInRange.some((z) => z.pos === pair.zwsp2.pos);

    return zwsp1InRange !== zwsp2InRange; // One in range, one outside
  });

  return {
    leftZwsps,
    rightZwsps,
    pairsAcrossBorder: borderPairs,
  };
}
