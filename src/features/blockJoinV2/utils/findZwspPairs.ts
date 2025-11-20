import { type ZwspInfo, type ZwspPair, type SuggestionId } from "./types.js";

export function findZwspPairs(zwsps: ZwspInfo[]): ZwspPair[] {
  const pairs: ZwspPair[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < zwsps.length; i++) {
    if (usedIndices.has(i)) {
      continue;
    }

    const zwsp1 = zwsps[i];
    if (zwsp1?.id === undefined || zwsp1.id === null) {
      continue;
    }

    for (let j = i + 1; j < zwsps.length; j++) {
      if (usedIndices.has(j)) {
        continue;
      }

      const zwsp2 = zwsps[j];
      if (zwsp2?.id === undefined || zwsp2.id === null) {
        continue;
      }

      if (idsMatch(zwsp1.id, zwsp2.id)) {
        const pair = createPair(zwsp1, zwsp2);
        pairs.push(pair);
        usedIndices.add(i);
        usedIndices.add(j);
        break;
      }
    }
  }

  return pairs;
}

function idsMatch(id1: SuggestionId, id2: SuggestionId): boolean {
  return id1 === id2;
}

function createPair(zwsp1: ZwspInfo, zwsp2: ZwspInfo): ZwspPair {
  const shouldJoin = canJoinBlocks(zwsp1, zwsp2);
  const joinPos = calculateJoinPos(zwsp1, zwsp2);

  return {
    zwsp1,
    zwsp2,
    shouldJoin,
    joinPos,
  };
}

function canJoinBlocks(zwsp1: ZwspInfo, zwsp2: ZwspInfo): boolean {
  if (zwsp1.pos >= zwsp2.pos) {
    return false;
  }

  const isValidPair =
    (zwsp1.isBlockEnd && zwsp2.isBlockStart) ||
    (zwsp1.isBlockStart && zwsp2.isBlockEnd);

  return isValidPair;
}

function calculateJoinPos(zwsp1: ZwspInfo, zwsp2: ZwspInfo): number {
  if (zwsp1.isBlockEnd && zwsp2.isBlockStart) {
    return zwsp1.pos + 1;
  }

  if (zwsp1.isBlockStart && zwsp2.isBlockEnd) {
    return zwsp2.pos + 1;
  }

  return Math.min(zwsp1.pos, zwsp2.pos);
}
