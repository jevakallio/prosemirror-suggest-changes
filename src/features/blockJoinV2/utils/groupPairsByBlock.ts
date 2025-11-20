import { type ZwspPair, type BlockJoinGroup } from "./types.js";

export function groupPairsByBlock(pairs: ZwspPair[]): BlockJoinGroup[] {
  const groups: BlockJoinGroup[] = [];

  for (const pair of pairs) {
    if (!pair.shouldJoin) {
      continue;
    }

    const zwspPositions = [pair.zwsp1.pos, pair.zwsp2.pos].sort(
      (a, b) => a - b,
    );

    groups.push({
      joinPos: pair.joinPos,
      zwspPositions,
      reason: "in-range",
    });
  }

  return groups;
}
