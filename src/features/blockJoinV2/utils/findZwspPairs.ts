import { type ZwspInfo, type ZwspPair, type SuggestionId } from "./types.js";

/**
 * Finds all valid ZWSP pairs from a list of ZWSPs.
 *
 * A valid pair must satisfy:
 * 1. Both ZWSPs have the same non-null ID
 * 2. Both ZWSPs are in different parent nodes (not same block)
 * 3. First ZWSP is at block end, second is at block start (adjacent boundaries)
 * 4. First ZWSP position < second ZWSP position
 *
 * This algorithm supports chaining: a ZWSP can participate in multiple pairs.
 * Example: [A-end, B-start] and [B-end, C-start] are both valid pairs.
 */
export function findZwspPairs(zwsps: ZwspInfo[]): ZwspPair[] {
  const pairs: ZwspPair[] = [];

  // Sort ZWSPs by position to ensure correct ordering
  // This is important when ZWSPs come from multiple sources (e.g., border detection)
  const sortedZwsps = [...zwsps].sort((a, b) => a.pos - b.pos);

  // Find all blockEnd ZWSPs and match each with the nearest blockStart ZWSP
  for (let i = 0; i < sortedZwsps.length; i++) {
    const zwsp1 = sortedZwsps[i];

    // Skip ZWSPs without IDs
    if (zwsp1?.id === undefined || zwsp1.id === null) {
      continue;
    }

    // Only look for pairs starting with blockEnd ZWSPs
    if (!zwsp1.isBlockEnd) {
      continue;
    }

    // Find the next blockStart ZWSP with matching ID
    for (let j = i + 1; j < sortedZwsps.length; j++) {
      const zwsp2 = sortedZwsps[j];

      // Skip ZWSPs without IDs
      if (zwsp2?.id === undefined || zwsp2.id === null) {
        continue;
      }

      // Only consider blockStart ZWSPs
      if (!zwsp2.isBlockStart) {
        continue;
      }

      // Check if IDs match
      if (!idsMatch(zwsp1.id, zwsp2.id)) {
        continue;
      }

      // Check if they're in different blocks (reject same-block pairs)
      if (zwsp1.parentNode === zwsp2.parentNode) {
        continue;
      }

      // Found a valid pair - create it and move to next blockEnd ZWSP
      const pair = createPair(zwsp1, zwsp2);
      pairs.push(pair);
      break; // Only pair with the nearest matching blockStart
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
  // Validate position ordering
  if (zwsp1.pos >= zwsp2.pos) {
    return false;
  }

  // Only valid pair is blockEnd followed by blockStart
  const isValidPair = zwsp1.isBlockEnd && zwsp2.isBlockStart;

  return isValidPair;
}

function calculateJoinPos(zwsp1: ZwspInfo, zwsp2: ZwspInfo): number {
  // For blockEnd → blockStart pairs, join position is after the first ZWSP
  if (zwsp1.isBlockEnd && zwsp2.isBlockStart) {
    return zwsp1.pos + 1;
  }

  // Fallback for invalid pairs (shouldn't happen with current logic)
  return Math.min(zwsp1.pos, zwsp2.pos);
}
